import type { ExplainedMetric, FinancialLens } from '@/types/core';
import { safeDiv } from '@/types/core';
import type { BalanceSheetTotals, CashFlowTotals, IncomeStatementTotals } from '@/types/financials';

/**
 * Financial ratio engine (§25).
 *
 * Every ratio returns an ExplainedMetric so the UI can show formula, inputs
 * and source on click (§27 Explainability). Definitions follow the ATB
 * `Əmsallar` sheet; where the sheet's label and formula disagreed, the
 * formula won and the discrepancy is recorded in
 * /docs/underwriting-open-questions.md.
 */

export interface RatioContext {
  balance: BalanceSheetTotals;
  income: IncomeStatementTotals;
  cash?: CashFlowTotals;
  /** Annualisation factor when the period is shorter than 12 months. */
  monthsCovered: number;
  lens: FinancialLens;
  periodLabel: string;
  /** Post-transaction figures needed by the leverage / DSCR family. */
  newLoanAmount?: number;
  debtBeingClosed?: number;
  annualDebtService?: number;
  annualInterest?: number;
  /** Purchases for creditor-days; falls back to COGS when absent. */
  annualPurchases?: number;
  minForecastClosingCash?: number;
  forecastAnnualCashFlow?: number;
}

const DAYS_IN_YEAR = 360; // the workbook uses a 360-day convention throughout

function annualise(value: number, months: number): number {
  if (!months || months <= 0) return value;
  return (value / months) * 12;
}

function metric(
  key: string,
  label: string,
  labelEn: string,
  value: number | null,
  unit: ExplainedMetric['unit'],
  formula: string,
  inputs: Array<{ label: string; value: number }>,
  ctx: RatioContext,
  source = 'Əmsallar cədvəli',
): ExplainedMetric {
  return {
    key,
    label,
    labelEn,
    value,
    unit,
    formula,
    inputs,
    source,
    period: ctx.periodLabel,
    lens: ctx.lens,
  };
}

