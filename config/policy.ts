import type { ComparisonOperator, RuleAction, Severity, SourceStatus, VersionedArtifact } from '@/types/core';

/**
 * Policy rule engine configuration (§26, §48, §75).
 *
 * Every threshold in the platform lives here — nothing is hard-coded in a
 * component. Rules are addressed by `metric`, which must match a key
 * produced by the calculation engine (see /domain/calculations/metrics.ts).
 *
 * Base rules apply to all sectors; a rule carrying a `sector` (and
 * optionally `subSector`) overrides the base rule for the same metric.
 */

export interface PolicyRule {
  id: string;
  name: string;
  nameAz: string;
  metric: string;
  operator: ComparisonOperator;
  threshold: number;
  upperThreshold?: number;
  unit: 'RATIO' | 'PERCENT' | 'DAYS' | 'CURRENCY' | 'TIMES';
  severity: Severity;
  action: RuleAction;
  scope: 'BASE' | 'SECTOR' | 'SUBSECTOR' | 'PRODUCT' | 'SEGMENT';
  sector?: string;
  subSector?: string;
  product?: string;
  segment?: 'SMALL' | 'MEDIUM';
  status: SourceStatus;
  sourceRef: string;
  /** Sectors for which this rule does not apply at all. */
  waivedForSectors?: string[];
  enabled: boolean;
  explanation: string;
}

export interface PolicyVersion extends VersionedArtifact {
  id: string;
  rules: PolicyRule[];
}

const base = (
  r: Omit<PolicyRule, 'scope' | 'enabled'> & Partial<Pick<PolicyRule, 'scope' | 'enabled'>>,
): PolicyRule => ({ scope: 'BASE', enabled: true, ...r });

