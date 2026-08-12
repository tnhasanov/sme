import type { SourceStatus, VersionedArtifact } from '@/types/core';

/**
 * Rating scales.
 *
 * The ACB score → rating band table is Prometeia's Phase-2 proposal
 * (Risk Diagnostics, SME scorecard quick-win). It is seeded as
 * PROMETEIA_PROPOSED and is NOT ATB approved production policy.
 * The administrator can enable/disable/modify every row.
 */

export const RATING_GRADES = ['POOR', 'SATISFACTORY', 'MEDIUM', 'GOOD', 'EXCELLENT'] as const;
export type RatingGrade = (typeof RATING_GRADES)[number];

/** Ordinal position — 0 is the weakest grade. Used by the notching engine. */
export const GRADE_ORDER: RatingGrade[] = ['POOR', 'SATISFACTORY', 'MEDIUM', 'GOOD', 'EXCELLENT'];

export const GRADE_LABEL_AZ: Record<RatingGrade, string> = {
  POOR: 'Zəif',
  SATISFACTORY: 'Qənaətbəxş',
  MEDIUM: 'Orta',
  GOOD: 'Yaxşı',
  EXCELLENT: 'Əla',
};

export interface AcbBand {
  min: number;
  max: number;
  grade: RatingGrade;
}

export interface AcbRatingScale extends VersionedArtifact {
  id: string;
  bands: AcbBand[];
  /** Score below which pre-screening rejects/escalates. Null disables the gate. */
  preScreenRejectBelow: number | null;
  preScreenAction: 'REJECT' | 'ESCALATE_TO_UW';
  /** Applications with no bureau score at all. */
  noScoreAction: 'ESCALATE_TO_UW' | 'REJECT' | 'PASS';
  enabled: boolean;
}

export const ACB_SCALE_PROMETEIA_V1: AcbRatingScale = {
  id: 'ACB_SCALE_PROMETEIA_V1',
  version: 'v1',
  label: 'ACB Micro Score → Rating (Prometeia Quick-Win)',
  status: 'PROMETEIA_PROPOSED',
  effectiveFrom: '2026-01-01',
  sourceRef: 'ATB ERM Diagnostic Status Meeting 07.08.2026 — SME scorecard quick win',
  enabled: true,
  bands: [
    { min: 0, max: 149, grade: 'POOR' },
    { min: 150, max: 399, grade: 'SATISFACTORY' },
    { min: 400, max: 699, grade: 'MEDIUM' },
    { min: 700, max: 859, grade: 'GOOD' },
    { min: 860, max: 1000, grade: 'EXCELLENT' },
  ],
  preScreenRejectBelow: 400, // i.e. score <= 399 fails the gate
  preScreenAction: 'REJECT',
  noScoreAction: 'ESCALATE_TO_UW',
};

/**
 * As-is variant: ATB currently has no automated bureau pre-screen gate;
 * the bureau report is read manually per the "AKBÇ-ın oxunması təlimatı".
 * Seeded so the current process can be replayed without the proposed gate.
 */
export const ACB_SCALE_ATB_CURRENT_V1: AcbRatingScale = {
  ...ACB_SCALE_PROMETEIA_V1,
  id: 'ACB_SCALE_ATB_CURRENT_V1',
  label: 'ACB Micro Score → Rating (ATB current — manual reading, no auto gate)',
  status: 'CURRENT',
  sourceRef: 'AKBÇ-ın oxunması təlimatı (ATB)',
  preScreenRejectBelow: null,
  preScreenAction: 'ESCALATE_TO_UW',
  noScoreAction: 'ESCALATE_TO_UW',
};

export const ACB_SCALES: Record<string, AcbRatingScale> = {
  [ACB_SCALE_PROMETEIA_V1.id]: ACB_SCALE_PROMETEIA_V1,
  [ACB_SCALE_ATB_CURRENT_V1.id]: ACB_SCALE_ATB_CURRENT_V1,
};

/* ------------------------------------------------------------------ */
/* Segmentation (§44)                                                  */
/* ------------------------------------------------------------------ */

export type Segment = 'SMALL' | 'MEDIUM';

export interface SegmentationConfig extends VersionedArtifact {
  id: string;
  /** Post-transaction group exposure at or above this value ⇒ MEDIUM. */
  mediumThresholdAzn: number;
  basis: 'POST_TRANSACTION_GROUP_EXPOSURE' | 'REQUESTED_AMOUNT' | 'TURNOVER';
}

export const SEGMENTATION_PROMETEIA_V1: SegmentationConfig = {
  id: 'SEGMENTATION_PROMETEIA_V1',
  version: 'v1',
  label: 'Small / Medium segmentation',
  status: 'PROMETEIA_PROPOSED',
  effectiveFrom: '2026-01-01',
  sourceRef: 'ATB ERM Diagnostic — SME segmentation proposal',
  mediumThresholdAzn: 300_000,
  basis: 'POST_TRANSACTION_GROUP_EXPOSURE',
};

/* ------------------------------------------------------------------ */
/* Business-analysis notching (§43)                                    */
/* ------------------------------------------------------------------ */

