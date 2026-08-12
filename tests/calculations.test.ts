import { describe, expect, it } from 'vitest';
import { tv } from '@/types/core';
import { balanceTotals, cashFlowTotals, incomeTotals, periodDscr } from '@/domain/calculations/statements';
import { computeRatios } from '@/domain/calculations/ratios';
import { ALTMAN_VARIANTS, altmanZone, computeAltman } from '@/domain/calculations/altman';
import {
  annuityPayment,
  buildSchedule,
  loanFromPayment,
  maxSustainableLoan,
  steadyStateMonthlyPayment,
} from '@/domain/calculations/amortisation';
import { computeRepaymentCapacity } from '@/domain/calculations/repayment-capacity';
import { computeCollateralCoverage } from '@/domain/calculations/collateral';
import { analyseRefinancing } from '@/domain/calculations/bureau';
import { COLLATERAL_HAIRCUTS_V1 } from '@/config/policy';
import type { BalanceSheet, CashFlowStatement, IncomeStatement } from '@/types/financials';
import type { CreditFacility } from '@/types/application';

const balance = (over: Partial<Record<keyof BalanceSheet, number>> = {}): BalanceSheet => {
  const base: Record<string, number> = {
    cash: 100,
    receivables: 400,
    inventory: 500,
    otherCurrentAssets: 0,
    fixedAssets: 1000,
    otherNonCurrentAssets: 0,
    shortTermBankDebt: 300,
    payables: 200,
    otherCurrentLiabilities: 0,
    longTermBankDebt: 400,
    otherLiabilities: 0,
    shareCapital: 500,
    retainedEarnings: 600,
    ownerContributions: 0,
    ownerWithdrawals: 0,
    otherEquity: 0,
    ...over,
  };
  const out: Record<string, unknown> = { periodId: 'p1' };
  for (const [k, v] of Object.entries(base)) out[k] = tv(v);
  return out as unknown as BalanceSheet;
};

const income = (over: Partial<Record<keyof IncomeStatement, number>> = {}): IncomeStatement => {
  const base: Record<string, number> = {
    sales: 2000,
    cogs: 1400,
    operatingExpenses: 300,
    depreciation: 50,
    interestExpense: 60,
    otherIncome: 0,
    otherExpenses: 0,
    tax: 30,
    ...over,
  };
  const out: Record<string, unknown> = { periodId: 'p1' };
  for (const [k, v] of Object.entries(base)) out[k] = tv(v);
  return out as unknown as IncomeStatement;
};

const cashFlow = (over: Partial<Record<keyof CashFlowStatement, number>> = {}): CashFlowStatement => {
  const base: Record<string, number> = {
    openingCash: 100,
    customerReceipts: 1900,
    supplierPayments: 1300,
    payroll: 150,
    rent: 50,
    taxPaid: 30,
    otherOperatingExpenses: 100,
    capex: 80,
    ownerInjection: 0,
    ownerWithdrawal: 40,
    newBorrowing: 0,
    principalRepaid: 120,
    interestPaid: 60,
    ...over,
  };
  const out: Record<string, unknown> = { periodId: 'p1' };
  for (const [k, v] of Object.entries(base)) out[k] = tv(v);
  return out as unknown as CashFlowStatement;
};