export const POLICY_ATB_CURRENT_V1: PolicyVersion = {
  id: 'ATB_POLICY_V1',
  version: 'v1',
  label: 'ATB cari kredit siyasəti parametrləri',
  status: 'CURRENT',
  effectiveFrom: '2025-11-01',
  sourceRef: 'Rəy forması → Əmsallar sheet norms; Balans panel norms; Metodologiya §6',
  rules: [
    /* ---------------- Liquidity ---------------- */
    base({
      id: 'RATIO_CURRENT_RATIO',
      name: 'Current Ratio',
      nameAz: 'Cari likvidlik əmsalı',
      metric: 'currentRatio',
      operator: 'GTE',
      threshold: 1.5,
      unit: 'TIMES',
      severity: 'HIGH',
      action: 'POLICY_EXCEPTION',
      status: 'CURRENT',
      sourceRef: 'Əmsallar!D5 — Norma 1.50',
      explanation: 'Dövriyyə vəsaitləri / Qısa müddətli öhdəliklər',
    }),
    base({
      id: 'RATIO_QUICK_RATIO',
      name: 'Quick Ratio',
      nameAz: 'Ani likvidlik əmsalı',
      metric: 'quickRatio',
      operator: 'GTE',
      threshold: 1.0,
      unit: 'TIMES',
      severity: 'MEDIUM',
      action: 'WARNING',
      status: 'CURRENT',
      sourceRef: 'Əmsallar!D6 — Norma 1.00',
      explanation: '(Cari aktivlər − ehtiyatlar) / Qısa müddətli öhdəliklər',
    }),
    base({
      id: 'CASH_COVERAGE_OF_OBLIGATIONS',
      name: 'Cash coverage of bank obligations (annual)',
      nameAz: 'Öhdəliklərin nağd ödənə bilmə əmsalı (il ərzində)',
      metric: 'cashCoverageOfBankDebt',
      operator: 'GTE',
      threshold: 0.35,
      unit: 'TIMES',
      severity: 'MEDIUM',
      action: 'WARNING',
      status: 'CURRENT',
      sourceRef: 'Balans panel — Norma 0.35',
      explanation: 'İllik cəmi pul axını / bank kreditləri',
    }),
    base({
      id: 'MIN_FORECAST_FREE_CASH',
      name: 'Minimum forecast monthly closing cash',
      nameAz: 'Sərbəst proqnoz pul axını (minimum aylıq qalıq)',
      metric: 'minForecastClosingCash',
      operator: 'GTE',
      threshold: 0,
      unit: 'CURRENCY',
      severity: 'HIGH',
      action: 'POLICY_EXCEPTION',
      status: 'CURRENT',
      sourceRef: 'Balans panel — MIN(Pul axını proqnoz C108:N108) ≥ 0',
      explanation: 'Proqnoz dövründə heç bir ay üzrə mənfi nağd qalıq olmamalıdır',
    }),

    /* ---------------- Leverage / capital ---------------- */
    base({
      id: 'DEBT_TO_EQUITY_INCL_NEW',
      name: 'Debt to Equity incl. new facility',
      nameAz: 'Kapitala nəzərən borclanma əmsalı (yeni kredit daxil)',
      metric: 'debtToEquityInclNew',
      operator: 'LTE',
      threshold: 1.0,
      unit: 'TIMES',
      severity: 'CRITICAL',
      action: 'STOP',
      status: 'CURRENT',
      sourceRef: 'Metodologiya §6.2; Əmsallar!D11 — Norma 1.00',
      waivedForSectors: ['Xidmət'],
      explanation:
        '(Cəmi öhdəliklər + veriləcək kredit − bağlanacaq öhdəliklər) / Şəxsi kapital. Xidmət sektorunda digər amillər əsasında stop faktor tətbiq edilməyə bilər.',
    }),
    base({
      id: 'LEVERAGE_ASSETS_TO_EQUITY',
      name: 'Leverage (Assets / Equity)',
      nameAz: 'Aktivlərin kapitala nisbəti (Leverec)',
      metric: 'leverage',
      operator: 'LTE',
      threshold: 2.0,
      unit: 'TIMES',
      severity: 'MEDIUM',
      action: 'WARNING',
      status: 'CURRENT',
      sourceRef: 'Əmsallar!D12 — Norma 2.00',
      explanation: 'Cəmi aktivlər / Şəxsi kapital',
    }),
    base({
      id: 'GEARING',
      name: 'Gearing (Bank debt / Equity)',
      nameAz: 'Bank öhdəliklərinin kapitala nisbəti',
      metric: 'gearing',
      operator: 'LTE',
      threshold: 0.5,
      unit: 'TIMES',
      severity: 'MEDIUM',
      action: 'WARNING',
      status: 'NEEDS_CONFIRMATION',
      sourceRef: 'Balans panel — 0.5; Əmsallar sheet göstərir, lakin norma boşdur',
      explanation: 'Bank öhdəliklərinin kapitalda payı. Norma mənbələr arasında fərqlidir — təsdiq tələb edir.',
    }),

    /* ---------------- Debt service ---------------- */
    base({
      id: 'DSCR_CURRENT',
      name: 'DSCR — current',
      nameAz: 'Borcun ödənilmə əmsalı — cari',
      metric: 'dscrCurrent',
      operator: 'GTE',
      threshold: 1.5,
      unit: 'TIMES',
      severity: 'HIGH',
      action: 'POLICY_EXCEPTION',
      status: 'CURRENT',
      sourceRef: 'Əmsallar!D9 — Norma 1.50',
      explanation: '(Xalis əməliyyat pul axını + ödənilmiş faizlər) / (faizlər + əsas borc)',
    }),
    base({
      id: 'DSCR_FORECAST',
      name: 'DSCR — forecast incl. new facility',
      nameAz: 'Borcun ödənilmə əmsalı — proqnoz (yeni kredit daxil)',
      metric: 'dscrPostTransaction',
      operator: 'GTE',
      threshold: 1.5,
      unit: 'TIMES',
      severity: 'HIGH',
      action: 'POLICY_EXCEPTION',
      status: 'CURRENT',
      sourceRef: 'Əmsallar!D10; Cash flow proqnoz N10 — Norma 1.50',
      explanation: 'Yeni kredit ödənişi daxil olmaqla proqnoz borc xidməti örtüyü',
    }),
    base({
      id: 'PAYMENT_TO_CAPACITY',
      name: 'Monthly payment / forecast repayment capacity',
      nameAz: 'Aylıq ödəniş / proqnoz ödəmə qabiliyyəti',
      metric: 'paymentToCapacity',
      operator: 'LTE',
      threshold: 0.8,
      unit: 'RATIO',
      severity: 'CRITICAL',
      action: 'STOP',
      status: 'NEEDS_CONFIRMATION',
      sourceRef:
        'MZH Q10; "KOB kreditlərinin verilməsi Metodologiyası" 0.8 əmsalı — mənbə sənəd təqdim edilməyib',
      waivedForSectors: ['Kənd təsərrüfatı'],
      explanation:
        'Bank qarşısında aylıq ödənişin proqnoz ödəmə qabiliyyətinə nisbəti. Kənd təsərrüfatında proqnoz pul axını ödəmə qabiliyyətini göstərdikdə tətbiq edilmir.',
    }),
    base({
      id: 'ALL_PAYMENTS_TO_RETAINED_PROFIT',
      name: 'All monthly payments / retained profit',
      nameAz: 'Bütün ödənişlərin bölüşdürülməmiş mənfəətlə ödənilmə əmsalı',
      metric: 'allPaymentsToRetainedProfit',
      operator: 'LTE',
      threshold: 0.8,
      unit: 'RATIO',
      severity: 'HIGH',
      action: 'POLICY_EXCEPTION',
      status: 'INFERRED',
      sourceRef: 'MZH Q12 — norma açıq göstərilməyib, 0.8 əmsalı ilə eyniləşdirilib',
      explanation: 'Qrup üzrə bütün aylıq ödənişlərin dövrün bölüşdürülməmiş mənfəətinə nisbəti',
    }),

    /* ---------------- Profitability ---------------- */
    base({
      id: 'ROA',
      name: 'Return on Assets',
      nameAz: 'Aktivlərin mənfəətliliyi (ROA)',
      metric: 'roa',
      operator: 'GTE',
      threshold: 0.05,
      unit: 'PERCENT',
      severity: 'LOW',
      action: 'INFO',
      status: 'CURRENT',
      sourceRef: 'Əmsallar / Balans panel — Norma 5%',
      explanation: 'Bölüşdürülməmiş mənfəət / Cəmi aktivlər',
    }),
    base({
      id: 'ROE',
      name: 'Return on Equity',
      nameAz: 'Kapitalın mənfəətliliyi (ROE)',
      metric: 'roe',
      operator: 'GTE',
      threshold: 0.08,
      unit: 'PERCENT',
      severity: 'LOW',
      action: 'INFO',
      status: 'CURRENT',
      sourceRef: 'Əmsallar / Balans panel — Norma 8%',
      explanation: 'Bölüşdürülməmiş mənfəət / Şəxsi kapital',
    }),

    /* ---------------- Efficiency / working capital ---------------- */
    base({
      id: 'ASSET_TURNOVER',
      name: 'Asset Turnover',
      nameAz: 'Aktivlərin dövretməsi',
      metric: 'assetTurnover',
      operator: 'GTE',
      threshold: 1.0,
      unit: 'TIMES',
      severity: 'LOW',
      action: 'INFO',
      status: 'CURRENT',
      sourceRef: 'Əmsallar!D22 — Norma 1.00',
      explanation: 'İllik satış / cəmi aktivlər',
    }),
    base({
      id: 'WORKING_CAPITAL_TURNOVER',
      name: 'Working Capital Turnover',
      nameAz: 'İşlək kapitalın dövretməsi',
      metric: 'workingCapitalTurnover',
      operator: 'GTE',
      threshold: 1.5,
      unit: 'TIMES',
      severity: 'LOW',
      action: 'INFO',
      status: 'CURRENT',
      sourceRef: 'Balans panel — Norma 1.5',
      explanation: 'İllik satış / işlək kapital',
    }),

    /* ---------------- Credit behaviour ---------------- */
    base({
      id: 'INSTALMENT_REPAYMENT_SHARE',
      name: 'Share of past loans repaid by instalments',
      nameAz: 'Kreditlərin aylıq ödənişlərlə bağlanma payı',
      metric: 'instalmentRepaymentShare',
      operator: 'GT',
      threshold: 0.5,
      unit: 'PERCENT',
      severity: 'HIGH',
      action: 'WARNING',
      status: 'CURRENT',
      sourceRef: 'Metodologiya §4.7; AKBÇ təhlili E70 — >50% qənaətbəxş',
      explanation:
        'İlkin kredit məbləğlərinin aylıq ödənişlərlə bağlanan hissəsi. 50%-dən aşağı olduqda kreditdən-kreditə refinansmanı göstərir.',
    }),
    base({
      id: 'DEBT_BURDEN_INCREASE',
      name: 'Increase of monthly debt burden',
      nameAz: 'Aylıq borc yükünün artımı',
      metric: 'debtBurdenIncrease',
      operator: 'LTE',
      threshold: 0.5,
      unit: 'PERCENT',
      severity: 'HIGH',
      action: 'WARNING',
      status: 'CURRENT',
      sourceRef: 'Metodologiya §4.8 — >50% arzuolunmazdır',
      explanation:
        'Əməliyyatdan sonrakı aylıq ödənişin son 6-12 ayda paralel xidmət edilən maksimum aylıq ödənişə nisbətən artımı.',
    }),
    base({
      id: 'MAX_DPD_CURRENT',
      name: 'Current days past due',
      nameAz: 'Cari gecikmə günləri',
      metric: 'currentMaxDpd',
      operator: 'LTE',
      threshold: 0,
      unit: 'DAYS',
      severity: 'CRITICAL',
      action: 'STOP',
      status: 'INFERRED',
      sourceRef: 'Metodologiya §4.6 — əsaslandırılmamış 30+ gün stop faktordur',
      explanation: 'Müraciət anında aktiv gecikmə. Sənədlə əsaslandırıldıqda istisna tələb olunur.',
    }),

    /* ---------------- Collateral ---------------- */
    base({
      id: 'COLLATERAL_COVERAGE',
      name: 'Eligible collateral coverage',
      nameAz: 'Uyğun girov örtüyü',
      metric: 'eligibleCollateralCoverage',
      operator: 'GTE',
      threshold: 1.0,
      unit: 'TIMES',
      severity: 'HIGH',
      action: 'POLICY_EXCEPTION',
      status: 'INFERRED',
      sourceRef: 'AMB-nın təminat/kredit nisbəti tələbi — dəqiq faiz sənəddə göstərilməyib',
      explanation: 'Diskont tətbiq edilmiş girov dəyərinin əməliyyatdan sonrakı ATB ekspozisiyasına nisbəti',
    }),

    /* ---------------- Sector overrides: turnover days ---------------- */
    ...sectorTurnoverRules(),
  ],
};

