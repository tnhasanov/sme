import type { SourceStatus, VersionedArtifact } from '@/types/core';

/**
 * Config-driven approval routing (§49-§52, §76).
 *
 * Five presets are seeded and kept strictly apart:
 *   ATB_CURRENT_V1            — the live process as described by Prometeia
 *   ATB_INTERNAL_PROPOSAL_V1  — the bank's own discussed alternative (SME Committee)
 *   ATB_INTERNAL_PROPOSAL_V2  — same, renamed committees + higher top buckets
 *   PROMETEIA_PROPOSED_V1     — Prometeia's proposal, SME Committee naming
 *   PROMETEIA_PROPOSED_V2     — Prometeia's proposal, Small/Big Committee naming
 *
 * None of the proposals is production policy. `status` records which is which
 * and the UI always shows it next to the routing decision.
 */

export const AUTHORITIES = [
  'RM',
  'KOB_KM_FINANCIAL_ANALYSIS',
  'KOB_KM_INTERNAL_COMMITTEE',
  'UNDERWRITING_TEAM',
  'DIRECTOR_UW_AND_HEAD_KOB',
  'SME_COMMITTEE',
  'SMALL_COMMITTEE',
  'BIG_COMMITTEE',
  'MANAGEMENT_BOARD',
] as const;
export type Authority = (typeof AUTHORITIES)[number];

export const AUTHORITY_LABEL_AZ: Record<Authority, string> = {
  RM: 'Filial / Müştəri meneceri',
  KOB_KM_FINANCIAL_ANALYSIS: 'KOB KM — Maliyyə təhlili qrupu',
  KOB_KM_INTERNAL_COMMITTEE: 'KOB KM daxili komitəsi',
  UNDERWRITING_TEAM: 'Anderraytinq Mərkəzi',
  DIRECTOR_UW_AND_HEAD_KOB: 'Anderraytinq Mərkəzinin direktoru və KOB Mərkəzinin rəhbəri',
  SME_COMMITTEE: 'KOB Komitəsi (Anderraytinq rəhbəri, Monitorinq rəhbəri, CBO)',
  SMALL_COMMITTEE: 'Kiçik Kredit Komitəsi',
  BIG_COMMITTEE: 'Böyük Kredit Komitəsi',
  MANAGEMENT_BOARD: 'İdarə Heyəti',
};

/** Rank drives escalation: a higher number is a higher authority. */
export const AUTHORITY_RANK: Record<Authority, number> = {
  RM: 1,
  KOB_KM_FINANCIAL_ANALYSIS: 2,
  KOB_KM_INTERNAL_COMMITTEE: 3,
  UNDERWRITING_TEAM: 4,
  DIRECTOR_UW_AND_HEAD_KOB: 5,
  SME_COMMITTEE: 6,
  SMALL_COMMITTEE: 6,
  BIG_COMMITTEE: 7,
  MANAGEMENT_BOARD: 8,
};

export type CollateralCondition = 'ANY' | 'FULLY_COLLATERALISED' | 'NOT_FULLY_COLLATERALISED' | 'MIN_80_PCT';

export interface RoutingBucket {
  key: string;
  labelAz: string;
  /** Inclusive lower bound on the routing basis. */
  minExposure: number;
  /** Exclusive upper bound; Infinity for the top bucket. */
  maxExposure: number;
  collateralCondition: CollateralCondition;
  assessmentAuthority: Authority;
  /** Authority when the escalation condition is NOT met. */
  decisionAuthority: Authority;
  /** Authority when the escalation condition IS met. */
  escalationAuthority?: Authority;
  /**
   * Condition that sends the case to the escalation authority.
   * `RATING_IS_WORST` — final internal rating equals the worst grade.
   * `NOT_COLLATERALISED_AND_WORST` / `..._OR_WORST` encode the documented
   * AND/OR discrepancy; the preset picks one and flags it.
   */
  escalationCondition:
    | 'NONE'
    | 'RATING_IS_WORST'
    | 'UW_ASSESSMENT_NEGATIVE'
    | 'NOT_COLLATERALISED_OR_WORST'
    | 'NOT_COLLATERALISED_AND_WORST';
  /** Which notching layers apply for cases in this bucket. */
  notchingLayers: Array<'BUSINESS' | 'FINANCIAL'>;
  note?: string;
}

