import type { ExplainedMetric, FinancialLens, TracedValue } from '@/types/core';
import { valueOf } from '@/types/core';
import type { CreditApplication, Customer, Finding } from '@/types/application';
import type { FinancialPeriod } from '@/types/financials';

import { ACB_SCALES, NOTCHING_CONFIGS, SEGMENTATION_PROMETEIA_V1, WORST_RATING_V1, type RatingGrade } from '@/config/rating';
import { BUSINESS_SCORECARDS, DATA_QUALITY_V1, LEGACY_SCORECARDS } from '@/config/scorecards';
import { COLLATERAL_HAIRCUTS_V1, POLICY_VERSIONS, STOP_FACTORS_V1 } from '@/config/policy';
import { WORKFLOW_VERSIONS } from '@/config/workflow';

import { balanceTotals, cashFlowTotals, incomeTotals } from '@/domain/calculations/statements';
import { computeRatios, type RatioContext } from '@/domain/calculations/ratios';
import { altmanInputsFrom, computeAltman } from '@/domain/calculations/altman';
import { steadyStateMonthlyPayment, maxSustainableLoan } from '@/domain/calculations/amortisation';
import { capacityBreakEven, computeRepaymentCapacity } from '@/domain/calculations/repayment-capacity';
import { runCrossChecks } from '@/domain/calculations/cross-checks';
import {
  analyseRefinancing,
  computeGroupExposure,
  debtBurdenIncrease,
  summariseBureau,
} from '@/domain/calculations/bureau';
import { computeCollateralCoverage } from '@/domain/calculations/collateral';
import { buildForecast } from '@/domain/calculations/forecast';
import { runStressTest } from '@/domain/calculations/stress';

import { evaluateLegacyOpinion } from '@/domain/scoring/legacy-opinion';
import { computeRating, preScreen, computeBureauRating } from '@/domain/rating/rating-engine';
import { evaluatePolicy } from '@/domain/rules/policy-engine';
import { evaluateStopFactors, triggeredStopFactors } from '@/domain/rules/stop-factors';
import { computeDataQuality } from '@/domain/rules/data-quality';
import { generateCommentary, generateFindings } from '@/domain/rules/findings';
import { routeApplication } from '@/domain/workflow/routing-engine';

/**
 * Assessment orchestrator.
 *
 * Runs every engine for one application in a fixed order and returns a single
 * immutable snapshot. Pages read from this snapshot rather than each
 * recomputing pieces, which is what keeps the sticky panel, the rating
 * waterfall and the credit memo from ever disagreeing with one another.
 */

export type Assessment = ReturnType<typeof assessApplication>;

export interface AssessOptions {
  lens?: FinancialLens;
  /** Overrides the version frozen on the application (what-if analysis). */
  workflowVersionId?: string;
}