export function computeRatios(ctx: RatioContext): Record<string, ExplainedMetric> {
  const { balance: b, income: i, cash: c, monthsCovered } = ctx;

  const annualSales = annualise(i.sales, monthsCovered);
  const annualCogs = annualise(i.cogs, monthsCovered);
  const annualEbitda = annualise(i.ebitda, monthsCovered);
  const annualEbit = annualise(i.ebit, monthsCovered);
  const annualNetProfit = annualise(i.netProfit, monthsCovered);
  const annualInterest = ctx.annualInterest ?? annualise(i.interestExpense, monthsCovered);
  const purchases = ctx.annualPurchases ?? annualCogs;

  const out: Record<string, ExplainedMetric> = {};
  const add = (m: ExplainedMetric) => {
    out[m.key] = m;
  };

  /* -------------------- Profitability -------------------- */
  add(
    metric(
      'grossMargin',
      'Ümumi mənfəət marjası',
      'Gross Margin',
      safeDiv(i.grossProfit, i.sales),
      'PERCENT',
      'Ümumi mənfəət / Satış',
      [
        { label: 'Ümumi mənfəət', value: i.grossProfit },
        { label: 'Satış', value: i.sales },
      ],
      ctx,
      'MZH',
    ),
  );
  add(
    metric(
      'ebitdaMargin',
      'EBITDA marjası',
      'EBITDA Margin',
      safeDiv(i.ebitda, i.sales),
      'PERCENT',
      'EBITDA / Satış',
      [
        { label: 'EBITDA', value: i.ebitda },
        { label: 'Satış', value: i.sales },
      ],
      ctx,
      'MZH',
    ),
  );
  add(
    metric(
      'netMargin',
      'Xalis mənfəət marjası',
      'Net Profit Margin',
      safeDiv(i.netProfit, i.sales),
      'PERCENT',
      'Xalis mənfəət / Satış',
      [
        { label: 'Xalis mənfəət', value: i.netProfit },
        { label: 'Satış', value: i.sales },
      ],
      ctx,
      'MZH',
    ),
  );
  add(
    metric(
      'roa',
      'Aktivlərin mənfəətliliyi (ROA)',
      'Return on Assets',
      safeDiv(annualNetProfit, b.totalAssets),
      'PERCENT',
      'İllikləşdirilmiş xalis mənfəət / Cəmi aktivlər',
      [
        { label: 'İllik xalis mənfəət', value: annualNetProfit },
        { label: 'Cəmi aktivlər', value: b.totalAssets },
      ],
      ctx,
    ),
  );
  add(
    metric(
      'roe',
      'Kapitalın mənfəətliliyi (ROE)',
      'Return on Equity',
      safeDiv(annualNetProfit, b.totalEquity),
      'PERCENT',
      'İllikləşdirilmiş xalis mənfəət / Şəxsi kapital',
      [
        { label: 'İllik xalis mənfəət', value: annualNetProfit },
        { label: 'Şəxsi kapital', value: b.totalEquity },
      ],
      ctx,
    ),
  );

  /* -------------------- Liquidity -------------------- */
  add(
    metric(
      'currentRatio',
      'Cari likvidlik əmsalı',
      'Current Ratio',
      safeDiv(b.currentAssets, b.currentLiabilities),
      'TIMES',
      'Dövriyyə vəsaitləri / Qısa müddətli öhdəliklər',
      [
        { label: 'Dövriyyə vəsaitləri', value: b.currentAssets },
        { label: 'Qısa müddətli öhdəliklər', value: b.currentLiabilities },
      ],
      ctx,
      'Balans',
    ),
  );
  add(
    metric(
      'quickRatio',
      'Ani likvidlik əmsalı',
      'Quick Ratio',
      safeDiv(b.currentAssets - inventoryOf(b), b.currentLiabilities),
      'TIMES',
      '(Dövriyyə vəsaitləri − ehtiyatlar) / Qısa müddətli öhdəliklər',
      [
        { label: 'Dövriyyə vəsaitləri', value: b.currentAssets },
        { label: 'Ehtiyatlar', value: inventoryOf(b) },
        { label: 'Qısa müddətli öhdəliklər', value: b.currentLiabilities },
      ],
      ctx,
      'Balans',
    ),
  );
  add(
    metric(
      'cashRatio',
      'Nağd likvidlik əmsalı',
      'Cash Ratio',
      safeDiv(cashOf(b), b.currentLiabilities),
      'TIMES',
      'Likvid vəsaitlər / Qısa müddətli öhdəliklər',
      [
        { label: 'Likvid vəsaitlər', value: cashOf(b) },
        { label: 'Qısa müddətli öhdəliklər', value: b.currentLiabilities },
      ],
      ctx,
      'Balans',
    ),
  );

  /* -------------------- Leverage -------------------- */
  const debtInclNew = b.totalLiabilities + (ctx.newLoanAmount ?? 0) - (ctx.debtBeingClosed ?? 0);
  add(
    metric(
      'debtToEquityInclNew',
      'Kapitala nəzərən borclanma əmsalı',
      'Debt to Equity (incl. new facility)',
      safeDiv(debtInclNew, b.totalEquity),
      'TIMES',
      '(Cəmi öhdəliklər + veriləcək kredit − bağlanacaq öhdəliklər) / Şəxsi kapital',
      [
        { label: 'Cəmi öhdəliklər', value: b.totalLiabilities },
        { label: 'Veriləcək kredit', value: ctx.newLoanAmount ?? 0 },
        { label: 'Bağlanacaq öhdəliklər', value: ctx.debtBeingClosed ?? 0 },
        { label: 'Şəxsi kapital', value: b.totalEquity },
      ],
      ctx,
    ),
  );
  add(
    metric(
      'debtToEquity',
      'Öhdəliklərin kapitala nisbəti',
      'Debt to Equity',
      safeDiv(b.totalLiabilities, b.totalEquity),
      'TIMES',
      'Cəmi öhdəliklər / Şəxsi kapital',
      [
        { label: 'Cəmi öhdəliklər', value: b.totalLiabilities },
        { label: 'Şəxsi kapital', value: b.totalEquity },
      ],
      ctx,
    ),
  );
  add(
    metric(
      'leverage',
      'Aktivlərin kapitala nisbəti (Leverec)',
      'Leverage',
      safeDiv(b.totalAssets, b.totalEquity),
      'TIMES',
      'Cəmi aktivlər / Şəxsi kapital',
      [
        { label: 'Cəmi aktivlər', value: b.totalAssets },
        { label: 'Şəxsi kapital', value: b.totalEquity },
      ],
      ctx,
    ),
  );
  add(
    metric(
      'gearing',
      'Bank öhdəliklərinin kapitala nisbəti (Gearing)',
      'Gearing',
      safeDiv(b.totalBankDebt, b.totalEquity),
      'TIMES',
      'Bank öhdəlikləri / Şəxsi kapital',
      [
        { label: 'Bank öhdəlikləri', value: b.totalBankDebt },
        { label: 'Şəxsi kapital', value: b.totalEquity },
      ],
      ctx,
    ),
  );
  add(
    metric(
      'liabilitiesToAssets',
      'Öhdəliklərin aktivlərə nisbəti',
      'Liabilities / Assets',
      safeDiv(b.totalLiabilities, b.totalAssets),
      'PERCENT',
      'Cəmi öhdəliklər / Cəmi aktivlər',
      [
        { label: 'Cəmi öhdəliklər', value: b.totalLiabilities },
        { label: 'Cəmi aktivlər', value: b.totalAssets },
      ],
      ctx,
    ),
  );
  add(
    metric(
      'equityToAssets',
      'Kapitalın aktivlərə nisbəti',
      'Equity / Assets',
      safeDiv(b.totalEquity, b.totalAssets),
      'PERCENT',
      'Şəxsi kapital / Cəmi aktivlər',
      [
        { label: 'Şəxsi kapital', value: b.totalEquity },
        { label: 'Cəmi aktivlər', value: b.totalAssets },
      ],
      ctx,
    ),
  );
  add(
    metric(
      'debtToEbitda',
      'Borc / EBITDA',
      'Debt / EBITDA',
      safeDiv(b.totalBankDebt, annualEbitda),
      'TIMES',
      'Bank öhdəlikləri / İllikləşdirilmiş EBITDA',
      [
        { label: 'Bank öhdəlikləri', value: b.totalBankDebt },
        { label: 'İllik EBITDA', value: annualEbitda },
      ],
      ctx,
    ),
  );
  add(
    metric(
      'netDebtToEbitda',
      'Xalis borc / EBITDA',
      'Net Debt / EBITDA',
      safeDiv(b.netDebt, annualEbitda),
      'TIMES',
      '(Bank öhdəlikləri − likvid vəsaitlər) / İllikləşdirilmiş EBITDA',
      [
        { label: 'Xalis borc', value: b.netDebt },
        { label: 'İllik EBITDA', value: annualEbitda },
      ],
      ctx,
    ),
  );

  /* -------------------- Debt service -------------------- */
  if (c) {
    const ds = ctx.annualDebtService ?? 0;
    add(
      metric(
        'dscrCurrent',
        'Borcun ödənilmə əmsalı — cari',
        'DSCR — current',
        safeDiv(c.netOperatingCashFlow + annualInterest, annualInterest + Math.max(ds - annualInterest, 0)),
        'TIMES',
        '(Xalis əməliyyat pul axını + faizlər) / (faizlər + əsas borc ödənişi)',
        [
          { label: 'Xalis əməliyyat pul axını', value: c.netOperatingCashFlow },
          { label: 'İllik faiz', value: annualInterest },
          { label: 'İllik borc xidməti', value: ds },
        ],
        ctx,
        'Pul axını — cari',
      ),
    );
  }
  add(
    metric(
      'interestCoverage',
      'Faizlərin ödənilmə əmsalı',
      'Interest Coverage',
      safeDiv(annualEbit, annualInterest),
      'TIMES',
      'EBIT / Faiz xərcləri',
      [
        { label: 'EBIT', value: annualEbit },
        { label: 'Faiz xərcləri', value: annualInterest },
      ],
      ctx,
    ),
  );
  add(
    metric(
      'ebitdaToInterest',
      'EBITDA / Faiz',
      'EBITDA / Interest',
      safeDiv(annualEbitda, annualInterest),
      'TIMES',
      'EBITDA / Faiz xərcləri',
      [
        { label: 'EBITDA', value: annualEbitda },
        { label: 'Faiz xərcləri', value: annualInterest },
      ],
      ctx,
    ),
  );
  if (ctx.forecastAnnualCashFlow !== undefined) {
    add(
      metric(
        'cashCoverageOfBankDebt',
        'Öhdəliklərin nağd ödənə bilmə əmsalı',
        'Cash coverage of bank obligations',
        safeDiv(ctx.forecastAnnualCashFlow, b.totalBankDebt),
        'TIMES',
        'İllik cəmi pul axını / Bank öhdəlikləri',
        [
          { label: 'İllik pul axını', value: ctx.forecastAnnualCashFlow },
          { label: 'Bank öhdəlikləri', value: b.totalBankDebt },
        ],
        ctx,
        'Pul axını — proqnoz',
      ),
    );
  }
  if (ctx.minForecastClosingCash !== undefined) {
    add(
      metric(
        'minForecastClosingCash',
        'Sərbəst proqnoz pul axını (min aylıq qalıq)',
        'Minimum forecast monthly closing cash',
        ctx.minForecastClosingCash,
        'CURRENCY',
        'MIN(proqnoz aylıq son qalıqlar)',
        [{ label: 'Minimum aylıq qalıq', value: ctx.minForecastClosingCash }],
        ctx,
        'Pul axını — proqnoz',
      ),
    );
  }

  /* -------------------- Working capital & efficiency -------------------- */
  add(
    metric(
      'workingCapital',
      'İşlək kapital',
      'Working Capital',
      b.workingCapital,
      'CURRENCY',
      'Dövriyyə vəsaitləri − Qısa müddətli öhdəliklər',
      [
        { label: 'Dövriyyə vəsaitləri', value: b.currentAssets },
        { label: 'Qısa müddətli öhdəliklər', value: b.currentLiabilities },
      ],
      ctx,
      'Balans',
    ),
  );
  add(
    metric(
      'workingCapitalToSales',
      'İşlək kapitalın satışa nisbəti',
      'Working Capital / Sales',
      safeDiv(b.workingCapital, annualSales),
      'PERCENT',
      'İşlək kapital / İllik satış',
      [
        { label: 'İşlək kapital', value: b.workingCapital },
        { label: 'İllik satış', value: annualSales },
      ],
      ctx,
    ),
  );
  add(
    metric(
      'workingCapitalTurnover',
      'İşlək kapitalın dövretməsi',
      'Working Capital Turnover',
      safeDiv(annualSales, b.workingCapital),
      'TIMES',
      'İllik satış / İşlək kapital',
      [
        { label: 'İllik satış', value: annualSales },
        { label: 'İşlək kapital', value: b.workingCapital },
      ],
      ctx,
    ),
  );
  add(
    metric(
      'inventoryDays',
      'Ehtiyatların dövretmə müddəti',
      'Inventory Days',
      safeDiv(DAYS_IN_YEAR * inventoryOf(b), annualCogs),
      'DAYS',
      '360 × Ehtiyatlar / İllik satışın maya dəyəri',
      [
        { label: 'Ehtiyatlar', value: inventoryOf(b) },
        { label: 'İllik maya dəyəri', value: annualCogs },
      ],
      ctx,
    ),
  );
  add(
    metric(
      'receivableDays',
      'Debitor borcların dövretmə müddəti',
      'Receivable Days',
      safeDiv(DAYS_IN_YEAR * receivablesOf(b), annualSales),
      'DAYS',
      '360 × Debitor borclar / İllik satış',
      [
        { label: 'Debitor borclar', value: receivablesOf(b) },
        { label: 'İllik satış', value: annualSales },
      ],
      ctx,
    ),
  );
  add(
    metric(
      'creditorDays',
      'Təchizatçı öhdəliklərinin dövretmə müddəti',
      'Creditor Days',
      safeDiv(DAYS_IN_YEAR * payablesOf(b), purchases),
      'DAYS',
      '360 × Təchizatçı öhdəlikləri / İllik mal alışı',
      [
        { label: 'Təchizatçı öhdəlikləri', value: payablesOf(b) },
        { label: 'İllik alış', value: purchases },
      ],
      ctx,
    ),
  );
  const inv = out.inventoryDays.value;
  const rec = out.receivableDays.value;
  const cre = out.creditorDays.value;
  add(
    metric(
      'cashConversionCycle',
      'Nağd pulun dövretmə müddəti',
      'Cash Conversion Cycle',
      inv !== null && rec !== null && cre !== null ? inv + rec - cre : null,
      'DAYS',
      'Ehtiyat günləri + Debitor günləri − Kreditor günləri',
      [
        { label: 'Ehtiyat günləri', value: inv ?? 0 },
        { label: 'Debitor günləri', value: rec ?? 0 },
        { label: 'Kreditor günləri', value: cre ?? 0 },
      ],
      ctx,
    ),
  );
  add(
    metric(
      'assetTurnover',
      'Aktivlərin dövretməsi',
      'Asset Turnover',
      safeDiv(annualSales, b.totalAssets),
      'TIMES',
      'İllik satış / Cəmi aktivlər',
      [
        { label: 'İllik satış', value: annualSales },
        { label: 'Cəmi aktivlər', value: b.totalAssets },
      ],
      ctx,
    ),
  );
  add(
    metric(
      'inventoryTurnover',
      'Ehtiyatların dövretməsi',
      'Inventory Turnover',
      safeDiv(annualCogs, inventoryOf(b)),
      'TIMES',
      'İllik maya dəyəri / Ehtiyatlar',
      [
        { label: 'İllik maya dəyəri', value: annualCogs },
        { label: 'Ehtiyatlar', value: inventoryOf(b) },
      ],
      ctx,
    ),
  );
  add(
    metric(
      'breakevenPoint',
      'Zərərsizlik nöqtəsi',
      'Breakeven Point',
      safeDiv(i.operatingExpenses, i.grossProfit),
      'RATIO',
      'Daimi xərclər / Ümumi mənfəət',
      [
        { label: 'Daimi xərclər', value: i.operatingExpenses },
        { label: 'Ümumi mənfəət', value: i.grossProfit },
      ],
      ctx,
    ),
  );

  return out;
}

const cashOf = (b: BalanceSheetTotals) => b.cash;
const receivablesOf = (b: BalanceSheetTotals) => b.receivables;
const inventoryOf = (b: BalanceSheetTotals) => b.inventory;
const payablesOf = (b: BalanceSheetTotals) => b.payables;