export interface WorkflowVersion extends VersionedArtifact {
  id: string;
  /** What the buckets are measured on. */
  routingBasis: 'POST_TRANSACTION_GROUP_EXPOSURE' | 'FINANCED_AMOUNT';
  buckets: RoutingBucket[];
  /** Bureau pre-screen gate applied before routing. */
  preScreenEnabled: boolean;
  preScreenRejectedAuthority: 'BY_EXPOSURE' | Authority;
  /** Stop factors: which authority may still consider the case. */
  stopFactorEscalationAuthority: Authority | 'NONE';
  /** Rejected cases may always be escalated one level, except at the top. */
  escalationOfRejectionsAllowed: boolean;
  /**
   * How the 100–300K collateral/rating condition is combined. The source deck
   * states AND in the flow diagrams and OR in the notching tables; the
   * platform makes the choice explicit rather than picking silently.
   */
  collateralRatingOperator: 'AND' | 'OR';
  operatorNote?: string;
  knownAmbiguities: string[];
}

const layerBusiness: Array<'BUSINESS' | 'FINANCIAL'> = ['BUSINESS'];
const layerBoth: Array<'BUSINESS' | 'FINANCIAL'> = ['BUSINESS', 'FINANCIAL'];

/* ------------------------------------------------------------------ */
/* 1. Current state                                                    */
/* ------------------------------------------------------------------ */

export const WORKFLOW_ATB_CURRENT_V1: WorkflowVersion = {
  id: 'ATB_CURRENT_V1',
  version: 'v1',
  label: 'ATB cari proses',
  status: 'CURRENT',
  effectiveFrom: '2024-01-01',
  sourceRef: 'ATB ERM Diagnostic Status Meeting 07.08.2026, slide 4 (as-is flow)',
  routingBasis: 'POST_TRANSACTION_GROUP_EXPOSURE',
  preScreenEnabled: false,
  preScreenRejectedAuthority: 'BY_EXPOSURE',
  stopFactorEscalationAuthority: 'MANAGEMENT_BOARD',
  escalationOfRejectionsAllowed: true,
  collateralRatingOperator: 'OR',
  knownAmbiguities: [
    'Cari prosesdə ilkin imtina edilən müraciətlər sistemdə saxlanılmır — reject analizi mümkün deyil.',
    'Qrup ekspozisiyası heç bir sistemdə strukturlaşdırılmış şəkildə saxlanılmır; routing faktiki olaraq maliyyələşdirilən məbləğə əsaslanır.',
  ],
  buckets: [
    {
      key: 'LT_50K',
      labelAz: '50.000 AZN-dən aşağı',
      minExposure: 0,
      maxExposure: 50_000,
      collateralCondition: 'ANY',
      assessmentAuthority: 'RM',
      decisionAuthority: 'KOB_KM_INTERNAL_COMMITTEE',
      escalationCondition: 'NONE',
      notchingLayers: [],
      note: 'Filial RM strukturlaşdırılmış qiymətləndirmə formasını doldurur, yekun qərarı KOB Mərkəzinin daxili komitəsi verir.',
    },
    {
      key: 'B_50K_100K',
      labelAz: '50.000 – 100.000 AZN',
      minExposure: 50_000,
      maxExposure: 100_000,
      collateralCondition: 'ANY',
      assessmentAuthority: 'UNDERWRITING_TEAM',
      decisionAuthority: 'KOB_KM_INTERNAL_COMMITTEE',
      escalationAuthority: 'SME_COMMITTEE',
      escalationCondition: 'UW_ASSESSMENT_NEGATIVE',
      notchingLayers: [],
      note: 'Anderraytinq rəyi müsbətdirsə KOB KM, mənfidirsə imtina və ya KOB Komitəsinə eskalasiya.',
    },
    {
      key: 'B_100K_300K',
      labelAz: '100.000 – 300.000 AZN',
      minExposure: 100_000,
      maxExposure: 300_000,
      collateralCondition: 'ANY',
      assessmentAuthority: 'UNDERWRITING_TEAM',
      decisionAuthority: 'SME_COMMITTEE',
      escalationCondition: 'NONE',
      notchingLayers: [],
    },
    {
      key: 'GT_300K',
      labelAz: '300.000 AZN-dən yuxarı',
      minExposure: 300_000,
      maxExposure: Number.POSITIVE_INFINITY,
      collateralCondition: 'ANY',
      assessmentAuthority: 'UNDERWRITING_TEAM',
      decisionAuthority: 'MANAGEMENT_BOARD',
      escalationCondition: 'NONE',
      notchingLayers: [],
      note: 'Geniş forma rəy (Əlavə № 2) tərtib olunur.',
    },
  ],
};

