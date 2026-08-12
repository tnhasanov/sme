import type { FinancialLens, Severity } from '@/types/core';
import { safeDiv, valueOf } from '@/types/core';
import type {
  BalanceSheet,
  CashFlowStatement,
  IncomeStatement,
  MonthlyTurnover,
} from '@/types/financials';
import { balanceTotals, cashFlowTotals, incomeTotals } from './statements';

/**
 * Cross-check / reconciliation engine (§31).
 *
 * Implements the three comparisons the ATB methodology requires (§6.5 of the
 * opinion methodology) plus the inventory, debt and turnover reconciliations,
 * and the indirect cash-flow plausibility check from the `Cash indirect`
 * sheet. Each check states what was expected, what was observed, and how big
 * the unexplained gap is — the gap is what the underwriter must explain.
 */

export type CrossCheckKey =
  | 'EQUITY_RECONCILIATION'
  | 'SALES_TO_CASH'
  | 'COGS_TO_PURCHASES'
  | 'INVENTORY_ROLLFORWARD'
  | 'DEBT_RECONCILIATION'
  | 'BANK_TURNOVER'
  | 'INDIRECT_CASH_FLOW'
  | 'BALANCE_INTEGRITY';

export interface CrossCheckResult {
  key: CrossCheckKey;
  labelAz: string;
  labelEn: string;
  formula: string;
  components: Array<{ label: string; value: number; sign: '+' | '-' | '=' }>;
  expected: number;
  actual: number;
  difference: number;
  /** |difference| / scale — scale is the most meaningful denominator. */
  differencePct: number | null;
  toleranceP: number;
  passed: boolean;
  severity: Severity;
  interpretationAz: string;
}

export interface CrossCheckContext {
  current: {
    balance: BalanceSheet;
    income: IncomeStatement;
    cashFlow?: CashFlowStatement;
  };
  previous?: {
    balance: BalanceSheet;
  };
  turnover?: MonthlyTurnover[];
  /** Debt per bureau report and per the bank's own systems. */
  bureauTotalDebt?: number;
  internalSystemDebt?: number;
  declaredDebt?: number;
  lens: FinancialLens;
}

interface ToleranceConfig {
  key: CrossCheckKey;
  /** Fraction of the scale figure treated as immaterial. */
  tolerancePct: number;
  severity: Severity;
}

export const CROSS_CHECK_TOLERANCES: ToleranceConfig[] = [
  { key: 'EQUITY_RECONCILIATION', tolerancePct: 0.05, severity: 'HIGH' },
  { key: 'SALES_TO_CASH', tolerancePct: 0.1, severity: 'HIGH' },
  { key: 'COGS_TO_PURCHASES', tolerancePct: 0.1, severity: 'MEDIUM' },
  { key: 'INVENTORY_ROLLFORWARD', tolerancePct: 0.1, severity: 'MEDIUM' },
  { key: 'DEBT_RECONCILIATION', tolerancePct: 0.02, severity: 'CRITICAL' },
  { key: 'BANK_TURNOVER', tolerancePct: 0.15, severity: 'MEDIUM' },
  { key: 'INDIRECT_CASH_FLOW', tolerancePct: 0.1, severity: 'HIGH' },
  { key: 'BALANCE_INTEGRITY', tolerancePct: 0.001, severity: 'CRITICAL' },
];

function tolerance(key: CrossCheckKey): ToleranceConfig {
  return CROSS_CHECK_TOLERANCES.find((t) => t.key === key) ?? { key, tolerancePct: 0.05, severity: 'MEDIUM' };
}

function build(
  key: CrossCheckKey,
  labelAz: string,
  labelEn: string,
  formula: string,
  components: CrossCheckResult['components'],
  expected: number,
  actual: number,
  scale: number,
  interpret: (diff: number, pct: number | null) => string,
): CrossCheckResult {
  const cfg = tolerance(key);
  const difference = actual - expected;
  const differencePct = safeDiv(Math.abs(difference), Math.abs(scale) || 1);
  const passed = differencePct === null ? true : differencePct <= cfg.tolerancePct;
  return {
    key,
    labelAz,
    labelEn,
    formula,
    components,
    expected,
    actual,
    difference,
    differencePct,
    toleranceP: cfg.tolerancePct,
    passed,
    severity: passed ? 'INFO' : cfg.severity,
    interpretationAz: interpret(difference, differencePct),
  };
}

