import type { Decision, Finding } from '@/types/application';
import type { ISODateTime } from '@/types/core';

/**
 * Underwriter review state (human in the loop).
 *
 * The machine produces the draft; the underwriter owns the verdict. Every
 * automated finding must be dispositioned by a person before the opinion can be
 * signed off, and the machine's original text is never overwritten — the
 * underwriter's note sits alongside it, so a reader can always see both what
 * the system said and what the analyst concluded.
 */

export const FINDING_DISPOSITIONS = [
  'OPEN',
  'ACKNOWLEDGED',
  'MITIGATED',
  'RESOLVED',
  'WAIVED',
  'DISPUTED',
] as const;
export type FindingDisposition = (typeof FINDING_DISPOSITIONS)[number];

export const DISPOSITION_LABEL_AZ: Record<FindingDisposition, string> = {
  OPEN: 'Baxılmayıb',
  ACKNOWLEDGED: 'Qəbul edildi',
  MITIGATED: 'Mitiqasiya edildi',
  RESOLVED: 'Həll edildi',
  WAIVED: 'Güzəşt verildi',
  DISPUTED: 'Mübahisəlidir',
};

export const DISPOSITION_TONE: Record<FindingDisposition, string> = {
  OPEN: 'slate',
  ACKNOWLEDGED: 'amber',
  MITIGATED: 'lime',
  RESOLVED: 'emerald',
  WAIVED: 'violet',
  DISPUTED: 'rose',
};

export interface FindingReview {
  findingId: string;
  disposition: FindingDisposition;
  /** The underwriter's own words. Never replaces the generated description. */
  note: string;
  mitigant: string;
  updatedAt: ISODateTime;
}

export interface UnderwriterReview {
  applicationId: string;
  /** Keyed by finding id. */
  findings: Record<string, FindingReview>;
  /** Keyed by opinion section key — per-section analyst commentary. */
  sectionNotes: Record<string, string>;
  /** Free-form overall note appended to the opinion. */
  overallNote: string;
  /** Set when the underwriter disagrees with the generated recommendation. */
  recommendationOverride?: {
    decision: Decision;
    recommendedAmount: number;
    rationale: string;
  };
  underwriterName: string;
  signedOffAt?: ISODateTime;
  updatedAt: ISODateTime;
}

export function emptyReview(applicationId: string, now: ISODateTime): UnderwriterReview {
  return {
    applicationId,
    findings: {},
    sectionNotes: {},
    overallNote: '',
    underwriterName: '',
    updatedAt: now,
  };
}

/** Findings a person must still disposition before sign-off is allowed. */
export function outstandingFindings(findings: Finding[], review: UnderwriterReview): Finding[] {
  return findings.filter((f) => {
    if (f.severity !== 'CRITICAL' && f.severity !== 'HIGH') return false;
    const r = review.findings[f.id];
    return !r || r.disposition === 'OPEN';
  });
}

export interface ReviewProgress {
  total: number;
  reviewed: number;
  outstandingCritical: number;
  canSignOff: boolean;
  blockingReasonAz: string | null;
}

export function reviewProgress(findings: Finding[], review: UnderwriterReview): ReviewProgress {
  const mustReview = findings.filter((f) => f.severity === 'CRITICAL' || f.severity === 'HIGH');
  const reviewed = mustReview.filter((f) => {
    const r = review.findings[f.id];
    return r && r.disposition !== 'OPEN';
  }).length;
  const outstanding = mustReview.length - reviewed;

  let blockingReasonAz: string | null = null;
  if (outstanding > 0) {
    blockingReasonAz = `${outstanding} kritik/yüksək tapıntı hələ qiymətləndirilməyib.`;
  } else if (!review.underwriterName.trim()) {
    blockingReasonAz = 'Rəyi verən əməkdaşın adı göstərilməyib.';
  }

  return {
    total: mustReview.length,
    reviewed,
    outstandingCritical: outstanding,
    canSignOff: blockingReasonAz === null,
    blockingReasonAz,
  };
}