/**
 * Inventory- and receivable-day norms are sector specific. In the source
 * workbook they are a VLOOKUP into an RM-side `Data Base` sheet that was
 * not part of the supplied material, so these values are seeded as
 * NEEDS_CONFIRMATION and are fully editable by the administrator.
 */
function sectorTurnoverRules(): PolicyRule[] {
  const table: Array<{ sector: string; inventoryDays: number; receivableDays: number; creditorDays: number }> = [
    { sector: 'Ticarət', inventoryDays: 60, receivableDays: 45, creditorDays: 60 },
    { sector: 'Topdan ticarət', inventoryDays: 75, receivableDays: 60, creditorDays: 75 },
    { sector: 'Pərakəndə ticarət', inventoryDays: 45, receivableDays: 15, creditorDays: 45 },
    { sector: 'İstehsal', inventoryDays: 90, receivableDays: 60, creditorDays: 60 },
    { sector: 'Tikinti', inventoryDays: 120, receivableDays: 90, creditorDays: 90 },
    { sector: 'Xidmət', inventoryDays: 30, receivableDays: 30, creditorDays: 45 },
    { sector: 'Nəqliyyat', inventoryDays: 20, receivableDays: 45, creditorDays: 30 },
    { sector: 'Kənd təsərrüfatı', inventoryDays: 180, receivableDays: 60, creditorDays: 90 },
  ];

  const rules: PolicyRule[] = [];
  for (const row of table) {
    rules.push({
      id: `SECTOR_INVENTORY_DAYS_${row.sector}`,
      name: 'Inventory days',
      nameAz: 'Ehtiyatların dövretmə müddəti',
      metric: 'inventoryDays',
      operator: 'LTE',
      threshold: row.inventoryDays,
      unit: 'DAYS',
      severity: 'MEDIUM',
      action: 'WARNING',
      scope: 'SECTOR',
      sector: row.sector,
      status: 'NEEDS_CONFIRMATION',
      sourceRef: 'RM iş kitabı "Data Base" sektor normaları — mənbə fayl təqdim edilməyib',
      enabled: true,
      explanation: '360 × ehtiyatlar / illik satışın maya dəyəri',
    });
    rules.push({
      id: `SECTOR_RECEIVABLE_DAYS_${row.sector}`,
      name: 'Receivable days',
      nameAz: 'Debitor borcların dövretmə müddəti',
      metric: 'receivableDays',
      operator: 'LTE',
      threshold: row.receivableDays,
      unit: 'DAYS',
      severity: 'MEDIUM',
      action: 'WARNING',
      scope: 'SECTOR',
      sector: row.sector,
      status: 'NEEDS_CONFIRMATION',
      sourceRef: 'RM iş kitabı "Data Base" sektor normaları — mənbə fayl təqdim edilməyib',
      enabled: true,
      explanation: '360 × debitor borclar / illik satış',
    });
    rules.push({
      id: `SECTOR_CREDITOR_DAYS_${row.sector}`,
      name: 'Creditor days',
      nameAz: 'Təchizatçı öhdəliklərinin dövretmə müddəti',
      metric: 'creditorDays',
      operator: 'LTE',
      threshold: row.creditorDays,
      unit: 'DAYS',
      severity: 'LOW',
      action: 'INFO',
      scope: 'SECTOR',
      sector: row.sector,
      status: 'INFERRED',
      sourceRef: 'Əmsallar sheet — norma göstərilməyib, sektor üzrə indikativ dəyər',
      enabled: true,
      explanation: '360 × təchizatçı öhdəlikləri / illik mal alışı',
    });
  }
  return rules;
}