export function assessApplication(
  application: CreditApplication,
  customer: Customer,
  options: AssessOptions = {},
) {
  const lens: FinancialLens = options.lens ?? 'ADJUSTED';

  /* ---------------- Configuration resolved from the frozen versions ------- */
  const legacyScorecard = LEGACY_SCORECARDS[application.legacyScorecardVersion] ?? LEGACY_SCORECARDS.ATB_YEKUN_REY_V1;
  const businessScorecard =
    BUSINESS_SCORECARDS[application.scorecardVersion] ?? BUSINESS_SCORECARDS.PROMETEIA_QUICK_WIN_V1;
  const policy = POLICY_VERSIONS[application.policyVersion] ?? POLICY_VERSIONS.ATB_POLICY_V1;
  const workflow =
    WORKFLOW_VERSIONS[options.workflowVersionId ?? application.workflowVersion] ??
    WORKFLOW_VERSIONS.PROMETEIA_PROPOSED_V2;
  const acbScale = ACB_SCALES.ACB_SCALE_PROMETEIA_V1;
  const notching = NOTCHING_CONFIGS.NOTCHING_PROMETEIA_V1;

  /* ---------------- Periods & statements ---------------- */
  const periods = [...application.periods].sort((a, b) => a.endDate.localeCompare(b.endDate));
  const primary = periods.find((p) => p.isPrimary) ?? periods.filter((p) => p.periodType !== 'FORECAST').at(-1);
  // The comparison anchor is the period immediately BEFORE the primary one.
  // Taking the last non-primary period would pick up a later YTD stub and
  // invert every trend.
  const previous = periods
    .filter((p) => p.periodType !== 'FORECAST' && !!primary && p.endDate < primary.endDate)
    .at(-1);

  const statementsFor = (period?: FinancialPeriod) => {
    if (!period) return undefined;
    const balance = application.balanceSheets.find((b) => b.periodId === period.id);
    const income = application.incomeStatements.find((i) => i.periodId === period.id);
    const cashFlow = application.cashFlows.find((c) => c.periodId === period.id);
    if (!balance || !income) return undefined;
    return { period, balance, income, cashFlow };
  };

  const currentSet = statementsFor(primary);
  const previousSet = statementsFor(previous);

  const balance = currentSet ? balanceTotals(currentSet.balance, lens) : undefined;
  const income = currentSet ? incomeTotals(currentSet.income, lens) : undefined;
  const cash = currentSet?.cashFlow ? cashFlowTotals(currentSet.cashFlow, lens) : undefined;

  const previousBalance = previousSet ? balanceTotals(previousSet.balance, lens) : undefined;
  const previousIncome = previousSet ? incomeTotals(previousSet.income, lens) : undefined;

  /* ---------------- Bureau, exposure, refinancing ---------------- */
  const bureauSummary = summariseBureau(application.bureauReports);
  const allFacilities = application.bureauReports.flatMap((r) => r.facilities);
  const refinancing = analyseRefinancing(allFacilities);

  // The applicant's own report is what the balance sheet must reconcile
  // against; related-party borrowings sit on their own balance sheets.
  const applicantFacilities = (application.bureauReports[0]?.facilities ?? []).filter(
    (f) => f.status === 'ACTIVE' || f.status === 'RESTRUCTURED',
  );
  const applicantBureauDebt = applicantFacilities.reduce((s, f) => s + f.outstanding, 0);

  const debtBeingClosed = application.purposeLines
    .filter((p) => p.category === 'REFINANCE_ATB' || p.category === 'REFINANCE_OTHER_BANK')
    .reduce((s, p) => s + p.amount, 0);

  const structure = application.proposedStructure ?? application.requestedStructure;
  const proposedMonthlyPayment = steadyStateMonthlyPayment(structure);

  const groupExposure = computeGroupExposure(
    application.groupMembers,
    structure.amount,
    debtBeingClosed,
  );

  const monthlyServiceBeingRefinanced = allFacilities
    .filter((f) => f.status === 'ACTIVE')
    .filter(() => debtBeingClosed > 0)
    .reduce((s, f) => s + f.monthlyPayment * Math.min(debtBeingClosed / Math.max(bureauSummary.totalDebt, 1), 1), 0);

  const postTransactionMonthlyDebtService =
    bureauSummary.monthlyDebtService - monthlyServiceBeingRefinanced + proposedMonthlyPayment;

  const burden = debtBurdenIncrease(allFacilities, postTransactionMonthlyDebtService);

  /* ---------------- Collateral ---------------- */
  const collateral = computeCollateralCoverage(
    application.collateral,
    groupExposure.postTransactionAtbExposure,
    COLLATERAL_HAIRCUTS_V1,
  );

  /* ---------------- Forecast & repayment capacity ---------------- */
  const monthsCovered = primary?.monthsCovered ?? 12;
  const monthlyOwnerWithdrawals = currentSet?.cashFlow
    ? valueOf(currentSet.cashFlow.ownerWithdrawal, lens) / monthsCovered
    : 0;
  const actualMonthlyCapex = currentSet?.cashFlow ? valueOf(currentSet.cashFlow.capex, lens) / monthsCovered : 0;
  /**
   * Repayment capacity is charged with *maintenance* capex only. Charging a
   * one-off expansion year in full would understate the sustainable cash the
   * business generates; depreciation is the conventional proxy for the
   * spend needed to keep the asset base intact.
   */
  const monthlyMaintenanceCapex = currentSet
    ? Math.min(actualMonthlyCapex, incomeTotals(currentSet.income, lens).depreciation / monthsCovered)
    : 0;

  const workingCapitalAbsorption =
    balance && previousBalance
      ? (balance.receivables + balance.inventory - balance.payables -
          (previousBalance.receivables + previousBalance.inventory - previousBalance.payables)) /
        monthsCovered
      : 0;

  const forecastAssumptions = income
    ? {
        startMonth: nextMonth(application.applicationDate),
        months: Math.min(Math.max(structure.tenorMonths, 12), 60),
        openingCash: balance?.cash ?? 0,
        monthlySalesReceipts: income.sales / monthsCovered,
        salesGrowthMonthlyPct: 0.003,
        seasonalityIndex: customer.seasonalityIndex.length === 12 ? customer.seasonalityIndex : new Array(12).fill(1),
        cogsRatio: income.sales > 0 ? income.cogs / income.sales : 0.75,
        monthlyPayroll: currentSet?.cashFlow ? valueOf(currentSet.cashFlow.payroll, lens) / monthsCovered : 0,
        monthlyOpex:
          (income.operatingExpenses -
            (currentSet?.cashFlow ? valueOf(currentSet.cashFlow.payroll, lens) : 0)) /
          monthsCovered,
        monthlyTax: income.tax / monthsCovered,
        monthlyOwnerWithdrawals,
        // Facilities being refinanced by this transaction drop out of the
        // forecast — leaving them in would double-count their service
        // alongside the new loan that replaces them.
        existingMonthlyPrincipal: Math.max(
          bureauSummary.monthlyDebtService - monthlyServiceBeingRefinanced - monthlyInterestOf(bureauSummary),
          0,
        ),
        existingMonthlyInterest: monthlyInterestOf(bureauSummary),
        existingRemainingMonths: 36,
        proposedStructure: structure,
        disbursementMonth: 0,
      }
    : undefined;

  const forecast = forecastAssumptions ? buildForecast(forecastAssumptions) : undefined;

  const repayment = income
    ? computeRepaymentCapacity({
        income,
        cash,
        monthsCovered,
        monthlyOwnerWithdrawals,
        monthlyMaintenanceCapex: monthlyMaintenanceCapex,
        monthlyWorkingCapitalAbsorption: Math.max(workingCapitalAbsorption, 0),
        monthlyRecurringObligations: 0,
        existingMonthlyDebtService: bureauSummary.monthlyDebtService,
        monthlyDebtServiceBeingRefinanced: monthlyServiceBeingRefinanced,
        proposedMonthlyDebtService: proposedMonthlyPayment,
        monthlyInterestInCosts: income.interestExpense / monthsCovered,
        monthlyPrincipalInCosts: Math.max(
          bureauSummary.monthlyDebtService - income.interestExpense / monthsCovered,
          0,
        ),
        monthlyPaymentsRemainingElsewhere:
          bureauSummary.monthlyDebtService - monthlyServiceBeingRefinanced,
      })
    : undefined;

  const breakEven = repayment && income ? capacityBreakEven(repayment, income, monthsCovered) : undefined;

  /* ---------------- Ratios ---------------- */
  const ratioCtx: RatioContext | undefined =
    balance && income
      ? {
          balance,
          income,
          cash,
          monthsCovered,
          lens,
          periodLabel: primary?.label ?? '—',
          newLoanAmount: structure.amount,
          debtBeingClosed,
          annualDebtService: postTransactionMonthlyDebtService * 12,
          annualPurchases: currentSet?.cashFlow
            ? (valueOf(currentSet.cashFlow.supplierPayments, lens) / monthsCovered) * 12
            : undefined,
          minForecastClosingCash: forecast?.minimumCash,
          forecastAnnualCashFlow: forecast
            ? forecast.months.slice(0, 12).reduce((s, m) => s + (m.closingCash - m.openingCash), 0)
            : undefined,
        }
      : undefined;

  const ratios = ratioCtx ? computeRatios(ratioCtx) : {};

  const previousRatios =
    previousBalance && previousIncome
      ? computeRatios({
          balance: previousBalance,
          income: previousIncome,
          monthsCovered: previous?.monthsCovered ?? 12,
          lens,
          periodLabel: previous?.label ?? '—',
        })
      : {};

  /* ---------------- Altman ---------------- */
  const retainedEarnings = currentSet ? valueOf(currentSet.balance.retainedEarnings, lens) : 0;
  const altman =
    balance && income ? computeAltman(altmanInputsFrom(balance, income, retainedEarnings), 'PRIVATE', notching.altman.boundaryInclusive) : undefined;

  /* ---------------- Cross-checks ---------------- */
  const crossChecks = currentSet
    ? runCrossChecks({
        current: { balance: currentSet.balance, income: currentSet.income, cashFlow: currentSet.cashFlow },
        previous: previousSet ? { balance: previousSet.balance } : undefined,
        turnover: application.turnover,
        bureauTotalDebt: applicantBureauDebt,
        internalSystemDebt: bureauSummary.atbDebt,
        declaredDebt: balance?.totalBankDebt,
        lens,
      })
    : [];

  /* ---------------- Rating ---------------- */
  const applicantReport = application.bureauReports[0];
  const individualGrade = (applicantReport?.individualBureauRating as RatingGrade | undefined) ?? null;
  const bureauRating = computeBureauRating(bureauSummary.acbMicroScore, individualGrade, acbScale);
  const preScreenResult = preScreen(bureauRating, acbScale);

  const rating = computeRating({
    microScore: bureauSummary.acbMicroScore,
    individualBureauGrade: individualGrade,
    postTransactionGroupExposure: groupExposure.postTransactionGroupExposure,
    businessAssessment: application.businessAssessment,
    altman,
    override: application.ratingOverride
      ? {
          grade: application.ratingOverride.overrideGrade as RatingGrade,
          reason: application.ratingOverride.reason,
          approver: application.ratingOverride.approver,
        }
      : undefined,
    scale: acbScale,
    segmentation: SEGMENTATION_PROMETEIA_V1,
    notching,
    businessScorecard,
    worstGrade: 'POOR',
  });

  /* ---------------- Legacy expert assessment ---------------- */
  const legacy = evaluateLegacyOpinion(legacyScorecard, application.legacyAssessment, {
    noCreditHistory: allFacilities.length === 0,
    sector: customer.sector,
  });

  /* ---------------- Policy ---------------- */
  const metricValues: Record<string, number | null> = {};
  for (const [key, metric] of Object.entries(ratios)) metricValues[key] = metric.value;
  metricValues.dscrPostTransaction = repayment?.dscrAfter ?? null;
  metricValues.paymentToCapacity = repayment?.paymentToCapacity ?? null;
  metricValues.allPaymentsToRetainedProfit = repayment?.allPaymentsToRetainedProfit ?? null;
  metricValues.eligibleCollateralCoverage = collateral.eligibleCoverage;
  metricValues.instalmentRepaymentShare = refinancing.instalmentRepaymentShare;
  metricValues.debtBurdenIncrease = burden.increase;
  metricValues.currentMaxDpd = bureauSummary.currentMaxDpd;
  metricValues.minForecastClosingCash = forecast?.minimumCash ?? null;

  const policyEvaluation = evaluatePolicy(policy, {
    sector: customer.sector,
    subSector: customer.subSector,
    product: structure.product,
    segment: rating.segment,
    metrics: metricValues,
    explained: ratios,
  });

  /* ---------------- Stop factors ---------------- */
  const ownershipAnswer = application.legacyAssessment?.answers.find(
    (a) => a.componentKey === 'BUSINESS_OWNERSHIP_LINK',
  );
  const purposeEfficiency = application.legacyAssessment?.answers.find(
    (a) => a.componentKey === 'PURPOSE_EFFICIENCY',
  );
  const purposeControl = application.legacyAssessment?.answers.find((a) => a.componentKey === 'PURPOSE_CONTROL');
  const akbAnswer = application.legacyAssessment?.answers.find((a) => a.componentKey === 'AKB_EXTRACTS_OBTAINED');
  const dpdAnswer = application.legacyAssessment?.answers.find(
    (a) => a.componentKey === 'UNJUSTIFIED_DPD_30_PLUS',
  );

  const stopFactors = evaluateStopFactors(STOP_FACTORS_V1, {
    sector: customer.sector,
    segment: rating.segment,
    product: structure.product,
    bureauExtractsComplete: akbAnswer ? akbAnswer.optionKey === 'YES' : application.bureauReports.length > 0,
    missingBureauSubjects: application.groupMembers
      .filter((m) => m.includeInGroup)
      .filter((m) => !application.bureauReports.some((r) => r.subjectName === m.name))
      .map((m) => m.name),
    unjustifiedDpd30Plus: dpdAnswer ? dpdAnswer.optionKey === 'YES' : bureauSummary.dpd30PlusEvents > 0,
    maxDpdObserved: bureauSummary.historicMaxDpd,
    ownershipEvidenceScore: ownershipAnswer ? ownershipAnswer.achievement * 100 : null,
    debtToEquityInclNew: ratios.debtToEquityInclNew?.value ?? null,
    paymentToCapacity: repayment?.paymentToCapacity ?? null,
    forecastShowsCapacity: (forecast?.negativeMonths ?? 1) === 0,
    purposeEfficiencyScore: purposeEfficiency ? purposeEfficiency.achievement * 100 : null,
    purposeControlScore: purposeControl ? purposeControl.achievement * 100 : null,
    bureauScore: bureauSummary.acbMicroScore,
    preScreenThreshold: acbScale.preScreenRejectBelow,
  });
  const activeStopFactors = triggeredStopFactors(stopFactors);

  /* ---------------- Data quality ---------------- */
  const tracedValues: Array<{ label: string; value: TracedValue }> = currentSet
    ? [
        ...Object.entries(currentSet.balance)
          .filter(([k]) => k !== 'periodId')
          .map(([k, v]) => ({ label: k, value: v as TracedValue })),
        ...Object.entries(currentSet.income)
          .filter(([k]) => k !== 'periodId')
          .map(([k, v]) => ({ label: k, value: v as TracedValue })),
        ...(currentSet.cashFlow
          ? Object.entries(currentSet.cashFlow)
              .filter(([k]) => k !== 'periodId')
              .map(([k, v]) => ({ label: k, value: v as TracedValue }))
          : []),
      ]
    : [];

  const dataQuality = computeDataQuality(DATA_QUALITY_V1, {
    documents: application.documents,
    tracedValues,
    crossChecks,
  });

  /* ---------------- Structuring ---------------- */
  const maxLoan = repayment
    ? maxSustainableLoan({
        cfadsMonthly: repayment.cfads,
        existingMonthlyDebtService: bureauSummary.monthlyDebtService - monthlyServiceBeingRefinanced,
        minDscr: 1.5,
        annualRatePct: structure.annualRatePct,
        tenorMonths: structure.tenorMonths,
        gracePeriodMonths: structure.gracePeriodMonths,
        amortisation: structure.amortisation,
      })
    : undefined;

  const stress =
    income && forecastAssumptions && balance
      ? runStressTest({
          income,
          monthsCovered,
          totalBankDebt: balance.totalBankDebt,
          forecast: forecastAssumptions,
          postTransactionMonthlyDebtService,
          minDscr: 1.5,
          monthlyOwnerWithdrawals,
          monthlyMaintenanceCapex,
          baselineCfadsMonthly: repayment?.cfads ?? 0,
        })
      : [];

  /* ---------------- Routing ---------------- */
  const routing = routeApplication(workflow, {
    postTransactionGroupExposure: groupExposure.postTransactionGroupExposure,
    requestedAmount: application.requestedStructure.amount,
    eligibleCollateralCoverage: collateral.eligibleCoverage,
    bureauGrade: bureauRating.grade,
    finalInternalGrade: rating.finalGrade,
    isWorstRating: rating.isWorstRating,
    stopFactorCount: activeStopFactors.length,
    policyExceptionCount: policyEvaluation.exceptions.length,
    product: structure.product,
    segment: rating.segment,
    preScreenRejected: preScreenResult.outcome === 'REJECT',
    underwriterAssessmentNegative:
      application.underwriterRecommendation?.decision === 'DECLINE' || legacy.globalStopTriggered,
  });

  /* ---------------- Findings & commentary ---------------- */
  const ratioTrend: Array<{ metric: ExplainedMetric; previous: number | null }> = Object.values(ratios).map((m) => ({
    metric: m,
    previous: previousRatios[m.key]?.value ?? null,
  }));

  const findings: Finding[] = generateFindings({
    crossChecks,
    policyOutcomes: policyEvaluation.outcomes,
    refinancing,
    repayment,
    dataQuality,
    stopFactors,
    purposeLines: application.purposeLines,
    requestedAmount: application.requestedStructure.amount,
    ratioTrend,
    manual: application.manualFindings,
  });

  const commentary = generateCommentary({
    ratios,
    previousRatios: Object.fromEntries(Object.entries(previousRatios).map(([k, v]) => [k, v.value])),
    salesGrowthPct:
      previousIncome && previousIncome.sales > 0 && income
        ? income.sales / previousIncome.sales - 1
        : null,
    ebitdaGrowthPct:
      previousIncome && previousIncome.ebitda > 0 && income
        ? income.ebitda / previousIncome.ebitda - 1
        : null,
    repayment,
    crossChecks,
    refinancing,
  });

  return {
    lens,
    periods,
    primaryPeriod: primary,
    previousPeriod: previous,
    balance,
    income,
    cash,
    previousBalance,
    previousIncome,
    ratios,
    previousRatios,
    altman,
    crossChecks,
    bureauSummary,
    refinancing,
    debtBurden: burden,
    groupExposure,
    collateral,
    forecast,
    forecastAssumptions,
    repayment,
    breakEven,
    proposedMonthlyPayment,
    postTransactionMonthlyDebtService,
    debtBeingClosed,
    maxLoan,
    stress,
    bureauRating,
    preScreen: preScreenResult,
    rating,
    legacy,
    policy: policyEvaluation,
    stopFactors,
    activeStopFactors,
    dataQuality,
    routing,
    findings,
    commentary,
    versions: {
      workflow: workflow.id,
      workflowLabel: workflow.label,
      workflowStatus: workflow.status,
      scorecard: businessScorecard.id,
      legacyScorecard: legacyScorecard.id,
      policy: policy.id,
      acbScale: acbScale.id,
      notching: notching.id,
      worstRating: WORST_RATING_V1.id,
    },
  };
}

function monthlyInterestOf(summary: { totalDebt: number }): number {
  // Interest embedded in the observed monthly service, at an indicative rate.
  const ASSUMED_ANNUAL_RATE = 0.18;
  return (summary.totalDebt * ASSUMED_ANNUAL_RATE) / 12;
}

function nextMonth(date: string): string {
  const d = new Date(date);
  d.setUTCMonth(d.getUTCMonth() + 1);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}