/* ------------------------------------------------------------------ */
/* 2-3. The bank's own internally discussed alternatives               */
/* ------------------------------------------------------------------ */

function internalProposalBuckets(topSplit: 'V1' | 'V2'): RoutingBucket[] {
  const committee: Authority = topSplit === 'V1' ? 'SME_COMMITTEE' : 'SMALL_COMMITTEE';
  const top: Authority = topSplit === 'V1' ? 'MANAGEMENT_BOARD' : 'BIG_COMMITTEE';
  const upperSplit = topSplit === 'V1' ? 500_000 : 700_000;

  return [
    {
      key: 'LT_50K',
      labelAz: '50.000 AZN-dən aşağı',
      minExposure: 0,
      maxExposure: 50_000,
      collateralCondition: 'ANY',
      assessmentAuthority: 'RM',
      decisionAuthority: 'KOB_KM_INTERNAL_COMMITTEE',
      escalationCondition: 'NONE',
      notchingLayers: [],
    },
    {
      key: 'B_50K_100K_FULL_COLL',
      labelAz: '50.000 – 100.000 AZN, tam təminatlı',
      minExposure: 50_000,
      maxExposure: 100_000,
      collateralCondition: 'FULLY_COLLATERALISED',
      assessmentAuthority: 'RM',
      decisionAuthority: 'KOB_KM_INTERNAL_COMMITTEE',
      escalationCondition: 'NONE',
      notchingLayers: [],
    },
    {
      key: 'B_50K_100K_PART_COLL',
      labelAz: '50.000 – 100.000 AZN, tam təminatlı deyil',
      minExposure: 50_000,
      maxExposure: 100_000,
      collateralCondition: 'NOT_FULLY_COLLATERALISED',
      assessmentAuthority: 'UNDERWRITING_TEAM',
      decisionAuthority: 'KOB_KM_INTERNAL_COMMITTEE',
      escalationAuthority: committee,
      escalationCondition: 'UW_ASSESSMENT_NEGATIVE',
      notchingLayers: [],
    },
    {
      key: 'B_100K_200K',
      labelAz: '100.000 – 200.000 AZN',
      minExposure: 100_000,
      maxExposure: 200_000,
      collateralCondition: 'ANY',
      assessmentAuthority: 'UNDERWRITING_TEAM',
      decisionAuthority: 'DIRECTOR_UW_AND_HEAD_KOB',
      escalationAuthority: committee,
      escalationCondition: 'NOT_COLLATERALISED_OR_WORST',
      notchingLayers: [],
      note: '80% təminatlı olduqda direktor səviyyəsində qərar verilir.',
    },
    {
      key: 'B_200K_300K',
      labelAz: '200.000 – 300.000 AZN',
      minExposure: 200_000,
      maxExposure: 300_000,
      collateralCondition: 'ANY',
      assessmentAuthority: 'UNDERWRITING_TEAM',
      decisionAuthority: 'DIRECTOR_UW_AND_HEAD_KOB',
      escalationAuthority: committee,
      escalationCondition: 'NOT_COLLATERALISED_OR_WORST',
      notchingLayers: [],
      note: 'Tam təminatlı olduqda direktor səviyyəsində qərar verilir.',
    },
    {
      key: 'B_300K_UPPER',
      labelAz: topSplit === 'V1' ? '300.000 – 500.000 AZN' : '300.000 – 700.000 AZN',
      minExposure: 300_000,
      maxExposure: upperSplit,
      collateralCondition: 'ANY',
      assessmentAuthority: 'UNDERWRITING_TEAM',
      decisionAuthority: committee,
      escalationCondition: 'NONE',
      notchingLayers: [],
    },
    {
      key: 'GT_UPPER',
      labelAz: topSplit === 'V1' ? '500.000 AZN-dən yuxarı' : '700.000 AZN-dən yuxarı',
      minExposure: upperSplit,
      maxExposure: Number.POSITIVE_INFINITY,
      collateralCondition: 'ANY',
      assessmentAuthority: 'UNDERWRITING_TEAM',
      decisionAuthority: top,
      escalationCondition: 'NONE',
      notchingLayers: [],
    },
  ];
}

