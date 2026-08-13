import type { BalanceSheet, CashFlowStatement, IncomeStatement } from '@/types/financials';

/**
 * Azerbaijani line-label vocabulary for workbook ingestion.
 *
 * The RM workbooks vary between branches and template versions, so matching on
 * fixed cell addresses breaks the moment somebody inserts a row. Instead every
 * domain field carries the label variants it is known by, and the parser scores
 * a row's text against them. That degrades gracefully: an unrecognised row is
 * reported as unmapped rather than silently mis-assigned.
 */

export type BalanceField = Exclude<keyof BalanceSheet, 'periodId'>;
export type IncomeField = Exclude<keyof IncomeStatement, 'periodId'>;
export type CashFlowField = Exclude<keyof CashFlowStatement, 'periodId'>;

export interface LabelRule<F extends string> {
  field: F;
  /** Lower-cased, accent-normalised fragments. Any one matching is a hit. */
  patterns: string[];
  /** Fragments that disqualify a row even when a pattern matched. */
  exclude?: string[];
  /** Higher wins when several rules match the same row. */
  priority: number;
}

/** Normalises Azerbaijani text for tolerant comparison. */
export function normaliseLabel(raw: string): string {
  return raw
    .toLocaleLowerCase('az')
    .replace(/ə/g, 'e')
    .replace(/ı/g, 'i')
    .replace(/ş/g, 's')
    .replace(/ç/g, 'c')
    .replace(/ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/ö/g, 'o')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export const BALANCE_LABELS: LabelRule<BalanceField>[] = [
  {
    field: 'cash',
    patterns: ['likvid vesait', 'kassada nagd', 'nagd vesait', 'bank hesablarinda', 'pul vesaitleri'],
    exclude: ['axin'],
    priority: 10,
  },
  {
    field: 'receivables',
    patterns: ['debitor borc', 'debitorlar', 'alacaqlar', 'teleb olunanlar', 'odenilmis avans'],
    priority: 10,
  },
  {
    field: 'inventory',
    patterns: [
      'ehtiyat',
      'mal qaligi',
      'mal material',
      'xammal',
      'hazir mehsul',
      'satis ucun mallar',
      'yarimfabrikat',
    ],
    exclude: ['dovretme', 'muddeti'],
    priority: 10,
  },
  { field: 'otherCurrentAssets', patterns: ['diger dovriyye aktiv', 'diger cari aktiv'], priority: 8 },
  {
    field: 'fixedAssets',
    patterns: ['esas vesait', 'daşinmaz emlak', 'dasinmaz emlak', 'avadanliq', 'naqliyyat vasite', 'masin ve avadanliq'],
    exclude: ['girov', 'teminat'],
    priority: 9,
  },
  { field: 'otherNonCurrentAssets', patterns: ['diger uzunmuddetli aktiv'], priority: 8 },

  {
    field: 'shortTermBankDebt',
    patterns: ['qisa muddetli bank', 'qisamuddetli bank', 'qisa muddetli kredit', 'bank ohdelikleri qisa'],
    priority: 12,
  },
  {
    field: 'longTermBankDebt',
    patterns: ['uzun muddetli bank', 'uzunmuddetli bank', 'uzun muddetli kredit'],
    priority: 12,
  },
  {
    field: 'payables',
    patterns: ['mal techizatci', 'techizatci', 'kreditor borc', 'mal tehcizatci'],
    priority: 10,
  },
  {
    field: 'otherCurrentLiabilities',
    patterns: ['diger cari ohdelik', 'alinmis avans', 'vergi ohdelik', 'emekdaslar'],
    priority: 7,
  },
  { field: 'otherLiabilities', patterns: ['diger ohdelik'], priority: 6 },

  { field: 'shareCapital', patterns: ['nizamname kapital', 'baslangic kapital', 'sehmler'], priority: 11 },
  {
    field: 'retainedEarnings',
    patterns: ['bolusdurulmemis menfeet', 'yigilmis menfeet', 'boluşdurulmemis menfeet'],
    priority: 11,
  },
  { field: 'ownerContributions', patterns: ['kapital qoyulusu', 'sahibkar qoyulus'], priority: 10 },
  { field: 'ownerWithdrawals', patterns: ['sahibkar cixaris', 'bolusdurulmus menfeet'], priority: 10 },
  { field: 'otherEquity', patterns: ['diger kapital'], priority: 6 },
];

export const INCOME_LABELS: LabelRule<IncomeField>[] = [
  {
    field: 'sales',
    patterns: ['satis', 'gelir', 'dovriyye'],
    exclude: ['maya', 'ucun mallar', 'dovretme', 'kredit'],
    priority: 12,
  },
  { field: 'cogs', patterns: ['satisin maya deyeri', 'maya deyeri', 'sebet maya'], priority: 14 },
  {
    field: 'operatingExpenses',
    patterns: ['daimi xerc', 'emeliyyat xerc', 'inzibati', 'emek haqq', 'icare haqq', 'kommunal'],
    exclude: ['faiz'],
    priority: 9,
  },
  { field: 'depreciation', patterns: ['amortizasiya'], priority: 13 },
  { field: 'interestExpense', patterns: ['faiz odenis', 'faiz xerc'], priority: 13 },
  { field: 'otherIncome', patterns: ['elave gelir', 'diger gelir'], priority: 10 },
  { field: 'otherExpenses', patterns: ['diger xerc'], priority: 8 },
  { field: 'tax', patterns: ['gelir vergisi', 'vergi'], exclude: ['odenis'], priority: 11 },
];

export const CASH_FLOW_LABELS: LabelRule<CashFlowField>[] = [
  { field: 'openingCash', patterns: ['dovrun evveline', 'acilis nagd', 'evvele nagd'], priority: 12 },
  {
    field: 'customerReceipts',
    patterns: ['satisdan daxilolma', 'emeliyyat daxil olma', 'musteri daxilolma', 'daxilolma'],
    priority: 11,
  },
  {
    field: 'supplierPayments',
    patterns: ['techizatcilara odenis', 'mal alis', 'techizatci odenis'],
    priority: 12,
  },
  { field: 'payroll', patterns: ['emek haqq'], priority: 11 },
  { field: 'rent', patterns: ['icare'], priority: 11 },
  { field: 'taxPaid', patterns: ['vergi odenis'], priority: 12 },
  {
    field: 'otherOperatingExpenses',
    patterns: ['diger emeliyyat xerc', 'bank xerc', 'kommunal', 'naqliyyat xerc'],
    priority: 8,
  },
  { field: 'capex', patterns: ['investisiya', 'capex', 'esas vesait alis'], priority: 11 },
  { field: 'ownerInjection', patterns: ['xususi vesait', 'sahibkar qoyulus', 'kapital qoyulus'], priority: 11 },
  { field: 'ownerWithdrawal', patterns: ['sahibkar cixaris', 'sahibin cixarisi', 'dividend'], priority: 11 },
  { field: 'newBorrowing', patterns: ['alinmis kredit', 'kredit alinmasi'], priority: 12 },
  {
    field: 'principalRepaid',
    patterns: [
      'odenilmis kredit',
      'odenilmis esas borc',
      'esas borc odenis',
      'esas borcun odenilmesi',
      'kredit odenisi',
    ],
    priority: 12,
  },
  { field: 'interestPaid', patterns: ['odenilmis faiz', 'faiz odenis'], priority: 12 },
];

/** Sheet-name detection. */
export const SHEET_PATTERNS = {
  balance: ['balans'],
  income: ['mzh', 'menfeet ve zerer', 'menfeet zerer', 'gelir xerc'],
  cashFlowCurrent: ['pul axini cari', 'cash flow cari', 'nagd axin cari', 'pul axini'],
  cashFlowForecast: ['pul axini proqnoz', 'cash flow proqnoz', 'proqnoz'],
  creditHistory: ['kredit tarixce', 'akb', 'akbc', 'kredit tarixcesi'],
  application: ['sifaris', 'teqdimat', 'musteri'],
} as const;

export type SheetKind = keyof typeof SHEET_PATTERNS;

export function detectSheetKind(sheetName: string): SheetKind | null {
  const n = normaliseLabel(sheetName);
  // Forecast must be tested before the generic cash-flow patterns, otherwise
  // "Pul axını proqnoz" matches "pul axini" first and both sheets collide.
  const order: SheetKind[] = [
    'cashFlowForecast',
    'cashFlowCurrent',
    'balance',
    'income',
    'creditHistory',
    'application',
  ];
  for (const kind of order) {
    if (SHEET_PATTERNS[kind].some((p) => n.includes(p))) return kind;
  }
  return null;
}

/**
 * Scores a row label against a rule set and returns the best field, if any.
 *
 * Specificity — the length of the matched pattern — decides, and the rule's
 * priority only breaks ties between equally specific matches. Letting priority
 * dominate instead would fold `Gəlir vergisi` into `sales` (because the generic
 * `gelir` fragment sits on a higher-priority rule than the exact
 * `gelir vergisi` one) and inflate turnover by the tax line.
 */
export function matchField<F extends string>(
  label: string,
  rules: LabelRule<F>[],
): { field: F; matchedPattern: string; priority: number } | null {
  const n = normaliseLabel(label);
  if (!n || n.length < 3) return null;

  let best: { field: F; matchedPattern: string; priority: number; score: number } | null = null;

  for (const rule of rules) {
    if (rule.exclude?.some((x) => n.includes(normaliseLabel(x)))) continue;
    for (const pattern of rule.patterns) {
      const p = normaliseLabel(pattern);
      if (!n.includes(p)) continue;
      const score = p.length * 100 + rule.priority;
      if (!best || score > best.score) {
        best = { field: rule.field, matchedPattern: pattern, priority: rule.priority, score };
      }
    }
  }

  return best ? { field: best.field, matchedPattern: best.matchedPattern, priority: best.priority } : null;
}
