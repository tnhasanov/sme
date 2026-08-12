import type { VersionedArtifact } from '@/types/core';

/**
 * Performance ("bad") definition versioning (§65) and model-monitoring
 * configuration (§64).
 *
 * The definition is versioned because a monitoring result is only meaningful
 * alongside the definition that produced it — changing the rule later must
 * not silently rewrite history.
 */

export interface BadDefinition extends VersionedArtifact {
  id: string;
  key: 'INTERNAL_BAD' | 'EXTERNAL_BAD' | 'COMBINED_BAD';
  descriptionAz: string;
  descriptionEn: string;
  observationMonths: number;
  criteria: string[];
}

export const BAD_DEFINITIONS: BadDefinition[] = [
  {
    id: 'INTERNAL_BAD_V1',
    key: 'INTERNAL_BAD',
    version: 'v1',
    label: 'Daxili defolt (Internal Bad)',
    status: 'PROMETEIA_PROPOSED',
    effectiveFrom: '2026-01-01',
    sourceRef: 'ATB ERM Diagnostic — "internal bad = 30+ DPD or NPL during the observation period"',
    descriptionAz: 'Müşahidə dövründə 30+ gün gecikmə VƏ YA qeyri-işlək kredit statusu.',
    descriptionEn: '30+ DPD or NPL during the observation period.',
    observationMonths: 12,
    criteria: ['30+ gün gecikmə', 'NPL statusu'],
  },
  {
    id: 'EXTERNAL_BAD_V1',
    key: 'EXTERNAL_BAD',
    version: 'v1',
    label: 'Xarici defolt (External Bad)',
    status: 'PROMETEIA_PROPOSED',
    effectiveFrom: '2026-01-01',
    sourceRef: 'ATB ERM Diagnostic — "external bad = ACB Rating Poor at the end of the observation period"',
    descriptionAz: 'Müşahidə dövrünün sonunda AKB reytinqinin "Zəif" olması.',
    descriptionEn: 'ACB rating Poor at the end of the observation period.',
    observationMonths: 12,
    criteria: ['AKB reytinqi = Zəif'],
  },
  {
    id: 'COMBINED_BAD_V1',
    key: 'COMBINED_BAD',
    version: 'v1',
    label: 'Birləşdirilmiş defolt (Combined Bad)',
    status: 'BANK_PROPOSED',
    effectiveFrom: '2026-01-01',
    sourceRef: 'Derived — Internal Bad OR External Bad',
    descriptionAz: 'Daxili defolt VƏ YA xarici defolt.',
    descriptionEn: 'Internal Bad OR External Bad.',
    observationMonths: 12,
    criteria: ['Daxili defolt', 'Xarici defolt'],
  },
];

/**
 * Observed performance from Prometeia's Phase-2 backtest on ATB approvals
 * between 01.01.2024 and 31.03.2026. Retained verbatim because it is the
 * benchmark any future internal model has to beat.
 */
export interface CurrentStateBucket {
  bucketAz: string;
  assessor: string;
  decisionAuthority: string;
  count: number;
  obsShare: number;
  internalBad: number;
  externalBad: number;
}

export const CURRENT_STATE_PERFORMANCE: {
  sourceRef: string;
  periodAz: string;
  buckets: CurrentStateBucket[];
  notes: string[];
} = {
  sourceRef: 'ATB ERM Diagnostic Status Meeting 07.08.2026, slide 7 — Current State',
  periodAz: 'Təsdiq edilmiş müraciətlər: 01.01.2024 – 31.03.2026',
  buckets: [
    {
      bucketAz: '50.000 AZN-dən aşağı',
      assessor: 'RM',
      decisionAuthority: 'KOB KM (SME Center)',
      count: 566,
      obsShare: 0.5,
      internalBad: 7,
      externalBad: 47,
    },
    {
      bucketAz: '50.000 – 100.000 AZN',
      assessor: 'Anderraytinq Mərkəzi',
      decisionAuthority: 'Müsbət → KOB KM; mənfi → imtina və ya KOB Komitəsi',
      count: 343,
      obsShare: 0.3,
      internalBad: 5,
      externalBad: 50,
    },
    {
      bucketAz: '100.000 – 300.000 AZN',
      assessor: 'Anderraytinq Mərkəzi',
      decisionAuthority: 'KOB Komitəsi',
      count: 183,
      obsShare: 0.16,
      internalBad: 2,
      externalBad: 48,
    },
    {
      bucketAz: '300.000 AZN-dən yuxarı',
      assessor: 'Anderraytinq Mərkəzi',
      decisionAuthority: 'İdarə Heyəti',
      count: 40,
      obsShare: 0.04,
      internalBad: 1,
      externalBad: 12,
    },
  ],
  notes: [
    'Bütün təsdiq edilmiş müraciətlər bu təhlildə təminatsız qəbul edilib.',
    'Qrup ekspozisiyası əvəzinə maliyyələşdirilən məbləğ istifadə olunub — qrup ekspozisiyası məlumatı mövcud deyil. Faktiki qrup ekspozisiyası ilə sifarişlər daha yuxarı intervallara keçəcək.',
    'Daxili defolt: müşahidə dövründə 30+ gün gecikmə və ya NPL. Xarici defolt: dövrün sonunda AKB reytinqi "Zəif".',
  ],
};

/** Discriminatory power of the current Yekun Rəy sections, per Prometeia. */
export interface ScorecardSectionPower {
  sectionAz: string;
  weightPct: number;
  giniSmall: number | null;
  commentAz: string;
}

export const CURRENT_SCORECARD_POWER: {
  sourceRef: string;
  overallGiniSmall: number;
  sections: ScorecardSectionPower[];
} = {
  sourceRef: 'ATB ERM Diagnostic — current Small scorecard performance analysis',
  overallGiniSmall: 0.09,
  sections: [
    {
      sectionAz: 'Kredit tarixçəsinin təhlili',
      weightPct: 20,
      giniSmall: null,
      commentAz: 'Yeganə bölmə ki, müəyyən ayırdetmə gücü göstərir.',
    },
    {
      sectionAz: 'Biznes fəaliyyətinin təhlili',
      weightPct: 20,
      giniSmall: null,
      commentAz: 'Məhdud ayırdetmə gücü.',
    },
    {
      sectionAz: 'Maliyyə məlumatlarının təhlili',
      weightPct: 35,
      giniSmall: -0.021,
      commentAz: 'Mənfi GINI — çəkisi ən böyük olan bölmə praktiki olaraq ayırd etmir.',
    },
    {
      sectionAz: 'Kreditin təyinatının təhlili',
      weightPct: 15,
      giniSmall: 0,
      commentAz: 'Ayırdetmə gücü yoxdur.',
    },
    {
      sectionAz: 'Təminatın təhlili',
      weightPct: 10,
      giniSmall: -0.137,
      commentAz: 'Mənfi GINI — göstəricinin istiqaməti gözləniləndən əksdir.',
    },
  ],
};
