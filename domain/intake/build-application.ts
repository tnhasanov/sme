import type { CreditApplication, Customer, LoanStructure } from '@/types/application';
import type { BalanceSheet, CashFlowStatement, FinancialPeriod, IncomeStatement } from '@/types/financials';
import { tv, type EvidenceStatus, type TracedValue } from '@/types/core';
import type { BalanceField, CashFlowField, IncomeField } from './labels';
import {
  PARSED_SOURCE_TYPE,
  collapseByField,
  evidenceForConfidence,
  type DetectedPeriod,
  type ParseResult,
} from './workbook-parser';

/**
 * Turns a parsed workbook plus the analyst's manual inputs into a complete
 * `CreditApplication`, so the existing assessment engine can run over uploaded
 * data exactly as it does over seeded data — one code path, one set of results.
 */

export interface IntakeCustomerInput {
  legalName: string;
  customerType: Customer['customerType'];
  legalForm: Customer['legalForm'];
  taxId: string;
  sector: string;
  subSector: string;
  region: string;
  employees: number;
  officialActivityYears: number;
  unofficialActivityYears: number;
  businessModel: string;
  seasonality: string;
}

export interface IntakeLoanInput extends LoanStructure {
  purposeSummary: string;
  primaryRepaymentSource: string;
  secondaryRepaymentSource: string;
  branch: string;
  rm: string;
}

export interface IntakeBureauInput {
  acbMicroScore: number | null;
  individualBureauRating: string | null;
  totalDebt: number;
  monthlyDebtService: number;
  activeFacilityCount: number;
  maxDpd: number;
  currentDpd: number;
  dpd30PlusEvents: number;
  externalGroupExposure: number;
  atbExposure: number;
  debtBeingRefinanced: number;
  extractsObtainedForAllParties: boolean;
}

export interface IntakeCollateralInput {
  marketValue: number;
  forcedSaleValue: number;
  type: string;
  ownerIsShareholder: boolean;
  registered: boolean;
  insured: boolean;
}

/** Per-field overrides the analyst typed in the correction grid. */
export type FieldOverrides = Record<string, number>;

export interface BuildIntakeInput {
  parse: ParseResult;
  /** Period column indices the analyst chose to import, oldest first. */
  selectedPeriodColumns: number[];
  primaryPeriodColumn: number;
  customer: IntakeCustomerInput;
  loan: IntakeLoanInput;
  bureau: IntakeBureauInput;
  collateral: IntakeCollateralInput | null;
  overrides?: {
    balance?: Record<number, Partial<Record<BalanceField, number>>>;
    income?: Record<number, Partial<Record<IncomeField, number>>>;
    cashFlow?: Record<number, Partial<Record<CashFlowField, number>>>;
  };
  now?: string;
}

let counter = 0;
const nextId = (prefix: string) => `${prefix}-in-${(counter += 1).toString(36)}`;

function traced(value: number, confidence: number, override: boolean): TracedValue {
  const evidence: EvidenceStatus = override ? 'ANALYST_ESTIMATE' : evidenceForConfidence(confidence);
  return tv(value, override ? 'ANALYST_CALCULATION' : PARSED_SOURCE_TYPE, evidence, {
    note: override ? 'Analitik tərəfindən əl ilə düzəldilib' : 'Yüklənmiş iş kitabından oxunub',
  });
}

function periodLabelFor(p: DetectedPeriod | undefined, index: number): string {
  if (!p) return `Dövr ${index + 1}`;
  return p.label.trim() || (p.year ? String(p.year) : `Dövr ${index + 1}`);
}

export interface BuiltIntake {
  customer: Customer;
  application: CreditApplication;
  /** Fields the parser could not fill, so the UI can demand them. */
  missingFields: string[];
}

