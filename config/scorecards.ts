import type { VersionedArtifact } from '@/types/core';

/* ================================================================== */
/* 1. Legacy ATB "Yekun rəy" expert assessment (§40)                   */
/* ================================================================== */

/**
 * ATB's existing underwriting-opinion scorecard, modelled directly on the
 * `Rəy forması` sheet of the Underwriting Centre workbook and on
 * "Kiçik və Orta Biznes krediti sifarişlərinə Anderraytinq Mərkəzi
 * tərəfindən rəy verilməsi Metodologiyası".
 *
 * This is an EXPERT ASSESSMENT, not the Final Internal Rating. It is a
 * separate, versioned engine (As-Is Expert Assessment) and must never be
 * merged with the Prometeia rating waterfall.
 *
 * Two mechanics from the source are reproduced exactly:
 *  - criteria 1, 4, 5 are weighted sums of discrete answers;
 *  - criteria 2 and 3 are the ARITHMETIC MEAN of manually-scored 0..100
 *    sub-blocks, scaled to the criterion's point budget;
 *  - a stop factor zeroes its criterion, and a zeroed criterion 1..4
 *    zeroes the whole opinion (Excel `J109` OR-guard). Collateral is
 *    explicitly excluded from that guard.
 */

export type LegacyComponentType = 'OPTION' | 'MANUAL_0_100';

export interface LegacyScoreOption {
  key: string;
  labelAz: string;
  labelEn: string;
  /** Share of the component's weight earned by this answer, 0..1. */
  achievement: number;
  /** Marks answers that are adverse for the reader even when they score. */
  adverse?: boolean;
}

export interface LegacyStopRule {
  /** ZERO: component scored 0. LTE: manual score <= value. */
  when: 'ZERO' | 'LTE';
  value?: number;
  messageAz: string;
  messageEn: string;
  sourceRef: string;
  /** Sectors for which the stop factor is waived (PDF §6.2, §6.3). */
  waivedForSectors?: string[];
  waiverNote?: string;
}

export interface LegacyComponent {
  key: string;
  labelAz: string;
  labelEn: string;
  /** Percent of the criterion's points (OPTION) or of the mean (MANUAL). */
  weightWithinCategory: number;
  type: LegacyComponentType;
  guidanceAz: string;
  options?: LegacyScoreOption[];
  stopRule?: LegacyStopRule;
  sourceRef: string;
}

export interface LegacyCategory {
  key: string;
  labelAz: string;
  labelEn: string;
  /** Points out of 100. */
  weight: number;
  aggregation: 'WEIGHTED_SUM' | 'MEAN_OF_MANUAL_SCORES';
  components: LegacyComponent[];
  /** True for criteria 1..4 — a zero here zeroes the whole opinion. */
  participatesInGlobalStop: boolean;
  /** Purpose criterion: only zeroed when BOTH listed components are zero. */
  jointStopComponents?: string[];
  /**
   * Credit-history special case: when history does not exist, only the
   * first component is assessed and the criterion is capped (PDF §4.10).
   */
  noHistoryCapPct?: number;
}

export interface LegacyRiskBand {
  min: number;
  labelAz: string;
  labelEn: string;
  tone: string;
}

export interface LegacyScorecard extends VersionedArtifact {
  id: string;
  categories: LegacyCategory[];
  /** Applied with >= on the total (points) and on each criterion (percent). */
  bands: LegacyRiskBand[];
}

const YES_EARNS: LegacyScoreOption[] = [
  { key: 'YES', labelAz: 'Bəli', labelEn: 'Yes', achievement: 1 },
  { key: 'NO', labelAz: 'Xeyr', labelEn: 'No', achievement: 0, adverse: true },
];

const NO_EARNS: LegacyScoreOption[] = [
  { key: 'NO', labelAz: 'Xeyr', labelEn: 'No', achievement: 1 },
  { key: 'YES', labelAz: 'Bəli', labelEn: 'Yes', achievement: 0, adverse: true },
];