describe('statement roll-ups', () => {
  it('sums the balance sheet and reports the balancing difference', () => {
    const t = balanceTotals(balance());
    expect(t.currentAssets).toBe(1000);
    expect(t.totalAssets).toBe(2000);
    expect(t.currentLiabilities).toBe(500);
    expect(t.totalLiabilities).toBe(900);
    expect(t.totalEquity).toBe(1100);
    expect(t.totalBankDebt).toBe(700);
    expect(t.workingCapital).toBe(500);
    expect(t.balanceCheck).toBe(0);
  });

  it('flags an unbalanced sheet instead of silently absorbing it', () => {
    const t = balanceTotals(balance({ cash: 250 }));
    expect(t.balanceCheck).toBe(150);
  });

  it('derives the income statement waterfall', () => {
    const t = incomeTotals(income());
    expect(t.grossProfit).toBe(600);
    expect(t.ebitda).toBe(300);
    expect(t.ebit).toBe(250);
    expect(t.profitBeforeTax).toBe(190);
    expect(t.netProfit).toBe(160);
    expect(t.grossMargin).toBeCloseTo(0.3, 10);
  });

  it('excludes owner withdrawals from operating cash flow', () => {
    const t = cashFlowTotals(cashFlow());
    // 1900 receipts − (1300+150+50+30+100) outflow − 60 interest
    expect(t.netOperatingCashFlow).toBe(210);
    expect(t.investingCashFlow).toBe(-80);
    expect(t.financingCashFlow).toBe(-160);
    expect(t.endingCash).toBe(70);
  });

  it('computes DSCR by adding interest back to operating cash flow', () => {
    // (210 + 60) / (60 + 120)
    expect(periodDscr(cashFlow())).toBeCloseTo(1.5, 10);
  });

  it('returns null DSCR when there is no debt service', () => {
    expect(periodDscr(cashFlow({ principalRepaid: 0, interestPaid: 0 }))).toBeNull();
  });
});

describe('ratio engine', () => {
  const ctx = {
    balance: balanceTotals(balance()),
    income: incomeTotals(income()),
    cash: cashFlowTotals(cashFlow()),
    monthsCovered: 12,
    lens: 'ADJUSTED' as const,
    periodLabel: '2025',
    newLoanAmount: 500,
    debtBeingClosed: 100,
    annualDebtService: 180,
    annualInterest: 60,
  };

  it('computes liquidity ratios from the balance-sheet lines', () => {
    const r = computeRatios(ctx);
    expect(r.currentRatio.value).toBeCloseTo(2, 10);
    expect(r.quickRatio.value).toBeCloseTo(1, 10); // (1000 − 500) / 500
    expect(r.cashRatio.value).toBeCloseTo(0.2, 10);
  });

  it('includes the new facility and closures in the debt-to-equity stop-factor ratio', () => {
    const r = computeRatios(ctx);
    // (900 + 500 − 100) / 1100
    expect(r.debtToEquityInclNew.value).toBeCloseTo(1300 / 1100, 10);
    expect(r.debtToEquity.value).toBeCloseTo(900 / 1100, 10);
  });

  it('uses COGS, not sales, as the inventory-days denominator', () => {
    const r = computeRatios(ctx);
    expect(r.inventoryDays.value).toBeCloseTo((360 * 500) / 1400, 10);
    expect(r.receivableDays.value).toBeCloseTo((360 * 400) / 2000, 10);
  });

  it('annualises a part-year period before computing return ratios', () => {
    const halfYear = computeRatios({ ...ctx, monthsCovered: 6 });
    const fullYear = computeRatios(ctx);
    expect(halfYear.roa.value!).toBeCloseTo(fullYear.roa.value! * 2, 10);
  });

  it('carries formula, inputs and source on every metric so the UI can explain it', () => {
    const r = computeRatios(ctx);
    expect(r.currentRatio.formula).toContain('/');
    expect(r.currentRatio.inputs.length).toBeGreaterThan(0);
    expect(r.currentRatio.source).toBeTruthy();
    expect(r.currentRatio.period).toBe('2025');
  });

  it('returns null rather than Infinity when a denominator is zero', () => {
    const zeroEquity = computeRatios({ ...ctx, balance: balanceTotals(balance({ shareCapital: 0, retainedEarnings: 0 })) });
    expect(zeroEquity.roe.value).toBeNull();
  });
});