export const POLICY_VERSIONS: Record<string, PolicyVersion> = {
  [POLICY_ATB_CURRENT_V1.id]: POLICY_ATB_CURRENT_V1,
};

/* ================================================================== */
/* Stop factors (§48) — separate from the scorecard                    */
/* ================================================================== */

export interface StopFactorRule {
  id: string;
  labelAz: string;
  labelEn: string;
  description: string;
  severity: Severity;
  automaticRejection: boolean;
  escalationAllowed: boolean;
  applicableSegments: Array<'SMALL' | 'MEDIUM'>;
  applicableProducts: string[] | 'ALL';
  waivedForSectors?: string[];
  status: SourceStatus;
  sourceRef: string;
  effectiveFrom: string;
  enabled: boolean;
  /** Key of the evaluator implemented in /domain/rules/stop-factors.ts */
  evaluator: string;
}

export const STOP_FACTORS_V1: StopFactorRule[] = [
  {
    id: 'SF_AKB_EXTRACTS_MISSING',
    labelAz: 'Əlaqəli şəxslərin AKB çıxarışları alınmayıb',
    labelEn: 'Bureau extracts of connected persons not obtained',
    description:
      'Biznesə aidiyyəti olan bütün şəxslər (təsisçilər, qərar verənlər, zaminlər) üzrə AKB çıxarışları olmadan obyektiv qiymətləndirmə mümkün deyil.',
    severity: 'CRITICAL',
    automaticRejection: false,
    escalationAllowed: true,
    applicableSegments: ['SMALL', 'MEDIUM'],
    applicableProducts: 'ALL',
    status: 'CURRENT',
    sourceRef: 'Metodologiya §4.3, §4.10',
    effectiveFrom: '2025-11-01',
    enabled: true,
    evaluator: 'akbExtractsMissing',
  },
  {
    id: 'SF_UNJUSTIFIED_DPD_30_PLUS',
    labelAz: 'Əsaslandırılmamış 30+ gün gecikmə',
    labelEn: 'Unjustified 30+ days past due',
    description:
      'Bank öhdəlikləri üzrə sənədlə əsaslandırılmamış 30 gündən artıq gecikmə struktur ödəniş problemi göstəricisidir.',
    severity: 'CRITICAL',
    automaticRejection: false,
    escalationAllowed: true,
    applicableSegments: ['SMALL', 'MEDIUM'],
    applicableProducts: 'ALL',
    status: 'CURRENT',
    sourceRef: 'Metodologiya §4.6',
    effectiveFrom: '2025-11-01',
    enabled: true,
    evaluator: 'unjustifiedDpd30Plus',
  },
  {
    id: 'SF_OWNERSHIP_NOT_CONFIRMED',
    labelAz: 'Biznesin sifarişçiyə aidiyyəti təsdiqlənmir',
    labelEn: 'Business ownership not evidenced',
    description:
      'Sənəd, dəlil və faktlarla biznesin sifarişçiyə aidiyyəti təsdiqlənmirsə və ya dövr gəliri sosial vəziyyətə uyğun deyilsə.',
    severity: 'CRITICAL',
    automaticRejection: false,
    escalationAllowed: true,
    applicableSegments: ['SMALL', 'MEDIUM'],
    applicableProducts: 'ALL',
    status: 'CURRENT',
    sourceRef: 'Metodologiya §5.1.1',
    effectiveFrom: '2025-11-01',
    enabled: true,
    evaluator: 'ownershipNotConfirmed',
  },
  {
    id: 'SF_DEBT_TO_EQUITY_OVER_100',
    labelAz: 'Kapitala nəzərən borclanma əmsalı 100%-i keçir',
    labelEn: 'Debt-to-equity including the new facility exceeds 100%',
    description:
      'Yeni kredit daxil olmaqla cəmi öhdəliklərin şəxsi kapitala nisbəti 1.00-i keçdikdə kapital adekvatlığı pozulur.',
    severity: 'CRITICAL',
    automaticRejection: false,
    escalationAllowed: true,
    applicableSegments: ['SMALL', 'MEDIUM'],
    applicableProducts: 'ALL',
    waivedForSectors: ['Xidmət'],
    status: 'CURRENT',
    sourceRef: 'Metodologiya §6.2',
    effectiveFrom: '2025-11-01',
    enabled: true,
    evaluator: 'debtToEquityOver100',
  },
  {
    id: 'SF_REPAYMENT_CAPACITY_NORM',
    labelAz: 'Ödəmə qabiliyyəti norması pozulur',
    labelEn: 'Repayment-capacity norm breached',
    description:
      'Aylıq ödənişin proqnoz ödəmə qabiliyyətinə nisbəti 0.8 əmsalını keçdikdə. Kənd təsərrüfatı üzrə proqnoz pul axını ödəmə qabiliyyətini göstərdikdə tətbiq edilmir.',
    severity: 'CRITICAL',
    automaticRejection: false,
    escalationAllowed: true,
    applicableSegments: ['SMALL', 'MEDIUM'],
    applicableProducts: 'ALL',
    waivedForSectors: ['Kənd təsərrüfatı'],
    status: 'NEEDS_CONFIRMATION',
    sourceRef: 'Metodologiya §6.3; 0.8 əmsalı KOB kreditlərinin verilməsi Metodologiyasına istinad edir',
    effectiveFrom: '2025-11-01',
    enabled: true,
    evaluator: 'repaymentCapacityNorm',
  },
  {
    id: 'SF_PURPOSE_NOT_ASSESSABLE',
    labelAz: 'Təyinatın səmərəliliyi və nəzarəti eyni anda qiymətləndirilmir',
    labelEn: 'Purpose efficiency and control both unassessable',
    description:
      'Kreditin təyinatının səmərəliliyi VƏ təyinata nəzarət imkanı eyni anda sıfır olduqda təyinat kriteriyası sıfırlanır.',
    severity: 'CRITICAL',
    automaticRejection: false,
    escalationAllowed: true,
    applicableSegments: ['SMALL', 'MEDIUM'],
    applicableProducts: 'ALL',
    status: 'CURRENT',
    sourceRef: 'Metodologiya §7.5',
    effectiveFrom: '2025-11-01',
    enabled: true,
    evaluator: 'purposeNotAssessable',
  },
  {
    id: 'SF_PRESCREEN_BUREAU_SCORE',
    labelAz: 'AKB skoru ilkin süzgəc həddindən aşağıdır',
    labelEn: 'Bureau score below pre-screening threshold',
    description:
      'Prometeia təklifinə əsasən ACB Micro Score 399 və aşağı olduqda müraciət ilkin mərhələdə imtina edilir. Bu qayda cari ATB siyasətinin bir hissəsi deyil.',
    severity: 'CRITICAL',
    automaticRejection: true,
    escalationAllowed: true,
    applicableSegments: ['SMALL', 'MEDIUM'],
    applicableProducts: 'ALL',
    status: 'PROMETEIA_PROPOSED',
    sourceRef: 'ATB ERM Diagnostic — pre-screening threshold 399',
    effectiveFrom: '2026-01-01',
    enabled: false,
    evaluator: 'prescreenBureauScore',
  },
];