export const LEGACY_SCORECARD_V1: LegacyScorecard = {
  id: 'ATB_YEKUN_REY_V1',
  version: 'v1 (form 01.11.2025–14.07.2026)',
  label: 'ATB Yekun Rəy — As-Is Expert Assessment',
  status: 'CURRENT',
  effectiveFrom: '2025-11-01',
  sourceRef:
    'Kiçik və Orta Biznes krediti sifarişlərinə Anderraytinq Mərkəzi tərəfindən rəy verilməsi Metodologiyası (İH təsdiqi); Rəy forması sheet, cells J31–J109',
  bands: [
    { min: 86, labelAz: 'Aşağı riskli', labelEn: 'Low risk', tone: 'emerald' },
    { min: 71, labelAz: 'Orta aşağı riskli', labelEn: 'Medium-low risk', tone: 'lime' },
    { min: 56, labelAz: 'Orta riskli', labelEn: 'Medium risk', tone: 'amber' },
    { min: 41, labelAz: 'Orta yüksək riskli', labelEn: 'Medium-high risk', tone: 'orange' },
    { min: 0, labelAz: 'Yüksək riskli', labelEn: 'High risk', tone: 'rose' },
  ],
  categories: [
    {
      key: 'CREDIT_HISTORY',
      labelAz: 'Kredit tarixçəsinin təhlili',
      labelEn: 'Credit History Analysis',
      weight: 20,
      aggregation: 'WEIGHTED_SUM',
      participatesInGlobalStop: true,
      noHistoryCapPct: 60,
      components: [
        {
          key: 'AKB_EXTRACTS_OBTAINED',
          labelAz: 'Biznesə aidiyyatı olan şəxslərin AKB çıxarışlarının alınması',
          labelEn: 'AKB extracts obtained for all persons connected to the business',
          weightWithinCategory: 35,
          type: 'OPTION',
          options: YES_EARNS,
          guidanceAz:
            'Sahibkar, təsisçilər, qərar verən şəxslər, menecerlər, biznes sənədlərində görünən və biznes üçün borc götürmüş ola biləcək bütün şəxslər üzrə AKB çıxarışları alınmalıdır.',
          stopRule: {
            when: 'ZERO',
            messageAz: 'AKB çıxarışları alınmayıb — obyektiv qiymətləndirmə mümkün deyil.',
            messageEn: 'Bureau extracts not obtained — objective assessment impossible.',
            sourceRef: 'Metodologiya §4.3, §4.10',
          },
          sourceRef: 'Rəy forması J34',
        },
        {
          key: 'UNJUSTIFIED_RECENT_INQUIRIES',
          labelAz: 'AKB çıxarışlarında yaxın zamanda nəticəsi əsaslandırılmamış kredit müraciətləri',
          labelEn: 'Recent credit inquiries with unexplained outcome',
          weightWithinCategory: 5,
          type: 'OPTION',
          options: NO_EARNS,
          guidanceAz: 'Əsasən son 1 ay ərzində edilmiş və nəticəsi izah edilməyən müraciətlər.',
          sourceRef: 'Rəy forması J35',
        },
        {
          key: 'UNJUSTIFIED_DPD_0_30',
          labelAz: 'Bank öhdəlikləri üzrə 0-30 gün əsaslandırılmamış gecikmələr',
          labelEn: 'Unjustified 0–30 day delinquencies',
          weightWithinCategory: 10,
          type: 'OPTION',
          options: NO_EARNS,
          guidanceAz: 'Texniki və sənədlə əsaslandırılmış gecikmələr üçün "Xeyr" seçilir və şərh yazılır.',
          sourceRef: 'Rəy forması J36',
        },
        {
          key: 'UNJUSTIFIED_DPD_30_PLUS',
          labelAz: 'Bank öhdəlikləri üzrə əsaslandırılmamış 30+ gün gecikmələr',
          labelEn: 'Unjustified 30+ day delinquencies',
          weightWithinCategory: 20,
          type: 'OPTION',
          options: NO_EARNS,
          guidanceAz: 'Sənədlə əsaslandırıldıqda "Xeyr" seçilir və izah verilir.',
          stopRule: {
            when: 'ZERO',
            messageAz: 'Əsaslandırılmamış 30+ gün gecikmə mövcuddur.',
            messageEn: 'Unjustified 30+ day delinquency present.',
            sourceRef: 'Metodologiya §4.6',
          },
          sourceRef: 'Rəy forması J37',
        },
        {
          key: 'REPAID_BY_INSTALMENTS',
          labelAz: 'Kreditlərin aylıq ödənişlərlə bağlanması',
          labelEn: 'Loans closed through ordinary monthly instalments',
          weightWithinCategory: 15,
          type: 'OPTION',
          options: YES_EARNS,
          guidanceAz:
            'Bağlanmış və aktiv kreditlərin ilkin məbləğinin aylıq ödənişlərlə bağlanan hissəsi 50%-dən çox olduqda qənaətbəxş sayılır (AKBÇ təhlili E70).',
          sourceRef: 'Rəy forması J38; Metodologiya §4.7',
        },
        {
          key: 'DEBT_BURDEN_INCREASE',
          labelAz: 'Borc yükünün artması',
          labelEn: 'Increase in debt burden',
          weightWithinCategory: 15,
          type: 'OPTION',
          options: NO_EARNS,
          guidanceAz:
            'Yeni aylıq ödənişin son 6-12 ayda paralel xidmət edilən maksimum ödənişə nisbətən 50%-dən çox artması arzuolunmazdır (Aylıq ödəniş cədvəli).',
          sourceRef: 'Rəy forması J39; Metodologiya §4.8',
        },
      ],
    },
    {
      key: 'BUSINESS',
      labelAz: 'Biznes fəaliyyətinin təhlili',
      labelEn: 'Business Activity Analysis',
      weight: 20,
      aggregation: 'MEAN_OF_MANUAL_SCORES',
      participatesInGlobalStop: true,
      components: [
        {
          key: 'BUSINESS_OWNERSHIP_LINK',
          labelAz: 'Biznesin sifarişçiyə aidiyyatı və digər məqamlar',
          labelEn: 'Applicant’s connection to / ownership of the business',
          weightWithinCategory: 33.34,
          type: 'MANUAL_0_100',
          guidanceAz:
            'Təsdiqedici dəlillər: VÖEN, hüquqi şəxs/sahibkar sənədləri, obyektin mülkiyyət sənədi və ya icarə müqaviləsi, kassa qəbzi, mal alış müqavilələri və qaimələr, yük ödəniş qəbzləri, sahibkar hesabının dövriyyəsi, satış müqavilələri, əsas vəsait sənədləri, vizit kartı və reklam nömrəsi, internet və sosial media səhifələri. Nə qədər çox dəlil — bir o qədər yüksək bal.',
          stopRule: {
            when: 'LTE',
            value: 40,
            messageAz:
              'Biznesin sifarişçiyə aidiyyatı sənəd və faktlarla təsdiqlənmir və ya dövr gəliri sifarişçinin sosial vəziyyətinə uyğun deyil.',
            messageEn: 'Business ownership not evidenced, or income inconsistent with the applicant’s standing.',
            sourceRef: 'Metodologiya §5.1.1',
          },
          sourceRef: 'Rəy forması J47',
        },
        {
          key: 'STRUCTURE_AND_MANAGEMENT',
          labelAz: 'Biznesin quruluşu və idarəetmə ekspertizası',
          labelEn: 'Business structure and management expertise',
          weightWithinCategory: 33.33,
          type: 'MANUAL_0_100',
          guidanceAz:
            'Rəsmi fəaliyyət müddəti (11-15+ / 6-10 / 3-5 il aşağı risk, 1-2 il orta, <1 il yüksək), qeyri-rəsmi fəaliyyət müddəti, idarəetmə modeli (özü və ailə üzvləri / şəriklər / muzdlu menecer asılılığı).',
          sourceRef: 'Rəy forması J51; Metodologiya §5.1.2',
        },
        {
          key: 'DOCUMENTATION_REPORTING',
          labelAz: 'Sənədləşmə və hesabatlıq',
          labelEn: 'Documentation and reporting',
          weightWithinCategory: 33.33,
          type: 'MANUAL_0_100',
          guidanceAz:
            'Qeydiyyat dəftəri, anbar uçotu, debitor/kreditor siyahıları, kompüter proqramı, vergi hesabatları. Risk bandının seçilməsi subyektivliyi məhdudlaşdırır.',
          sourceRef: 'Rəy forması J55; Metodologiya §5.1.3',
        },
      ],
    },
    {
      key: 'FINANCIAL',
      labelAz: 'Maliyyə məlumatlarının təhlili',
      labelEn: 'Financial Information Analysis',
      weight: 35,
      aggregation: 'MEAN_OF_MANUAL_SCORES',
      participatesInGlobalStop: true,
      components: [
        {
          key: 'BALANCE_SHEET',
          labelAz: 'Balans',
          labelEn: 'Balance Sheet',
          weightWithinCategory: 20,
          type: 'MANUAL_0_100',
          guidanceAz:
            'Aşağı risk: debitorlar, avanslar, ehtiyatlar, əsas vəsaitlər və kreditor öhdəlikləri rəsmi və ya yazılı qeydlərlə təsdiqlənir. Orta risk: ehtiyatlar fiziki sayımla, əsas vəsaitlər bazar araşdırması/analogiya ilə. Yüksək risk: yalnız şifahi məlumat.',
          stopRule: {
            when: 'ZERO',
            messageAz:
              'Kapitala nəzərən borclanma əmsalı (yeni kredit daxil olmaqla cəmi öhdəliklər / kapital) 100%-i keçir.',
            messageEn: 'Debt-to-equity including the new facility exceeds 100%.',
            sourceRef: 'Metodologiya §6.2',
            waivedForSectors: ['Xidmət'],
            waiverNote: 'Xidmət sektoru üzrə digər amillər əsasında stop faktor tətbiq edilməyə bilər.',
          },
          sourceRef: 'Rəy forması J63',
        },
        {
          key: 'INCOME_STATEMENT',
          labelAz: 'Mənfəət və Zərər Hesabatı (MZH)',
          labelEn: 'Income Statement',
          weightWithinCategory: 20,
          type: 'MANUAL_0_100',
          guidanceAz:
            'Satışın mənbələrinin, maya dəyərinin və xərclərin realllığının təsdiqi. Aşağı risk: vergi bəyannaməsi, hesaba köçürmələr, kassa/barkod/kompüter qeydləri. Orta risk: WAGM cədvəli, qismən qeydlərdən çıxarılan və digər hesabatlarla uzlaşan satış. Yüksək risk: şifahi marja və bazardan aşağı xərclər.',
          stopRule: {
            when: 'ZERO',
            messageAz:
              'Bölüşdürülməmiş mənfəətin aylıq ödənişə nisbəti norması pozulur (aylıq ödəniş / proqnoz ödəmə qabiliyyəti > 0.8).',
            messageEn: 'Retained-profit to monthly-payment norm breached (payment / capacity > 0.8).',
            sourceRef: 'Metodologiya §6.3; KOB kreditlərinin verilməsi Metodologiyası (0.8 əmsalı)',
            waivedForSectors: ['Kənd təsərrüfatı'],
            waiverNote: 'Proqnoz pul axını hesabatı ödəmə qabiliyyətini göstərdikdə tətbiq edilmir.',
          },
          sourceRef: 'Rəy forması J69',
        },
        {
          key: 'CASH_FLOWS',
          labelAz: 'Nağd pul axınları',
          labelEn: 'Cash Flows',
          weightWithinCategory: 20,
          type: 'MANUAL_0_100',
          guidanceAz:
            'Cari və proqnoz pul axını hesabatının strukturu, DSCR-in cari və proqnoz qiymətləri, sahib qoyuluşlarının və çıxarışlarının sənədli təsdiqi.',
          sourceRef: 'Rəy forması J74',
        },
        {
          key: 'STATEMENT_COMPARISON',
          labelAz: 'Maliyyə hesabatlarının müqayisəsi',
          labelEn: 'Cross-comparison of financial statements',
          weightWithinCategory: 20,
          type: 'MANUAL_0_100',
          guidanceAz:
            'Üç uzlaşma: (a) MZH satışı ↔ debitor artımı ↔ pul daxilolmaları; (b) MZH maya dəyəri ↔ təchizatçı ödənişləri ↔ ehtiyat və kreditor dəyişməsi; (c) dövrün bölüşdürülməmiş mənfəəti ↔ kapital artımı ↔ biznesdənkənar xərclər.',
          sourceRef: 'Rəy forması J78; Metodologiya §6.5',
        },
        {
          key: 'RATIOS',
          labelAz: 'Maliyyə əmsalları',
          labelEn: 'Financial Ratios',
          weightWithinCategory: 20,
          type: 'MANUAL_0_100',
          guidanceAz: 'Kapital dayanıqlığı, likvidlik və rentabellik üzrə əmsalların normalarla müqayisəsi.',
          sourceRef: 'Rəy forması J83; Metodologiya §6.6',
        },
      ],
    },
    {
      key: 'PURPOSE',
      labelAz: 'Kreditin təyinatının təhlili',
      labelEn: 'Loan Purpose Analysis',
      weight: 15,
      aggregation: 'WEIGHTED_SUM',
      participatesInGlobalStop: true,
      jointStopComponents: ['PURPOSE_EFFICIENCY', 'PURPOSE_CONTROL'],
      components: [
        {
          key: 'PURPOSE_DOCUMENTS',
          labelAz: 'Kreditin təyinatı üzrə təsdiqedici sənədlərinin olması',
          labelEn: 'Supporting documents for the loan purpose',
          weightWithinCategory: 25,
          type: 'OPTION',
          options: [
            { key: 'PRESENT', labelAz: 'Var', labelEn: 'Present', achievement: 1 },
            { key: 'PARTIAL', labelAz: 'Qismən var', labelEn: 'Partially present', achievement: 0.5 },
            { key: 'ABSENT', labelAz: 'Yoxdur', labelEn: 'Absent', achievement: 0, adverse: true },
          ],
          guidanceAz: 'Müqavilə, hesab-faktura, smeta, qaimə, alqı-satqı sənədləri.',
          sourceRef: 'Rəy forması J87',
        },
        {
          key: 'PURPOSE_EFFICIENCY',
          labelAz: 'Kreditin təyinatının səmərəliliyi',
          labelEn: 'Efficiency of the loan purpose',
          weightWithinCategory: 50,
          type: 'OPTION',
          options: [
            { key: 'EFFICIENT', labelAz: 'Səmərəlidir', labelEn: 'Efficient', achievement: 1 },
            { key: 'PARTIAL', labelAz: 'Qismən səmərəlidir', labelEn: 'Partially efficient', achievement: 0.5 },
            { key: 'INEFFICIENT', labelAz: 'Səmərəsizdir', labelEn: 'Inefficient', achievement: 0, adverse: true },
            {
              key: 'NOT_MEASURED',
              labelAz: 'Səmərəsi ölçülməyib',
              labelEn: 'Efficiency not measured',
              achievement: 0,
              adverse: true,
            },
          ],
          guidanceAz: 'Kreditin biznesə real gəlir və pul axını effekti, geri qaytarılma müddəti.',
          sourceRef: 'Rəy forması J88',
        },
        {
          key: 'PURPOSE_CONTROL',
          labelAz: 'Təyinata nəzarət imkanının olması',
          labelEn: 'Ability to control the use of proceeds',
          weightWithinCategory: 25,
          type: 'OPTION',
          options: [
            { key: 'POSSIBLE', labelAz: 'İmkan var', labelEn: 'Possible', achievement: 1 },
            { key: 'PARTIAL', labelAz: 'Qismən imkan var', labelEn: 'Partially possible', achievement: 0.5 },
            { key: 'NOT_POSSIBLE', labelAz: 'İmkan yoxdur', labelEn: 'Not possible', achievement: 0, adverse: true },
          ],
          guidanceAz: 'Vəsaitin təyinatı üzrə istifadəsinin sənəd və monitorinq ilə izlənməsi imkanı.',
          sourceRef: 'Rəy forması J89',
        },
      ],
    },
    {
      key: 'COLLATERAL',
      labelAz: 'Təminatın təhlili',
      labelEn: 'Collateral Analysis',
      weight: 10,
      aggregation: 'WEIGHTED_SUM',
      participatesInGlobalStop: false,
      components: [
        {
          key: 'COLLATERAL_OWNER_RELATION',
          labelAz: 'Daşınmaz əmlak təminatının biznes payçısına və ya yaxın ailə üzvlərinə aidiyyatı',
          labelEn: 'Real-estate collateral belongs to a shareholder or close family member',
          weightWithinCategory: 50,
          type: 'OPTION',
          options: [
            { key: 'YES', labelAz: 'Var', labelEn: 'Yes', achievement: 1 },
            { key: 'PARTIAL', labelAz: 'Qismən var', labelEn: 'Partially', achievement: 0.5 },
            { key: 'NO', labelAz: 'Yoxdur', labelEn: 'No', achievement: 0, adverse: true },
          ],
          guidanceAz: 'Girov sahibinin borcalanla maraq uyğunluğu.',
          sourceRef: 'Rəy forması J94',
        },
        {
          key: 'COLLATERAL_RISK_GRADE',
          labelAz: 'Daşınmaz əmlakın risk dərəcəsi',
          labelEn: 'Risk grade of the real estate',
          weightWithinCategory: 20,
          type: 'OPTION',
          options: [
            { key: 'LOW', labelAz: 'Aşağı riskli', labelEn: 'Low risk', achievement: 1 },
            { key: 'MEDIUM', labelAz: 'Orta riskli', labelEn: 'Medium risk', achievement: 0.5 },
            { key: 'HIGH', labelAz: 'Yüksək riskli', labelEn: 'High risk', achievement: 0, adverse: true },
          ],
          guidanceAz: 'Likvidlik, yerləşmə, qiymətləndirmə keyfiyyəti, sığorta və hüquqi risklər.',
          sourceRef: 'Rəy forması J95',
        },
        {
          key: 'GUARANTOR_SUITABILITY',
          labelAz: 'Zamin(lər)in sifarişə uyğunluğu',
          labelEn: 'Suitability of the guarantor(s)',
          weightWithinCategory: 30,
          type: 'OPTION',
          options: [
            { key: 'SUITABLE', labelAz: 'Uyğundur', labelEn: 'Suitable', achievement: 1 },
            { key: 'PARTIAL', labelAz: 'Qismən uyğundur', labelEn: 'Partially suitable', achievement: 0.5 },
            { key: 'UNSUITABLE', labelAz: 'Uyğun deyil', labelEn: 'Unsuitable', achievement: 0, adverse: true },
          ],
          guidanceAz: 'Zaminin gəliri, kredit tarixçəsi və öhdəlik götürmə qabiliyyəti.',
          sourceRef: 'Rəy forması J96',
        },
      ],
    },
  ],
};