describe('Altman Z-score', () => {
  const inputs = {
    workingCapital: 500,
    retainedEarnings: 600,
    ebit: 250,
    equity: 1100,
    totalLiabilities: 900,
    sales: 2000,
    totalAssets: 2000,
  };

  it('applies the private-firm coefficients from the source workbook', () => {
    const r = computeAltman(inputs, 'PRIVATE');
    const expected =
      0.717 * 0.25 + 0.847 * 0.3 + 3.107 * 0.125 + 0.42 * (1100 / 900) + 0.998 * 1;
    expect(r.z!).toBeCloseTo(expected, 10);
  });

  it('omits X5 and adds the constant for the emerging-markets variant', () => {
    const r = computeAltman(inputs, 'EMERGING');
    expect(r.x5).toBeNull();
    expect(r.terms.some((t) => t.key === 'x5')).toBe(false);
    expect(r.z!).toBeCloseTo(
      3.25 + 6.56 * 0.25 + 3.26 * 0.3 + 6.72 * 0.125 + 1.05 * (1100 / 900),
      10,
    );
  });

  it('treats an exact zone boundary as grey by default', () => {
    const cfg = ALTMAN_VARIANTS.PRIVATE;
    expect(altmanZone(1.23, cfg)).toBe('GREY');
    expect(altmanZone(2.9, cfg)).toBe('GREY');
    expect(altmanZone(1.2299, cfg)).toBe('HIGH_RISK');
    expect(altmanZone(2.9001, cfg)).toBe('LOW_RISK');
  });

  it('honours a configured boundary preference', () => {
    const cfg = ALTMAN_VARIANTS.PRIVATE;
    expect(altmanZone(2.9, cfg, 'HIGH_SIDE')).toBe('LOW_RISK');
    expect(altmanZone(1.23, cfg, 'LOW_SIDE')).toBe('HIGH_RISK');
  });

  it('returns no score when an input cannot be computed', () => {
    const r = computeAltman({ ...inputs, totalAssets: 0 }, 'PRIVATE');
    expect(r.z).toBeNull();
    expect(r.zone).toBeNull();
  });
});

describe('amortisation and loan sizing', () => {
  it('matches the Excel PMT annuity', () => {
    // PMT(0.18/12, 36, -100000) = 3615.24
    expect(annuityPayment(100_000, 18, 36)).toBeCloseTo(3615.24, 1);
  });

  it('inverts cleanly: loanFromPayment(annuityPayment(x)) === x', () => {
    const loan = 250_000;
    const payment = annuityPayment(loan, 16.5, 48);
    expect(loanFromPayment(payment, 16.5, 48)).toBeCloseTo(loan, 6);
  });

  it('charges interest only during the grace period and amortises after it', () => {
    const s = buildSchedule({
      amount: 120_000,
      currency: 'AZN',
      tenorMonths: 24,
      gracePeriodMonths: 6,
      annualRatePct: 12,
      commissionPct: 0,
      repaymentFrequency: 'MONTHLY',
      amortisation: 'ANNUITY',
      product: 'WORKING_CAPITAL_LOAN',
    });
    expect(s.rows).toHaveLength(24);
    expect(s.rows.slice(0, 6).every((r) => r.isGrace && r.principal === 0)).toBe(true);
    expect(s.rows[6].principal).toBeGreaterThan(0);
    expect(s.rows.at(-1)!.closingBalance).toBeCloseTo(0, 4);
  });

  it('repays a bullet loan only at maturity', () => {
    const s = buildSchedule({
      amount: 50_000,
      currency: 'AZN',
      tenorMonths: 12,
      gracePeriodMonths: 0,
      annualRatePct: 15,
      commissionPct: 0,
      repaymentFrequency: 'BULLET',
      amortisation: 'BULLET',
      product: 'WORKING_CAPITAL_LOAN',
    });
    expect(s.rows.slice(0, 11).every((r) => r.principal === 0)).toBe(true);
    expect(s.rows[11].principal).toBeCloseTo(50_000, 4);
  });

  it('excludes grace months from the representative monthly payment', () => {
    const structure = {
      amount: 100_000,
      currency: 'AZN' as const,
      tenorMonths: 24,
      gracePeriodMonths: 6,
      annualRatePct: 18,
      commissionPct: 0,
      repaymentFrequency: 'MONTHLY' as const,
      amortisation: 'ANNUITY' as const,
      product: 'WORKING_CAPITAL_LOAN' as const,
    };
    const steady = steadyStateMonthlyPayment(structure);
    const schedule = buildSchedule(structure);
    expect(steady).toBeGreaterThan(schedule.firstPayment);
  });

  it('sizes the maximum loan against total debt service, not incremental', () => {
    const r = maxSustainableLoan({
      cfadsMonthly: 30_000,
      existingMonthlyDebtService: 10_000,
      minDscr: 1.5,
      annualRatePct: 18,
      tenorMonths: 36,
      gracePeriodMonths: 0,
      amortisation: 'ANNUITY',
    });
    // 30000/1.5 = 20000 capacity for total service, less 10000 existing
    expect(r.maxSustainableMonthlyPayment).toBeCloseTo(10_000, 6);
    expect(r.maxSustainableLoan).toBeCloseTo(loanFromPayment(10_000, 18, 36), 6);
    expect(r.bindingConstraint).toBe('DSCR');
  });

  it('reports no capacity rather than a negative loan', () => {
    const r = maxSustainableLoan({
      cfadsMonthly: 10_000,
      existingMonthlyDebtService: 12_000,
      minDscr: 1.5,
      annualRatePct: 18,
      tenorMonths: 36,
      gracePeriodMonths: 0,
      amortisation: 'ANNUITY',
    });
    expect(r.maxSustainableLoan).toBe(0);
    expect(r.bindingConstraint).toBe('NO_CAPACITY');
  });
});

