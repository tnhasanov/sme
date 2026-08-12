import { safeDiv } from '@/types/core';
import type { IncomeStatementTotals } from '@/types/financials';
import type { ForecastAssumptions } from './forecast';
import { buildForecast } from './forecast';

/**
 * Stress testing (§35).
 *
 * Three named scenarios shift a common set of drivers. Each scenario is
 * re-run through the same forecast engine as the base case, so the numbers
 * are comparable by construction rather than by convention.
 */

export type ScenarioKey = 'BASE' | 'DOWNSIDE' | 'SEVERE';

export interface ScenarioDrivers {
  revenueChangePct: number;
  grossMarginChangePp: number;
  receivableDaysChange: number;
  inventoryDaysChange: number;
  fxChangePct: number;
  interestRateChangePp: number;
  capexChangePct: number;
}

export interface ScenarioDefinition {
  key: ScenarioKey;
  labelAz: string;
  labelEn: string;
  drivers: ScenarioDrivers;
}

export const DEFAULT_SCENARIOS: ScenarioDefinition[] = [
  {
    key: 'BASE',
    labelAz: 'Baza ssenarisi',
    labelEn: 'Base case',
    drivers: {
      revenueChangePct: 0,
      grossMarginChangePp: 0,
      receivableDaysChange: 0,
      inventoryDaysChange: 0,
      fxChangePct: 0,
      interestRateChangePp: 0,
      capexChangePct: 0,
    },
  },
  {
    key: 'DOWNSIDE',
    labelAz: 'Mənfi ssenari',
    labelEn: 'Downside',
    drivers: {
      revenueChangePct: -0.15,
      grossMarginChangePp: -0.03,
      receivableDaysChange: 15,
      inventoryDaysChange: 15,
      fxChangePct: 0.1,
      interestRateChangePp: 2,
      capexChangePct: 0,
    },
  },
  {
    key: 'SEVERE',
    labelAz: 'Kəskin mənfi ssenari',
    labelEn: 'Severe downside',
    drivers: {
      revenueChangePct: -0.3,
      grossMarginChangePp: -0.06,
      receivableDaysChange: 30,
      inventoryDaysChange: 30,
      fxChangePct: 0.25,
      interestRateChangePp: 4,
      capexChangePct: 0,
    },
  },
];

export interface ScenarioResult {
  scenario: ScenarioDefinition;
  ebitda: number;
  ebitdaMargin: number | null;
  cfadsMonthly: number;
  dscr: number | null;
  debtToEbitda: number | null;
  minimumCash: number;
  negativeMonths: number;
  repaymentCapacityMonthly: number;
  breaches: string[];
}

export interface StressInput {
  income: IncomeStatementTotals;
  monthsCovered: number;
  totalBankDebt: number;
  forecast: ForecastAssumptions;
  postTransactionMonthlyDebtService: number;
  minDscr: number;
  monthlyOwnerWithdrawals: number;
  monthlyMaintenanceCapex: number;
  /**
   * The CFADS the repayment-capacity engine actually reported. Scenarios move
   * away from this baseline rather than re-deriving cash from EBITDA, so the
   * base case agrees with the headline metric instead of quietly contradicting
   * it — which is the difference between a stress table an underwriter trusts
   * and one they have to reconcile by hand.
   */
  baselineCfadsMonthly: number;
}

export function runScenario(input: StressInput, scenario: ScenarioDefinition): ScenarioResult {
  const d = scenario.drivers;
  const m = input.monthsCovered || 12;

  const sales = input.income.sales * (1 + d.revenueChangePct);
  const baseMargin = safeDiv(input.income.grossProfit, input.income.sales) ?? 0;
  const margin = Math.max(baseMargin + d.grossMarginChangePp, 0);
  const grossProfit = sales * margin;
  const ebitda = grossProfit - input.income.operatingExpenses;

  // Extra working capital tied up by slower collection and slower stock turn.
  const dailySales = sales / 360;
  const dailyCogs = (sales - grossProfit) / 360;
  const extraWorkingCapital = d.receivableDaysChange * dailySales + d.inventoryDaysChange * dailyCogs;

  const interestUplift = (input.totalBankDebt * (d.interestRateChangePp / 100)) / 12;

  const forecast = buildForecast({
    ...input.forecast,
    monthlySalesReceipts: input.forecast.monthlySalesReceipts * (1 + d.revenueChangePct),
    cogsRatio: Math.min(Math.max(1 - margin, 0), 1),
    existingMonthlyInterest: input.forecast.existingMonthlyInterest + interestUplift,
  });

  // Shift the observed baseline by the scenario's EBITDA movement and the
  // extra working capital the slower cycle ties up.
  const ebitdaDeltaMonthly = (ebitda - input.income.ebitda) / m;
  const cfadsMonthly = input.baselineCfadsMonthly + ebitdaDeltaMonthly - extraWorkingCapital / 12;

  const debtService = input.postTransactionMonthlyDebtService + interestUplift;
  const dscr = safeDiv(cfadsMonthly, debtService);
  const debtToEbitda = safeDiv(input.totalBankDebt, (ebitda / m) * 12);

  const breaches: string[] = [];
  if (dscr !== null && dscr < input.minDscr) {
    breaches.push(`DSCR ${dscr.toFixed(2)}x — norma ${input.minDscr.toFixed(2)}x pozulur`);
  }
  if (forecast.negativeMonths > 0) {
    breaches.push(`${forecast.negativeMonths} ay üzrə mənfi nağd qalıq`);
  }
  if (cfadsMonthly < debtService) {
    breaches.push('Aylıq pul axını borc xidmətini örtmür');
  }

  return {
    scenario,
    ebitda,
    ebitdaMargin: safeDiv(ebitda, sales),
    cfadsMonthly,
    dscr,
    debtToEbitda,
    minimumCash: forecast.minimumCash,
    negativeMonths: forecast.negativeMonths,
    repaymentCapacityMonthly: cfadsMonthly,
    breaches,
  };
}

export function runStressTest(
  input: StressInput,
  scenarios: ScenarioDefinition[] = DEFAULT_SCENARIOS,
): ScenarioResult[] {
  return scenarios.map((s) => runScenario(input, s));
}