export const LEGACY_SCORECARDS: Record<string, LegacyScorecard> = {
  [LEGACY_SCORECARD_V1.id]: LEGACY_SCORECARD_V1,
};

/* ================================================================== */
/* 2. Prometeia business-analysis scorecard (§42)                      */
/* ================================================================== */

export interface BusinessDimension {
  key: string;
  labelAz: string;
  labelEn: string;
  anchors: Record<1 | 2 | 3, string>;
  supportingEvidence: string[];
}

export interface BusinessArea {
  key: string;
  labelAz: string;
  labelEn: string;
  /** Area score = arithmetic mean of its dimensions (1..3). */
  dimensions: BusinessDimension[];
}

export interface BusinessScorecard extends VersionedArtifact {
  id: string;
  areas: BusinessArea[];
  minScore: number;
  maxScore: number;
}

export const BUSINESS_SCORECARD_PROMETEIA_V1: BusinessScorecard = {
  id: 'PROMETEIA_QUICK_WIN_V1',
  version: 'v1',
  label: 'Prometeia Business Analysis (Quick Win)',
  status: 'PROMETEIA_PROPOSED',
  effectiveFrom: '2026-01-01',
  sourceRef: 'ATB ERM Diagnostic Status Meeting 07.08.2026 — Business Analysis assessment areas',
  minScore: 3,
  maxScore: 9,
  areas: [
    {
      key: 'RELATIONSHIP_VERIFICATION',
      labelAz: 'Biznes əlaqəsi / mülkiyyətin təsdiqi',
      labelEn: 'Business relationship / ownership verification',
      dimensions: [
        {
          key: 'RELATIONSHIP_VERIFICATION',
          labelAz: 'Sifarişçinin biznesə aidiyyətinin sənədli təsdiqi',
          labelEn: 'Documented link between applicant and business',
          anchors: {
            3: 'Aşağı risk — VÖEN, qeydiyyat, mülkiyyət/icarə, qaimələr, bank və POS dövriyyəsi tam uzlaşır.',
            2: 'Orta risk — əsas sənədlər var, lakin bəzi təsdiqlər natamamdır.',
            1: 'Yüksək risk — aidiyyət əsasən şifahi məlumata əsaslanır.',
          },
          supportingEvidence: [
            'VÖEN',
            'Qeydiyyat sənədi',
            'Mülkiyyət / icarə müqaviləsi',
            'Alış-satış qaimələri',
            'Bank çıxarışı',
            'POS dövriyyəsi',
            'Müqavilələr',
          ],
        },
      ],
    },
    {
      key: 'STRUCTURE_AND_MANAGEMENT',
      labelAz: 'Biznesin strukturu və idarəetmə təcrübəsi',
      labelEn: 'Business structure and management expertise',
      dimensions: [
        {
          key: 'TRACK_RECORD',
          labelAz: 'Fəaliyyət tarixçəsi / idarəetmə təcrübəsi',
          labelEn: 'Track record / management experience',
          anchors: {
            3: 'Uzunmüddətli sektor təcrübəsi (6+ il), sabit idarəetmə komandası.',
            2: 'Orta müddətli təcrübə (3-5 il) və ya qismən dəyişkən idarəetmə.',
            1: 'Qısa fəaliyyət tarixçəsi (<3 il) və ya təcrübəsiz idarəetmə.',
          },
          supportingEvidence: ['Rəsmi fəaliyyət müddəti', 'Qeyri-rəsmi fəaliyyət müddəti', 'Rəhbərin sektor təcrübəsi'],
        },
        {
          key: 'BUSINESS_STRUCTURE',
          labelAz: 'Biznes strukturu (müştəri/təchizatçı, əməliyyat modeli)',
          labelEn: 'Business structure',
          anchors: {
            3: 'Diversifikasiya olunmuş müştəri və təchizatçı bazası, aydın əməliyyat modeli.',
            2: 'Müəyyən konsentrasiya və ya mürəkkəb qrupdaxili əməliyyatlar.',
            1: 'Yüksək konsentrasiya, açar şəxsdən yüksək asılılıq, qeyri-şəffaf struktur.',
          },
          supportingEvidence: ['Müştəri konsentrasiyası', 'Təchizatçı konsentrasiyası', 'Qrupdaxili əməliyyatlar'],
        },
      ],
    },
    {
      key: 'DOCUMENTATION_REPORTING',
      labelAz: 'Sənədləşmə və hesabatlılıq',
      labelEn: 'Documentation and reporting',
      dimensions: [
        {
          key: 'DOCUMENTATION_REPORTING',
          labelAz: 'Uçot və hesabatlılığın keyfiyyəti',
          labelEn: 'Quality of records and reporting',
          anchors: {
            3: 'Sistemli uçot, qeydiyyat dəftəri, anbar və debitor uçotu, vergi hesabatları uzlaşır.',
            2: 'Uçot qismən aparılır, bəzi göstəricilər analitik qiymətləndirmədir.',
            1: 'Uçot yoxdur və ya rəqəmlər əsasən şifahi məlumatdır.',
          },
          supportingEvidence: ['Qeydiyyat dəftəri', 'Anbar uçotu', 'Debitor / kreditor siyahısı', 'Vergi bəyannaməsi'],
        },
      ],
    },
  ],
};