describe('repayment capacity', () => {
  const base = {
    income: incomeTotals(income()),
    monthsCovered: 12,
    monthlyOwnerWithdrawals: 0,
    monthlyMaintenanceCapex: 0,
    monthlyWorkingCapitalAbsorption: 100,
    monthlyRecurringObligations: 0,
    existingMonthlyDebtService: 10,
    monthlyDebtServiceBeingRefinanced: 4,
    proposedMonthlyDebtService: 8,
    monthlyInterestInCosts: 5,
    monthlyPrincipalInCosts: 5,
    monthlyPaymentsRemainingElsewhere: 6,
  };

  it('does not double-count working capital when a cash-flow statement exists', () => {
    const withCash = computeRepaymentCapacity({ ...base, cash: cashFlowTotals(cashFlow()) });
    const withoutCash = computeRepaymentCapacity(base);
    // The cash statement already embeds the working-capital movement.
    expect(withCash.cfads).toBeGreaterThan(withoutCash.cfads);
  });

  it('nets refinanced service out of the post-transaction debt service', () => {
    const r = computeRepaymentCapacity(base);
    expect(r.postTransactionDebtService).toBe(10 - 4 + 8);
  });

  it('reports no capacity as Infinity so a policy floor cannot silently pass', () => {
    const r = computeRepaymentCapacity({
      ...base,
      income: incomeTotals(income({ sales: 100, cogs: 500 })),
      monthlyPaymentsRemainingElsewhere: 1000,
    });
    expect(r.capacityAtb).toBeLessThanOrEqual(0);
    expect(r.paymentToCapacity).toBe(Number.POSITIVE_INFINITY);
    // A raw quotient here would be negative and would pass a "≤ 0.8" rule.
    expect((r.paymentToCapacity as number) <= 0.8).toBe(false);
  });
});