/* ================================================================== */
/* Collateral haircuts (§39)                                           */
/* ================================================================== */

export interface CollateralHaircutConfig extends VersionedArtifact {
  id: string;
  /** Percent deducted from forced-sale value to obtain eligible value. */
  haircuts: Record<string, number>;
  /** Types that are not counted toward eligible coverage at all. */
  ineligibleTypes: string[];
}

export const COLLATERAL_HAIRCUTS_V1: CollateralHaircutConfig = {
  id: 'COLLATERAL_HAIRCUTS_V1',
  version: 'v1',
  label: 'Girov diskontları',
  status: 'INFERRED',
  effectiveFrom: '2026-01-01',
  sourceRef:
    'Mənbə sənədlərdə likvid dəyər istifadə olunur, ayrıca diskont cədvəli verilməyib — indikativ dəyərlər, admin tərəfindən dəyişdirilə bilər',
  haircuts: {
    REAL_ESTATE_RESIDENTIAL: 0,
    REAL_ESTATE_COMMERCIAL: 10,
    REAL_ESTATE_LAND: 25,
    EQUIPMENT: 30,
    VEHICLE: 25,
    CASH_DEPOSIT: 0,
    RECEIVABLES: 50,
    INVENTORY: 50,
    PERSONAL_GUARANTEE: 100,
    CORPORATE_GUARANTEE: 100,
  },
  ineligibleTypes: ['PERSONAL_GUARANTEE', 'CORPORATE_GUARANTEE'],
};