export const WORKFLOW_ATB_INTERNAL_PROPOSAL_V1: WorkflowVersion = {
  id: 'ATB_INTERNAL_PROPOSAL_V1',
  version: 'v1',
  label: 'ATB daxili təklif — Versiya 1',
  status: 'BANK_PROPOSED',
  effectiveFrom: '2026-01-01',
  sourceRef: 'ATB ERM Diagnostic, slide 5 — "internally discussed version, not yet implemented"',
  routingBasis: 'POST_TRANSACTION_GROUP_EXPOSURE',
  preScreenEnabled: false,
  preScreenRejectedAuthority: 'BY_EXPOSURE',
  stopFactorEscalationAuthority: 'MANAGEMENT_BOARD',
  escalationOfRejectionsAllowed: true,
  collateralRatingOperator: 'OR',
  knownAmbiguities: ['"Tam təminatlı" və "80% təminatlı" anlayışları rəqəmlə müəyyən edilməyib.'],
  buckets: internalProposalBuckets('V1'),
};

export const WORKFLOW_ATB_INTERNAL_PROPOSAL_V2: WorkflowVersion = {
  ...WORKFLOW_ATB_INTERNAL_PROPOSAL_V1,
  id: 'ATB_INTERNAL_PROPOSAL_V2',
  label: 'ATB daxili təklif — Versiya 2 (Kiçik / Böyük Komitə)',
  sourceRef: 'ATB ERM Diagnostic, slide 6',
  buckets: internalProposalBuckets('V2'),
};

/* ------------------------------------------------------------------ */
/* 4-5. Prometeia proposed                                             */
/* ------------------------------------------------------------------ */

