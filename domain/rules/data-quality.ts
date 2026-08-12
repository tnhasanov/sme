import type { EvidenceStatus, TracedValue } from '@/types/core';
import type { CreditDocument } from '@/types/application';
import type { DataQualityConfig } from '@/config/scorecards';
import type { CrossCheckResult } from '@/domain/calculations/cross-checks';

/**
 * Data-quality rating (§29-§30).
 *
 * Deliberately separate from the credit rating: a strong borrower with weak
 * documentation and a weak borrower with perfect documentation are different
 * problems, and merging them into one grade hides both.
 */

export interface DataQualityFactorResult {
  key: string;
  labelAz: string;
  weight: number;
  score: number; // 0..1
  contribution: number;
  evidenceSummary: string;
  supportingDocuments: string[];
}

export interface DataQualityResult {
  configId: string;
  factors: DataQualityFactorResult[];
  scorePct: number;
  grade: 'A' | 'B' | 'C' | 'D' | 'E';
  gradeLabelAz: string;
  gradeLabelEn: string;
  verbalDependencyPct: number;
  missingCount: number;
  contradictoryCount: number;
  unreconciledCount: number;
}

export interface DataQualityInput {
  documents: CreditDocument[];
  /** Every traced value in the case, for the verbal-dependency measure. */
  tracedValues: Array<{ label: string; value: TracedValue }>;
  crossChecks: CrossCheckResult[];
}

export function computeDataQuality(config: DataQualityConfig, input: DataQualityInput): DataQualityResult {
  const factors: DataQualityFactorResult[] = [];

  const evidenceScore = (status: EvidenceStatus) => config.evidenceWeight[status] ?? 0;

  const failingChecks = input.crossChecks.filter((c) => !c.passed);

  for (const factor of config.factors) {
    let score = 0;
    let evidenceSummary = '';
    let supporting: string[] = [];

    if (factor.key === 'RECONCILIATION') {
      const total = input.crossChecks.length || 1;
      score = 1 - failingChecks.length / total;
      evidenceSummary = `${failingChecks.length} / ${input.crossChecks.length} uzlaşma yoxlaması uğursuzdur`;
    } else if (factor.key === 'VERBAL_DEPENDENCY') {
      const verbal = input.tracedValues.filter(
        (t) => t.value.evidence === 'VERBAL' || t.value.evidence === 'ANALYST_ESTIMATE',
      );
      score = input.tracedValues.length > 0 ? 1 - verbal.length / input.tracedValues.length : 0;
      evidenceSummary = `${verbal.length} / ${input.tracedValues.length} göstərici şifahi məlumata və ya analitik qiymətləndirməyə əsaslanır`;
    } else {
      const docs = input.documents.filter((d) => factor.evidenceKeys.includes(d.category));
      supporting = docs.map((d) => d.name);
      if (docs.length === 0) {
        score = 0;
        evidenceSummary = 'Sənəd təqdim edilməyib';
      } else {
        score = docs.reduce((s, d) => s + evidenceScore(d.evidence), 0) / docs.length;
        evidenceSummary = `${docs.length} sənəd — orta təsdiq səviyyəsi ${(score * 100).toFixed(0)}%`;
      }
    }

    score = Math.min(Math.max(score, 0), 1);
    factors.push({
      key: factor.key,
      labelAz: factor.labelAz,
      weight: factor.weight,
      score,
      contribution: score * factor.weight,
      evidenceSummary,
      supportingDocuments: supporting,
    });
  }

  const totalWeight = config.factors.reduce((s, f) => s + f.weight, 0) || 1;
  const scorePct = (factors.reduce((s, f) => s + f.contribution, 0) / totalWeight) * 100;

  const band = config.bands.find((b) => scorePct >= b.min) ?? config.bands[config.bands.length - 1];

  const verbal = input.tracedValues.filter((t) => t.value.evidence === 'VERBAL');

  return {
    configId: config.id,
    factors,
    scorePct,
    grade: band.grade,
    gradeLabelAz: band.labelAz,
    gradeLabelEn: band.labelEn,
    verbalDependencyPct:
      input.tracedValues.length > 0 ? (verbal.length / input.tracedValues.length) * 100 : 0,
    missingCount: input.documents.filter((d) => d.evidence === 'MISSING' || (d.mandatory && !d.received)).length,
    contradictoryCount: input.tracedValues.filter((t) => t.value.evidence === 'CONTRADICTORY').length,
    unreconciledCount: failingChecks.length,
  };
}