const fmt = (n: number) =>
  new Intl.NumberFormat('az-AZ', { maximumFractionDigits: 0 }).format(Math.round(n));

export function runCrossChecks(ctx: CrossCheckContext): CrossCheckResult[] {
  const lens = ctx.lens;
  const bs = balanceTotals(ctx.current.balance, lens);
  const is = incomeTotals(ctx.current.income, lens);
  const cf = ctx.current.cashFlow ? cashFlowTotals(ctx.current.cashFlow, lens) : undefined;
  const prev = ctx.previous ? balanceTotals(ctx.previous.balance, lens) : undefined;

  const results: CrossCheckResult[] = [];

  /* -------- 1. Balance sheet integrity -------- */
  results.push(
    build(
      'BALANCE_INTEGRITY',
      'Balansın tarazlığı',
      'Balance sheet integrity',
      'Cəmi aktivlər = Cəmi öhdəliklər + Şəxsi kapital',
      [
        { label: 'Cəmi aktivlər', value: bs.totalAssets, sign: '=' },
        { label: 'Cəmi öhdəliklər', value: bs.totalLiabilities, sign: '+' },
        { label: 'Şəxsi kapital', value: bs.totalEquity, sign: '+' },
      ],
      bs.totalLiabilities + bs.totalEquity,
      bs.totalAssets,
      bs.totalAssets,
      (d) =>
        Math.abs(d) < 1
          ? 'Balans tarazdır.'
          : `Balans ${fmt(Math.abs(d))} AZN məbləğində tarazlaşmır — daxil edilmiş məlumatlar natamamdır.`,
    ),
  );

  /* -------- 2. Equity reconciliation -------- */
  if (prev) {
    const openingEquity = prev.totalEquity;
    const profit = is.netProfit;
    const injection = valueOf(ctx.current.balance.ownerContributions, lens);
    const withdrawal = valueOf(ctx.current.balance.ownerWithdrawals, lens);
    const expected = openingEquity + profit + injection - withdrawal;

    results.push(
      build(
        'EQUITY_RECONCILIATION',
        'Kapitalın uzlaşdırılması',
        'Equity reconciliation',
        'Açılış kapitalı + Mənfəət + Sahibkar qoyuluşu − Sahibkar çıxarışı = Gözlənilən bağlanış kapitalı',
        [
          { label: 'Açılış kapitalı', value: openingEquity, sign: '=' },
          { label: 'Dövrün mənfəəti', value: profit, sign: '+' },
          { label: 'Sahibkar qoyuluşu', value: injection, sign: '+' },
          { label: 'Sahibkar çıxarışı', value: withdrawal, sign: '-' },
        ],
        expected,
        bs.totalEquity,
        Math.abs(openingEquity) || 1,
        (d, pct) =>
          Math.abs(d) < 1
            ? 'Kapitalın hərəkəti tam izah olunur.'
            : d > 0
              ? `İZAH OLUNMAYAN KAPİTAL ARTIMI: kapital gözləniləndən ${fmt(d)} AZN (${((pct ?? 0) * 100).toFixed(1)}%) çoxdur. Sənədləşdirilməmiş qoyuluş və ya uçotda olmayan gəlir mənbəyi ola bilər.`
              : `Kapital gözləniləndən ${fmt(Math.abs(d))} AZN azdır — uçota alınmamış çıxarış və ya zərər mövcuddur.`,
      ),
    );
  }

  /* -------- 3. Sales → cash collections -------- */
  if (cf && prev) {
    const deltaReceivables = bs.receivables - prev.receivables;
    const expectedCollections = is.sales - deltaReceivables;
    results.push(
      build(
        'SALES_TO_CASH',
        'Satış → nağd daxilolma',
        'Sales to cash collections',
        'Satış − Debitor borcların artımı ≈ Nağd daxilolmalar',
        [
          { label: 'Satış (MZH)', value: is.sales, sign: '=' },
          { label: 'Debitor borcların artımı', value: deltaReceivables, sign: '-' },
        ],
        expectedCollections,
        cf.operatingInflow,
        Math.abs(is.sales) || 1,
        (d, pct) =>
          d < 0
            ? `Faktiki daxilolmalar gözləniləndən ${fmt(Math.abs(d))} AZN (${((pct ?? 0) * 100).toFixed(1)}%) azdır — satışın bir hissəsi pula çevrilməyib.`
            : `Daxilolmalar gözləniləndən ${fmt(d)} AZN çoxdur — uçota alınmamış satış və ya əvvəlki dövrün debitor yığımı ola bilər.`,
      ),
    );
  }

  /* -------- 4. COGS → purchases -------- */
  if (cf && prev) {
    const deltaInventory = bs.inventory - prev.inventory;
    const deltaPayables = bs.payables - prev.payables;
    const expectedPurchasesPaid = is.cogs + deltaInventory - deltaPayables;
    results.push(
      build(
        'COGS_TO_PURCHASES',
        'Maya dəyəri → alışlar',
        'COGS to purchases',
        'Maya dəyəri + Ehtiyat artımı − Kreditor artımı ≈ Təchizatçılara ödənişlər',
        [
          { label: 'Satışın maya dəyəri', value: is.cogs, sign: '=' },
          { label: 'Ehtiyat artımı', value: deltaInventory, sign: '+' },
          { label: 'Kreditor borc artımı', value: deltaPayables, sign: '-' },
        ],
        expectedPurchasesPaid,
        valueOf(ctx.current.cashFlow!.supplierPayments, lens),
        Math.abs(is.cogs) || 1,
        (d, pct) =>
          `Təchizatçı ödənişləri ilə maya dəyəri arasında ${fmt(Math.abs(d))} AZN (${((pct ?? 0) * 100).toFixed(1)}%) fərq var — ehtiyat və ya kreditor uçotu natamam ola bilər.`,
      ),
    );
  }

  /* -------- 5. Inventory roll-forward -------- */
  if (prev && cf) {
    const purchases = valueOf(ctx.current.cashFlow!.supplierPayments, lens);
    const expectedClosing = prev.inventory + purchases - is.cogs;
    results.push(
      build(
        'INVENTORY_ROLLFORWARD',
        'Ehtiyatların hərəkəti',
        'Inventory roll-forward',
        'Açılış ehtiyatı + Alışlar − Maya dəyəri = Gözlənilən bağlanış ehtiyatı',
        [
          { label: 'Açılış ehtiyatı', value: prev.inventory, sign: '=' },
          { label: 'Alışlar', value: purchases, sign: '+' },
          { label: 'Satışın maya dəyəri', value: is.cogs, sign: '-' },
        ],
        expectedClosing,
        bs.inventory,
        Math.abs(prev.inventory) || 1,
        (d, pct) =>
          d > 0
            ? `Faktiki ehtiyat gözləniləndən ${fmt(d)} AZN (${((pct ?? 0) * 100).toFixed(1)}%) çoxdur — sənədləşdirilməmiş mal qalığı riski.`
            : `Faktiki ehtiyat gözləniləndən ${fmt(Math.abs(d))} AZN azdır — uçota alınmamış satış və ya itki ola bilər.`,
      ),
    );
  }

  /* -------- 6. Debt reconciliation -------- */
  if (ctx.bureauTotalDebt !== undefined) {
    const sources = [
      { label: 'AKB üzrə cəmi borc', value: ctx.bureauTotalDebt },
      { label: 'Bankın daxili sistemi', value: ctx.internalSystemDebt ?? 0 },
      { label: 'Müştərinin bəyanı', value: ctx.declaredDebt ?? 0 },
      { label: 'Balansdakı bank öhdəlikləri', value: bs.totalBankDebt },
    ].filter((s) => s.value > 0);

    results.push(
      build(
        'DEBT_RECONCILIATION',
        'Borcun uzlaşdırılması (AKB ↔ balans)',
        'Debt reconciliation',
        'AKB üzrə cəmi borc = Balansdakı bank öhdəlikləri',
        sources.map((s) => ({ label: s.label, value: s.value, sign: '=' as const })),
        ctx.bureauTotalDebt,
        bs.totalBankDebt,
        Math.abs(ctx.bureauTotalDebt) || 1,
        (d, pct) =>
          Math.abs(d) < 1
            ? 'Borc məlumatları uzlaşır.'
            : d < 0
              ? `Balansda AKB-dən ${fmt(Math.abs(d))} AZN (${((pct ?? 0) * 100).toFixed(1)}%) az borc göstərilib — gizlədilmiş öhdəlik riski.`
              : `Balansda AKB-dən ${fmt(d)} AZN çox borc göstərilib — bank olmayan borclar (qohum/təchizatçı) daxil edilə bilər.`,
      ),
    );
  }

  /* -------- 7. Bank / POS turnover vs reported sales -------- */
  if (ctx.turnover && ctx.turnover.length > 0) {
    const observed = ctx.turnover.reduce((s, t) => s + t.bankCredits + t.posTurnover + t.cashSales, 0);
    const declared = ctx.turnover.reduce((s, t) => s + t.declaredSales, 0) || is.sales;
    results.push(
      build(
        'BANK_TURNOVER',
        'Dövriyyənin uzlaşdırılması',
        'Bank turnover reconciliation',
        'Bank daxilolmaları + POS + nağd satış ≈ Bəyan edilən satış',
        [
          { label: 'Bank daxilolmaları', value: ctx.turnover.reduce((s, t) => s + t.bankCredits, 0), sign: '=' },
          { label: 'POS dövriyyəsi', value: ctx.turnover.reduce((s, t) => s + t.posTurnover, 0), sign: '+' },
          { label: 'Nağd satış', value: ctx.turnover.reduce((s, t) => s + t.cashSales, 0), sign: '+' },
          { label: 'Vergi bəyannaməsi üzrə satış', value: ctx.turnover.reduce((s, t) => s + t.taxDeclaredSales, 0), sign: '=' },
        ],
        declared,
        observed,
        Math.abs(declared) || 1,
        (d, pct) =>
          d < 0
            ? `Müşahidə olunan dövriyyə bəyan edilən satışdan ${fmt(Math.abs(d))} AZN (${((pct ?? 0) * 100).toFixed(1)}%) azdır — satışın bir hissəsi təsdiqlənmir.`
            : `Müşahidə olunan dövriyyə bəyan edilən satışdan çoxdur (${fmt(d)} AZN) — qrupdaxili köçürmələr və ya təkrar hesablama yoxlanılmalıdır.`,
      ),
    );
  }

  /* -------- 8. Indirect cash-flow plausibility -------- */
  if (prev && cf) {
    const deltaReceivables = bs.receivables - prev.receivables;
    const deltaInventory = bs.inventory - prev.inventory;
    const deltaPayables = bs.payables - prev.payables;
    const deltaBankDebt = bs.totalBankDebt - prev.totalBankDebt;
    const capex = valueOf(ctx.current.cashFlow!.capex, lens);
    const injection = valueOf(ctx.current.balance.ownerContributions, lens);
    const withdrawal = valueOf(ctx.current.balance.ownerWithdrawals, lens);

    const expectedClosingCash =
      prev.cash +
      is.netProfit +
      is.depreciation -
      deltaReceivables -
      deltaInventory +
      deltaPayables -
      capex +
      deltaBankDebt +
      injection -
      withdrawal;

    results.push(
      build(
        'INDIRECT_CASH_FLOW',
        'Dolayı metodla nağd vəsaitin yoxlanışı',
        'Indirect cash-flow check',
        'Açılış nağd + Xalis mənfəət + Amortizasiya − ΔDebitor − ΔEhtiyat + ΔKreditor − CAPEX + ΔBank borcu + Qoyuluş − Çıxarış',
        [
          { label: 'Açılış nağd vəsait', value: prev.cash, sign: '=' },
          { label: 'Xalis mənfəət', value: is.netProfit, sign: '+' },
          { label: 'Amortizasiya', value: is.depreciation, sign: '+' },
          { label: 'Debitor dəyişməsi', value: deltaReceivables, sign: '-' },
          { label: 'Ehtiyat dəyişməsi', value: deltaInventory, sign: '-' },
          { label: 'Kreditor dəyişməsi', value: deltaPayables, sign: '+' },
          { label: 'CAPEX', value: capex, sign: '-' },
          { label: 'Bank borcunun dəyişməsi', value: deltaBankDebt, sign: '+' },
          { label: 'Sahibkar qoyuluşu', value: injection, sign: '+' },
          { label: 'Sahibkar çıxarışı', value: withdrawal, sign: '-' },
        ],
        expectedClosingCash,
        bs.cash,
        Math.abs(bs.cash) || Math.abs(expectedClosingCash) || 1,
        (d, pct) =>
          `Dövrün sonunda olmalı olan nağd vəsaitlə faktiki qalıq arasında ${fmt(Math.abs(d))} AZN (${((pct ?? 0) * 100).toFixed(1)}%) fərq var — hesabatlar arasında uzlaşma pozulur.`,
      ),
    );
  }

  return results;
}