function prometeiaBuckets(variant: 'V1' | 'V2'): RoutingBucket[] {
  const committee: Authority = variant === 'V1' ? 'SME_COMMITTEE' : 'SMALL_COMMITTEE';
  const top: Authority = variant === 'V1' ? 'MANAGEMENT_BOARD' : 'BIG_COMMITTEE';
  const upperSplit = variant === 'V1' ? 500_000 : 700_000;

  return [
    {
      key: 'LT_50K',
      labelAz: '50.000 AZN-dən aşağı',
      minExposure: 0,
      maxExposure: 50_000,
      collateralCondition: 'ANY',
      assessmentAuthority: 'KOB_KM_FINANCIAL_ANALYSIS',
      decisionAuthority: 'KOB_KM_INTERNAL_COMMITTEE',
      escalationAuthority: 'SME_COMMITTEE',
      escalationCondition: 'RATING_IS_WORST',
      notchingLayers: layerBusiness,
    },
    {
      key: 'B_50K_100K_FULL_COLL',
      labelAz: '50.000 – 100.000 AZN, tam təminatlı',
      minExposure: 50_000,
      maxExposure: 100_000,
      collateralCondition: 'FULLY_COLLATERALISED',
      assessmentAuthority: 'KOB_KM_FINANCIAL_ANALYSIS',
      decisionAuthority: 'KOB_KM_INTERNAL_COMMITTEE',
      escalationAuthority: 'SME_COMMITTEE',
      escalationCondition: 'RATING_IS_WORST',
      notchingLayers: layerBusiness,
    },
    {
      key: 'B_50K_100K_PART_COLL',
      labelAz: '50.000 – 100.000 AZN, tam təminatlı deyil',
      minExposure: 50_000,
      maxExposure: 100_000,
      collateralCondition: 'NOT_FULLY_COLLATERALISED',
      assessmentAuthority: 'UNDERWRITING_TEAM',
      decisionAuthority: 'KOB_KM_INTERNAL_COMMITTEE',
      escalationAuthority: committee,
      escalationCondition: 'RATING_IS_WORST',
      notchingLayers: layerBusiness,
    },
    {
      key: 'B_100K_200K',
      labelAz: '100.000 – 200.000 AZN',
      minExposure: 100_000,
      maxExposure: 200_000,
      collateralCondition: 'MIN_80_PCT',
      assessmentAuthority: 'UNDERWRITING_TEAM',
      decisionAuthority: 'DIRECTOR_UW_AND_HEAD_KOB',
      escalationAuthority: committee,
      escalationCondition: 'NOT_COLLATERALISED_OR_WORST',
      notchingLayers: layerBusiness,
      note: '80% təminat VƏ/VƏ YA yekun reytinq ən zəif qiymət deyilsə — direktor səviyyəsi. Operator mübahisəlidir.',
    },
    {
      key: 'B_200K_300K',
      labelAz: '200.000 – 300.000 AZN',
      minExposure: 200_000,
      maxExposure: 300_000,
      collateralCondition: 'FULLY_COLLATERALISED',
      assessmentAuthority: 'UNDERWRITING_TEAM',
      decisionAuthority: 'DIRECTOR_UW_AND_HEAD_KOB',
      escalationAuthority: committee,
      escalationCondition: 'NOT_COLLATERALISED_OR_WORST',
      notchingLayers: layerBusiness,
    },
    {
      key: 'B_300K_UPPER',
      labelAz: variant === 'V1' ? '300.000 – 500.000 AZN' : '300.000 – 700.000 AZN',
      minExposure: 300_000,
      maxExposure: upperSplit,
      collateralCondition: 'ANY',
      assessmentAuthority: 'UNDERWRITING_TEAM',
      decisionAuthority: committee,
      escalationCondition: 'NONE',
      notchingLayers: layerBoth,
    },
    {
      key: 'GT_UPPER',
      labelAz: variant === 'V1' ? '500.000 AZN-dən yuxarı' : '700.000 AZN-dən yuxarı',
      minExposure: upperSplit,
      maxExposure: Number.POSITIVE_INFINITY,
      collateralCondition: 'ANY',
      assessmentAuthority: 'UNDERWRITING_TEAM',
      decisionAuthority: top,
      escalationCondition: 'NONE',
      notchingLayers: layerBoth,
    },
  ];
}