export type BusinessRiskBand = 'LOW' | 'LOW_MEDIUM' | 'MODERATE' | 'MEDIUM_HIGH' | 'HIGH';

export const BUSINESS_RISK_LABEL_AZ: Record<BusinessRiskBand, string> = {
  LOW: 'Aşağı risk',
  LOW_MEDIUM: 'Aşağı-orta risk',
  MODERATE: 'Mülayim risk',
  MEDIUM_HIGH: 'Orta-yüksək risk',
  HIGH: 'Yüksək risk',
};

export interface BusinessRiskBandRule {
  band: BusinessRiskBand;
  min: number; // inclusive
  max: number; // inclusive
  notch: number; // negative = downgrade
}

export interface NotchingConfig extends VersionedArtifact {
  id: string;
  businessBands: BusinessRiskBandRule[];
  /** Altman zone → notch, applied to MEDIUM segment only. */
  altman: {
    highRiskBelow: number;
    lowRiskAbove: number;
    highRiskNotch: number;
    greyNotch: number;
    lowRiskNotch: number;
    /** Prometeia: upgrade only when the initial rating is not POOR. */
    lowRiskUpgradeBlockedForGrades: string[];
    /** Which segment gets the financial layer at all. */
    appliesToSegments: Segment[];
    /** Boundary treatment when Z equals a zone edge — see open questions. */
    boundaryInclusive: 'LOW_SIDE' | 'HIGH_SIDE' | 'GREY';
  };
  /** Floor / ceiling on total notching after combining layers. */
  maxTotalDowngrade: number;
  maxTotalUpgrade: number;
  cumulativeDowngrades: boolean;
}

export const NOTCHING_PROMETEIA_V1: NotchingConfig = {
  id: 'NOTCHING_PROMETEIA_V1',
  version: 'v1',
  label: 'Prometeia quick-win notching',
  status: 'PROMETEIA_PROPOSED',
  effectiveFrom: '2026-01-01',
  sourceRef: 'ATB ERM Diagnostic — business & financial analysis notching',
  businessBands: [
    { band: 'LOW', min: 9, max: 9, notch: 0 },
    { band: 'LOW_MEDIUM', min: 7.0, max: 8.99, notch: 0 },
    { band: 'MODERATE', min: 6.0, max: 6.99, notch: 0 },
    { band: 'MEDIUM_HIGH', min: 4.0, max: 5.99, notch: -1 },
    { band: 'HIGH', min: 3.0, max: 3.99, notch: -2 },
  ],
  altman: {
    highRiskBelow: 1.23,
    lowRiskAbove: 2.9,
    highRiskNotch: -2,
    greyNotch: 0,
    lowRiskNotch: 1,
    lowRiskUpgradeBlockedForGrades: ['POOR'],
    appliesToSegments: ['MEDIUM'],
    boundaryInclusive: 'GREY',
  },
  // Prometeia caps the combined effect at two notches of downgrade (slide 10).
  maxTotalDowngrade: -2,
  maxTotalUpgrade: 1,
  cumulativeDowngrades: true,
};

export const NOTCHING_CONFIGS: Record<string, NotchingConfig> = {
  [NOTCHING_PROMETEIA_V1.id]: NOTCHING_PROMETEIA_V1,
};

/* ------------------------------------------------------------------ */
/* "Worst rating" (§47)                                                */
/* ------------------------------------------------------------------ */

export interface WorstRatingConfig extends VersionedArtifact {
  id: string;
  /** Which subjects feed the worst-rating computation. */
  include: Array<'APPLICANT' | 'SHAREHOLDERS' | 'GROUP_BORROWERS' | 'GUARANTORS'>;
  /** Grade at or below which routing is escalated. */
  escalateAtOrBelow: string;
}

export const WORST_RATING_V1: WorstRatingConfig = {
  id: 'WORST_RATING_V1',
  version: 'v1',
  label: 'Worst rating across related subjects',
  status: 'NEEDS_CONFIRMATION',
  effectiveFrom: '2026-01-01',
  sourceRef: 'ATB ERM Diagnostic — routing input "worst rating" (definition not fully specified)',
  include: ['APPLICANT', 'SHAREHOLDERS', 'GROUP_BORROWERS', 'GUARANTORS'],
  escalateAtOrBelow: 'SATISFACTORY',
};

export function statusBadge(status: SourceStatus): { label: string; tone: string } {
  switch (status) {
    case 'CURRENT':
      return { label: 'Cari', tone: 'emerald' };
    case 'PROMETEIA_PROPOSED':
      return { label: 'Prometeia təklifi', tone: 'violet' };
    case 'BANK_PROPOSED':
      return { label: 'Bank təklifi', tone: 'sky' };
    case 'HISTORICAL':
      return { label: 'Tarixi', tone: 'stone' };
    case 'INFERRED':
      return { label: 'Nəticə çıxarılıb', tone: 'amber' };
    case 'NEEDS_CONFIRMATION':
      return { label: 'Təsdiq tələb edir', tone: 'rose' };
  }
}