/* ================================================================== */
/* Covenant templates (§57)                                            */
/* ================================================================== */

export interface CovenantTemplate {
  key: string;
  labelAz: string;
  labelEn: string;
  metric: string;
  operator: 'GTE' | 'LTE';
  defaultThreshold: number;
  defaultFrequency: 'MONTHLY' | 'QUARTERLY' | 'SEMI_ANNUAL' | 'ANNUAL';
  breachAction: string;
}

export const COVENANT_TEMPLATES: CovenantTemplate[] = [
  {
    key: 'DEBT_TO_EBITDA',
    labelAz: 'Borc / EBITDA',
    labelEn: 'Debt / EBITDA',
    metric: 'debtToEbitda',
    operator: 'LTE',
    defaultThreshold: 3.5,
    defaultFrequency: 'QUARTERLY',
    breachAction: 'Faiz dərəcəsinin artırılması və ya əlavə təminat tələbi',
  },
  {
    key: 'DSCR',
    labelAz: 'DSCR',
    labelEn: 'DSCR',
    metric: 'dscrCurrent',
    operator: 'GTE',
    defaultThreshold: 1.25,
    defaultFrequency: 'QUARTERLY',
    breachAction: 'Kredit komitəsinə təkrar baxış',
  },
  {
    key: 'EQUITY_TO_ASSETS',
    labelAz: 'Kapital / Aktivlər',
    labelEn: 'Equity / Assets',
    metric: 'equityToAssets',
    operator: 'GTE',
    defaultThreshold: 0.3,
    defaultFrequency: 'SEMI_ANNUAL',
    breachAction: 'Sahibkar tərəfindən kapital qoyuluşu tələbi',
  },
  {
    key: 'CURRENT_RATIO',
    labelAz: 'Cari likvidlik əmsalı',
    labelEn: 'Current Ratio',
    metric: 'currentRatio',
    operator: 'GTE',
    defaultThreshold: 1.2,
    defaultFrequency: 'QUARTERLY',
    breachAction: 'Dövriyyə vəsaiti limitinin dondurulması',
  },
  {
    key: 'MIN_TURNOVER',
    labelAz: 'Minimum bank dövriyyəsi',
    labelEn: 'Minimum bank turnover',
    metric: 'annualBankTurnover',
    operator: 'GTE',
    defaultThreshold: 0,
    defaultFrequency: 'QUARTERLY',
    breachAction: 'Komissiya tətbiqi və ya limitin azaldılması',
  },
  {
    key: 'DIVIDEND_RESTRICTION',
    labelAz: 'Dividend / sahibkar çıxarışlarının məhdudlaşdırılması',
    labelEn: 'Dividend restriction',
    metric: 'ownerWithdrawals',
    operator: 'LTE',
    defaultThreshold: 0,
    defaultFrequency: 'ANNUAL',
    breachAction: 'Kredit üzrə defolt hadisəsi',
  },
  {
    key: 'ADDITIONAL_DEBT_RESTRICTION',
    labelAz: 'Əlavə borclanmanın məhdudlaşdırılması',
    labelEn: 'Additional debt restriction',
    metric: 'totalBankDebt',
    operator: 'LTE',
    defaultThreshold: 0,
    defaultFrequency: 'QUARTERLY',
    breachAction: 'Kreditin vaxtından əvvəl tələb edilməsi',
  },
  {
    key: 'COLLATERAL_COVERAGE',
    labelAz: 'Girov örtüyü',
    labelEn: 'Collateral coverage',
    metric: 'eligibleCollateralCoverage',
    operator: 'GTE',
    defaultThreshold: 1.0,
    defaultFrequency: 'ANNUAL',
    breachAction: 'Əlavə girov təqdim edilməsi',
  },
];