const PROMETEIA_AMBIGUITIES = [
  'Axın diaqramları (slide 18, 20) "80% təminatlı VƏ yekun reytinq ən zəif deyil" yazır, notching cədvəlləri (slide 19, 21) isə "VƏ YA" yazır. Nəticə maddi şəkildə fərqlənir — təsdiq tələb olunur.',
  'V2 diaqramı 200-300k intervalında V1 diaqramı ilə ziddiyyət təşkil edir (VƏ / VƏ YA).',
  '"Tam təminatlı" və "80% təminatlı" rəqəmlə müəyyən edilməyib — uyğun girov dəyərinə görəmi, bazar dəyərinəmi hesablanır?',
  'Pre-screen budağının etiketi "Bureau Rating ≠ Poor OR Satisfactory" məntiqi cəhətdən səhvdir; NOT(Poor OR Satisfactory), yəni skor ≥ 400 nəzərdə tutulur.',
  'V2-də <50k və 50-100k tam təminatlı sətirlərində eskalasiya hədəfi "SME Committee" olaraq qalıb, halbuki digər sətirlərdə "Small Committee" istifadə olunur.',
];

export const WORKFLOW_PROMETEIA_PROPOSED_V1: WorkflowVersion = {
  id: 'PROMETEIA_PROPOSED_V1',
  version: 'v1',
  label: 'Prometeia təklifi — Versiya 1',
  status: 'PROMETEIA_PROPOSED',
  effectiveFrom: '2026-01-01',
  sourceRef: 'ATB ERM Diagnostic, slides 18-19 (Notching Framework Application Logic)',
  routingBasis: 'POST_TRANSACTION_GROUP_EXPOSURE',
  preScreenEnabled: true,
  preScreenRejectedAuthority: 'BY_EXPOSURE',
  stopFactorEscalationAuthority: 'MANAGEMENT_BOARD',
  escalationOfRejectionsAllowed: true,
  collateralRatingOperator: 'OR',
  operatorNote:
    'Notching cədvəlindəki "VƏ YA" seçilib. Axın diaqramı "VƏ" göstərir — konfiqurasiya ilə dəyişdirilə bilər.',
  knownAmbiguities: PROMETEIA_AMBIGUITIES,
  buckets: prometeiaBuckets('V1'),
};

export const WORKFLOW_PROMETEIA_PROPOSED_V2: WorkflowVersion = {
  ...WORKFLOW_PROMETEIA_PROPOSED_V1,
  id: 'PROMETEIA_PROPOSED_V2',
  label: 'Prometeia təklifi — Versiya 2 (Kiçik / Böyük Komitə)',
  sourceRef: 'ATB ERM Diagnostic, slides 20-21',
  stopFactorEscalationAuthority: 'BIG_COMMITTEE',
  buckets: prometeiaBuckets('V2'),
};

export const WORKFLOW_VERSIONS: Record<string, WorkflowVersion> = {
  [WORKFLOW_ATB_CURRENT_V1.id]: WORKFLOW_ATB_CURRENT_V1,
  [WORKFLOW_ATB_INTERNAL_PROPOSAL_V1.id]: WORKFLOW_ATB_INTERNAL_PROPOSAL_V1,
  [WORKFLOW_ATB_INTERNAL_PROPOSAL_V2.id]: WORKFLOW_ATB_INTERNAL_PROPOSAL_V2,
  [WORKFLOW_PROMETEIA_PROPOSED_V1.id]: WORKFLOW_PROMETEIA_PROPOSED_V1,
  [WORKFLOW_PROMETEIA_PROPOSED_V2.id]: WORKFLOW_PROMETEIA_PROPOSED_V2,
};

/** SLA targets per stage (§63). Not present in the sources — indicative. */
export interface SlaConfig extends VersionedArtifact {
  id: string;
  targets: {
    daysToUnderwriting: number;
    daysInUnderwriting: number;
    daysToCommittee: number;
    totalTat: number;
  };
}

export const SLA_V1: SlaConfig = {
  id: 'SLA_V1',
  version: 'v1',
  label: 'SLA hədəfləri',
  status: 'INFERRED',
  effectiveFrom: '2026-01-01',
  sourceRef:
    'Mənbə sənədlərdə SLA göstərilməyib; sifariş trekerində yalnız mərhələ tarixləri var — indikativ hədəflər',
  targets: {
    daysToUnderwriting: 2,
    daysInUnderwriting: 5,
    daysToCommittee: 3,
    totalTat: 12,
  },
};