export const BUSINESS_SCORECARDS: Record<string, BusinessScorecard> = {
  [BUSINESS_SCORECARD_PROMETEIA_V1.id]: BUSINESS_SCORECARD_PROMETEIA_V1,
};

/* ================================================================== */
/* 3. Data-quality rating (§30)                                        */
/* ================================================================== */

export interface DataQualityFactor {
  key: string;
  labelAz: string;
  labelEn: string;
  weight: number;
  /** Document categories / metric keys that satisfy this factor. */
  evidenceKeys: string[];
}

export interface DataQualityConfig extends VersionedArtifact {
  id: string;
  factors: DataQualityFactor[];
  bands: Array<{ grade: 'A' | 'B' | 'C' | 'D' | 'E'; min: number; labelAz: string; labelEn: string }>;
  evidenceWeight: Record<string, number>;
}

export const DATA_QUALITY_V1: DataQualityConfig = {
  id: 'DATA_QUALITY_V1',
  version: 'v1',
  label: 'Məlumat keyfiyyəti reytinqi (Data Quality Rating)',
  status: 'BANK_PROPOSED',
  effectiveFrom: '2026-01-01',
  sourceRef:
    'Derived from the evidence hierarchies in Metodologiya §6.2-§6.4 and "KOB və Orta Biznes kreditlərində müştərilərin sənədləşməsində təhlil məqamları"',
  evidenceWeight: {
    VERIFIED: 1,
    PARTIALLY_VERIFIED: 0.65,
    VERBAL: 0.25,
    ANALYST_ESTIMATE: 0.35,
    MISSING: 0,
    CONTRADICTORY: 0,
  },
  factors: [
    { key: 'TAX', labelAz: 'Vergi məlumatları', labelEn: 'Tax information', weight: 15, evidenceKeys: ['TAX'] },
    {
      key: 'BANK',
      labelAz: 'Bank çıxarışları',
      labelEn: 'Bank statements',
      weight: 15,
      evidenceKeys: ['BANK_STATEMENT'],
    },
    {
      key: 'INVENTORY',
      labelAz: 'Mal-material qalığının təsdiqi',
      labelEn: 'Inventory evidence',
      weight: 12,
      evidenceKeys: ['INVENTORY_LIST'],
    },
    {
      key: 'RECEIVABLES',
      labelAz: 'Debitor borclarının təsdiqi',
      labelEn: 'Receivable evidence',
      weight: 10,
      evidenceKeys: ['RECEIVABLE_LIST'],
    },
    {
      key: 'SUPPLIERS',
      labelAz: 'Kreditor / təchizatçı təsdiqi',
      labelEn: 'Supplier evidence',
      weight: 10,
      evidenceKeys: ['PAYABLE_LIST', 'INVOICE'],
    },
    {
      key: 'REPORTING',
      labelAz: 'Maliyyə hesabatlılığı',
      labelEn: 'Financial reporting',
      weight: 12,
      evidenceKeys: ['FINANCIAL_STATEMENT', 'REGISTRY_LEDGER'],
    },
    {
      key: 'COLLATERAL_DOCS',
      labelAz: 'Girov sənədləri',
      labelEn: 'Collateral documents',
      weight: 8,
      evidenceKeys: ['COLLATERAL', 'VALUATION', 'INSURANCE'],
    },
    {
      key: 'PURPOSE_DOCS',
      labelAz: 'Məqsəd sənədləri',
      labelEn: 'Purpose documents',
      weight: 8,
      evidenceKeys: ['CONTRACT', 'INVOICE'],
    },
    {
      key: 'RECONCILIATION',
      labelAz: 'Uzlaşma fərqləri',
      labelEn: 'Reconciliation breaks',
      weight: 6,
      evidenceKeys: [],
    },
    {
      key: 'VERBAL_DEPENDENCY',
      labelAz: 'Şifahi məlumatdan asılılıq',
      labelEn: 'Verbal-data dependency',
      weight: 4,
      evidenceKeys: [],
    },
  ],
  bands: [
    { grade: 'A', min: 90, labelAz: 'Yüksək təsdiqlənmiş', labelEn: 'Highly verified' },
    { grade: 'B', min: 75, labelAz: 'Əsasən təsdiqlənmiş', labelEn: 'Generally verified' },
    { grade: 'C', min: 60, labelAz: 'Material qiymətləndirmələr', labelEn: 'Material estimates' },
    { grade: 'D', min: 40, labelAz: 'Zəif sənədləşmə', labelEn: 'Weak documentation' },
    { grade: 'E', min: 0, labelAz: 'Kifayətsiz / etibarsız', labelEn: 'Insufficient / unreliable' },
  ],
};