export function buildApplicationFromIntake(input: BuildIntakeInput): BuiltIntake {
  const now = input.now ?? new Date().toISOString();
  const today = now.slice(0, 10);
  const customerId = nextId('cust');
  const applicationId = nextId('app');
  const missingFields: string[] = [];

  /* ---------------- Periods ---------------- */
  const allPeriods = input.parse.balance?.periods ?? input.parse.income?.periods ?? [];
  const chosen = input.selectedPeriodColumns
    .map((col) => allPeriods.find((p) => p.columnIndex === col))
    .filter((p): p is DetectedPeriod => !!p)
    .sort((a, b) => (a.year ?? 0) - (b.year ?? 0));

  const periods: FinancialPeriod[] = chosen.map((p, i) => {
    const year = p.year ?? new Date(today).getFullYear() - (chosen.length - 1 - i);
    return {
      id: `per-${p.columnIndex}`,
      applicationId,
      label: periodLabelFor(p, i),
      year,
      periodType: p.isForecast ? 'FORECAST' : p.monthsCovered < 12 ? 'YTD' : 'HISTORICAL',
      startDate: `${year}-01-01`,
      endDate: p.monthsCovered < 12 ? `${year}-${String(p.monthsCovered).padStart(2, '0')}-28` : `${year}-12-31`,
      monthsCovered: p.monthsCovered,
      isPrimary: p.columnIndex === input.primaryPeriodColumn,
    };
  });

  if (periods.length === 0) missingFields.push('Maliyyə dövrü seçilməyib');
  if (!periods.some((p) => p.isPrimary) && periods.length > 0) {
    periods[periods.length - 1].isPrimary = true;
  }

  /* ---------------- Statements ---------------- */
  const balanceSheets: BalanceSheet[] = [];
  const incomeStatements: IncomeStatement[] = [];
  const cashFlows: CashFlowStatement[] = [];

  for (const p of chosen) {
    const periodId = `per-${p.columnIndex}`;

    const bs = collapseByField<BalanceField>(input.parse.balance, p.columnIndex);
    const bsOverride = input.overrides?.balance?.[p.columnIndex] ?? {};
    const bField = (f: BalanceField): TracedValue => {
      const o = bsOverride[f];
      if (o !== undefined) return traced(o, 1, true);
      const hit = bs[f];
      return hit ? traced(hit.value, hit.confidence, false) : traced(0, 0.4, false);
    };

    balanceSheets.push({
      periodId,
      cash: bField('cash'),
      receivables: bField('receivables'),
      inventory: bField('inventory'),
      otherCurrentAssets: bField('otherCurrentAssets'),
      fixedAssets: bField('fixedAssets'),
      otherNonCurrentAssets: bField('otherNonCurrentAssets'),
      shortTermBankDebt: bField('shortTermBankDebt'),
      payables: bField('payables'),
      otherCurrentLiabilities: bField('otherCurrentLiabilities'),
      longTermBankDebt: bField('longTermBankDebt'),
      otherLiabilities: bField('otherLiabilities'),
      shareCapital: bField('shareCapital'),
      retainedEarnings: bField('retainedEarnings'),
      ownerContributions: bField('ownerContributions'),
      ownerWithdrawals: bField('ownerWithdrawals'),
      otherEquity: bField('otherEquity'),
    });

    const is = collapseByField<IncomeField>(input.parse.income, p.columnIndex);
    const isOverride = input.overrides?.income?.[p.columnIndex] ?? {};
    const iField = (f: IncomeField): TracedValue => {
      const o = isOverride[f];
      if (o !== undefined) return traced(o, 1, true);
      const hit = is[f];
      return hit ? traced(hit.value, hit.confidence, false) : traced(0, 0.4, false);
    };

    incomeStatements.push({
      periodId,
      sales: iField('sales'),
      cogs: iField('cogs'),
      operatingExpenses: iField('operatingExpenses'),
      depreciation: iField('depreciation'),
      interestExpense: iField('interestExpense'),
      otherIncome: iField('otherIncome'),
      otherExpenses: iField('otherExpenses'),
      tax: iField('tax'),
    });

    const cf = collapseByField<CashFlowField>(input.parse.cashFlow, p.columnIndex);
    const cfOverride = input.overrides?.cashFlow?.[p.columnIndex] ?? {};
    const hasCashData = Object.keys(cf).length > 0 || Object.keys(cfOverride).length > 0;
    if (!hasCashData) continue;

    const cField = (f: CashFlowField): TracedValue => {
      const o = cfOverride[f];
      if (o !== undefined) return traced(o, 1, true);
      const hit = cf[f];
      return hit ? traced(hit.value, hit.confidence, false) : traced(0, 0.4, false);
    };

    cashFlows.push({
      periodId,
      openingCash: cField('openingCash'),
      customerReceipts: cField('customerReceipts'),
      supplierPayments: cField('supplierPayments'),
      payroll: cField('payroll'),
      rent: cField('rent'),
      taxPaid: cField('taxPaid'),
      otherOperatingExpenses: cField('otherOperatingExpenses'),
      capex: cField('capex'),
      ownerInjection: cField('ownerInjection'),
      ownerWithdrawal: cField('ownerWithdrawal'),
      newBorrowing: cField('newBorrowing'),
      principalRepaid: cField('principalRepaid'),
      interestPaid: cField('interestPaid'),
    });
  }

  if (cashFlows.length === 0) {
    missingFields.push('Pul axını məlumatı oxunmadı — ödəmə qabiliyyəti MZH əsasında hesablanacaq');
  }

  /* ---------------- Customer ---------------- */
  const customer: Customer = {
    id: customerId,
    legalName: input.customer.legalName,
    displayName: input.customer.legalName,
    customerType: input.customer.customerType,
    legalForm: input.customer.legalForm,
    taxId: input.customer.taxId,
    registrationDate: `${new Date(today).getFullYear() - input.customer.officialActivityYears}-01-01`,
    activityStartDate: `${new Date(today).getFullYear() - Math.max(input.customer.officialActivityYears, input.customer.unofficialActivityYears)}-01-01`,
    officialActivityYears: input.customer.officialActivityYears,
    unofficialActivityYears: input.customer.unofficialActivityYears,
    address: '—',
    region: input.customer.region,
    sector: input.customer.sector,
    subSector: input.customer.subSector,
    businessModel: input.customer.businessModel,
    products: [],
    geography: input.customer.region,
    locations: 1,
    employees: input.customer.employees,
    keyCustomers: [],
    keySuppliers: [],
    seasonality: input.customer.seasonality,
    seasonalityIndex: new Array(12).fill(1),
    shareholders: [],
    management: [],
  };

  /* ---------------- Bureau ---------------- */
  const b = input.bureau;
  const facilities = b.activeFacilityCount > 0
    ? [
        {
          id: nextId('fac'),
          subjectName: input.customer.legalName,
          lender: 'Cəmi (AKB xülasəsi)',
          isAtb: false,
          product: 'Mövcud bank öhdəlikləri',
          originalAmount: b.totalDebt,
          outstanding: b.totalDebt,
          currency: input.loan.currency,
          issueDate: `${new Date(today).getFullYear() - 2}-01-01`,
          maturityDate: `${new Date(today).getFullYear() + 2}-01-01`,
          monthlyPayment: b.monthlyDebtService,
          currentDpd: b.currentDpd,
          maxDpd: b.maxDpd,
          dpd30PlusEvents: b.dpd30PlusEvents,
          status: 'ACTIVE' as const,
        },
      ]
    : [];

  const application: CreditApplication = {
    id: applicationId,
    reference: `KOB-${today.slice(0, 7).replace('-', '-')}-INT`,
    customerId,
    applicationDate: today,
    branch: input.loan.branch,
    rm: input.loan.rm,
    channel: 'BRANCH',
    stage: 'UNDERWRITING',

    requestedStructure: {
      amount: input.loan.amount,
      currency: input.loan.currency,
      tenorMonths: input.loan.tenorMonths,
      gracePeriodMonths: input.loan.gracePeriodMonths,
      annualRatePct: input.loan.annualRatePct,
      commissionPct: input.loan.commissionPct,
      repaymentFrequency: input.loan.repaymentFrequency,
      amortisation: input.loan.amortisation,
      product: input.loan.product,
    },

    purposeSummary: input.loan.purposeSummary,
    purposeLines: [
      {
        id: nextId('pur'),
        category: b.debtBeingRefinanced > 0 ? 'REFINANCE_OTHER_BANK' : 'WORKING_CAPITAL',
        description: input.loan.purposeSummary || 'Dövriyyə vəsaiti',
        amount: input.loan.amount,
        evidence: 'PARTIALLY_VERIFIED',
        businessBenefit: '—',
        controlMechanism: '—',
      },
    ],
    primaryRepaymentSource: input.loan.primaryRepaymentSource,
    secondaryRepaymentSource: input.loan.secondaryRepaymentSource,

    groupMembers: [
      {
        id: nextId('grp'),
        name: input.customer.legalName,
        relationship: 'SELF',
        atbExposure: b.atbExposure,
        externalExposure: b.externalGroupExposure,
        requestedExposure: input.loan.amount,
        guaranteesGiven: 0,
        includeInGroup: true,
      },
    ],

    bureauReports: [
      {
        id: nextId('akb'),
        applicationId,
        subjectName: input.customer.legalName,
        inquiryDate: today,
        reportReference: 'Yüklənmiş AKB xülasəsi',
        acbMicroScore: b.acbMicroScore,
        individualBureauRating: b.individualBureauRating ?? undefined,
        facilities,
        guarantees: [],
        inquiries: [],
      },
    ],

    collateral: input.collateral
      ? [
          {
            id: nextId('col'),
            type: input.collateral.type as never,
            description: 'Yüklənmiş girov məlumatı',
            ownerName: input.collateral.ownerIsShareholder ? 'Təsisçi' : 'Üçüncü şəxs',
            ownerRelationship: input.collateral.ownerIsShareholder ? 'SHAREHOLDER' : 'ECONOMICALLY_RELATED',
            marketValue: input.collateral.marketValue,
            forcedSaleValue: input.collateral.forcedSaleValue,
            lienRanking: 1,
            existingLienAmount: 0,
            valuationDate: today,
            appraiser: '—',
            insured: input.collateral.insured,
            registered: input.collateral.registered,
            evidence: 'PARTIALLY_VERIFIED',
            currency: input.loan.currency,
          },
        ]
      : [],

    documents: [],
    periods,
    balanceSheets,
    incomeStatements,
    cashFlows,
    adjustments: [],
    turnover: [],

    workflowVersion: 'PROMETEIA_PROPOSED_V2',
    scorecardVersion: 'PROMETEIA_QUICK_WIN_V1',
    legacyScorecardVersion: 'ATB_YEKUN_REY_V1',
    policyVersion: 'ATB_POLICY_V1',

    policyExceptions: [],
    manualFindings: [],
    riskMitigants: [],
    covenants: [],
    conditions: [],

    pipeline: {
      receivedAt: now,
      assignedToUwAt: now,
      returnCount: 0,
      missingDocuments: [],
    },
    auditTrail: [
      {
        id: nextId('aud'),
        applicationId,
        entity: 'CreditApplication',
        field: 'intake',
        oldValue: null,
        newValue: input.parse.fileName,
        user: 'KOB analitik',
        role: 'SME_ANALYST',
        reason: 'Maliyyə faylı yükləndi və avtomatik oxundu',
        timestamp: now,
        category: 'DATA_ENTRY',
      },
    ],
  };

  if (!b.extractsObtainedForAllParties) {
    missingFields.push('Əlaqəli şəxslər üzrə AKB çıxarışları tam deyil — stop faktor riski');
  }

  return { customer, application, missingFields };
}