describe('collateral coverage', () => {
  const item = (over: Record<string, unknown> = {}) =>
    ({
      id: 'c1',
      type: 'REAL_ESTATE_COMMERCIAL',
      description: 'obyekt',
      ownerName: 'sahib',
      ownerRelationship: 'SELF',
      marketValue: 1000,
      forcedSaleValue: 800,
      lienRanking: 1,
      existingLienAmount: 0,
      valuationDate: '2026-01-01',
      appraiser: 'a',
      insured: true,
      registered: true,
      evidence: 'VERIFIED',
      currency: 'AZN',
      ...over,
    }) as never;

  it('applies the configured haircut and deducts prior liens', () => {
    const r = computeCollateralCoverage([item({ existingLienAmount: 100 })], 500, COLLATERAL_HAIRCUTS_V1);
    // 800 × (1 − 10%) − 100 = 620
    expect(r.totalEligibleValue).toBeCloseTo(620, 6);
    expect(r.eligibleCoverage).toBeCloseTo(620 / 500, 6);
  });

  it('excludes guarantees from eligible coverage but keeps them visible', () => {
    const r = computeCollateralCoverage(
      [item(), item({ id: 'c2', type: 'PERSONAL_GUARANTEE', marketValue: 5000, forcedSaleValue: 0 })],
      1000,
      COLLATERAL_HAIRCUTS_V1,
    );
    expect(r.totalEligibleValue).toBeCloseTo(720, 6);
    expect(r.guaranteeValue).toBe(5000);
  });

  it('treats unregistered collateral as ineligible with a stated reason', () => {
    const r = computeCollateralCoverage([item({ registered: false })], 500, COLLATERAL_HAIRCUTS_V1);
    expect(r.totalEligibleValue).toBe(0);
    expect(r.items[0].ineligibilityReason).toContain('qeydiyyat');
  });

  it('never reports negative unsecured exposure', () => {
    const r = computeCollateralCoverage([item()], 100, COLLATERAL_HAIRCUTS_V1);
    expect(r.unsecuredExposure).toBe(0);
    expect(r.securedExposure).toBe(100);
  });
});

describe('refinancing engine', () => {
  const facility = (over: Partial<CreditFacility>): CreditFacility =>
    ({
      id: over.id ?? 'f',
      subjectName: 'x',
      lender: 'Bank',
      isAtb: false,
      product: 'kredit',
      originalAmount: 100_000,
      outstanding: 0,
      currency: 'AZN',
      issueDate: '2023-01-01',
      maturityDate: '2026-01-01',
      monthlyPayment: 0,
      currentDpd: 0,
      maxDpd: 0,
      dpd30PlusEvents: 0,
      status: 'CLOSED',
      ...over,
    }) as CreditFacility;

  it('links a closure to a new loan issued within the refinance window', () => {
    const r = analyseRefinancing([
      facility({ id: 'old', originalAmount: 100_000, issueDate: '2023-01-01', maturityDate: '2026-01-01', closureDate: '2024-01-01' }),
      facility({
        id: 'new',
        originalAmount: 200_000,
        issueDate: '2024-01-10',
        maturityDate: '2027-01-10',
        outstanding: 180_000,
        status: 'ACTIVE',
      }),
    ]);
    const old = r.lifecycles.find((l) => l.facility.id === 'old')!;
    expect(old.refinancedByFacilityId).toBe('new');
    expect(old.gapDays).toBe(9);
    expect(old.cashOut).toBeGreaterThan(0);
  });

  it('does not link a closure to a loan issued far later', () => {
    const r = analyseRefinancing([
      facility({ id: 'old', closureDate: '2024-01-01' }),
      facility({ id: 'later', issueDate: '2025-06-01', maturityDate: '2028-06-01', outstanding: 90_000, status: 'ACTIVE' }),
    ]);
    expect(r.lifecycles.find((l) => l.facility.id === 'old')!.refinancedByFacilityId).toBeUndefined();
  });

  it('flags weak ordinary amortisation against the >50% benchmark', () => {
    const r = analyseRefinancing([
      facility({ id: 'a', originalAmount: 100_000, issueDate: '2024-01-01', maturityDate: '2034-01-01', closureDate: '2024-07-01' }),
    ]);
    expect(r.instalmentRepaymentShare!).toBeLessThan(0.5);
    expect(r.flags.some((f) => f.key === 'LOW_ORDINARY_AMORTISATION')).toBe(true);
  });

  it('does not call growing debt evergreening when amortisation is genuine', () => {
    const r = analyseRefinancing([
      facility({ id: 'a', originalAmount: 100_000, issueDate: '2020-01-01', maturityDate: '2023-01-01', closureDate: '2023-01-01' }),
      facility({
        id: 'b',
        originalAmount: 400_000,
        issueDate: '2023-02-01',
        maturityDate: '2028-02-01',
        outstanding: 300_000,
        status: 'ACTIVE',
      }),
    ]);
    expect(r.instalmentRepaymentShare!).toBeGreaterThan(0.5);
    expect(r.flags.some((f) => f.key === 'DEBT_EVERGREENING')).toBe(false);
  });
});
