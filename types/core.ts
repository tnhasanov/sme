/**
 * Core shared primitives for the ATB KOB underwriting platform.
 *
 * Design rule: every material number carries provenance. A bare `number` is
 * only acceptable for values that are *derived* by the calculation engine;
 * anything that originates from a document, a customer statement or an
 * analyst estimate must be wrapped in `TracedValue` so the UI can answer
 * "how much can we trust this figure?" (see /docs/atb-underwriting-spec.md).
 */

export type UUID = string;
export type ISODate = string; // YYYY-MM-DD
export type ISODateTime = string; // full ISO-8601

export type Currency = 'AZN' | 'USD' | 'EUR';

/** How well a data point is backed by evidence. Drives Data Quality rating. */
export const EVIDENCE_STATUSES = [
  'VERIFIED',
  'PARTIALLY_VERIFIED',
  'VERBAL',
  'ANALYST_ESTIMATE',
  'MISSING',
  'CONTRADICTORY',
] as const;
export type EvidenceStatus = (typeof EVIDENCE_STATUSES)[number];

/** Where a data point came from. */
export const SOURCE_TYPES = [
  'TAX_AUTHORITY',
  'BANK_STATEMENT',
  'POS',
  'CREDIT_BUREAU',
  'CUSTOMER_DOCUMENT',
  'CUSTOMER_VERBAL',
  'FIELD_VISIT',
  'INTERNAL_SYSTEM',
  'ANALYST_CALCULATION',
  'THIRD_PARTY_APPRAISAL',
  'REGISTRY',
] as const;
export type SourceType = (typeof SOURCE_TYPES)[number];

/**
 * A number plus its lineage. `raw` is what was reported/collected;
 * `adjusted` is what the underwriter decided to use. Never overwrite `raw`.
 */
export interface TracedValue {
  raw: number;
  adjusted?: number;
  sourceType: SourceType;
  evidence: EvidenceStatus;
  documentRef?: string;
  enteredBy?: string;
  modifiedBy?: string;
  modificationReason?: string;
  modifiedAt?: ISODateTime;
  note?: string;
}

/** Resolve a traced value under the currently selected lens. */
export type FinancialLens = 'REPORTED' | 'ADJUSTED';

export function tv(
  raw: number,
  sourceType: SourceType = 'CUSTOMER_DOCUMENT',
  evidence: EvidenceStatus = 'PARTIALLY_VERIFIED',
  extra: Partial<TracedValue> = {},
): TracedValue {
  return { raw, sourceType, evidence, ...extra };
}

export function valueOf(v: TracedValue | number | undefined, lens: FinancialLens = 'ADJUSTED'): number {
  if (v === undefined) return 0;
  if (typeof v === 'number') return v;
  if (lens === 'REPORTED') return v.raw;
  return v.adjusted ?? v.raw;
}

export type Severity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO';

export const SEVERITY_ORDER: Record<Severity, number> = {
  CRITICAL: 0,
  HIGH: 1,
  MEDIUM: 2,
  LOW: 3,
  INFO: 4,
};

/** Result of evaluating any threshold-style rule. */
export interface RuleOutcome {
  ruleId: string;
  ruleName: string;
  scope: string;
  metric: string;
  actual: number | null;
  operator: ComparisonOperator;
  threshold: number;
  passed: boolean;
  severity: Severity;
  action: RuleAction;
  source: string;
  status: SourceStatus;
  message: string;
}

export const COMPARISON_OPERATORS = ['GTE', 'GT', 'LTE', 'LT', 'EQ', 'NEQ', 'BETWEEN'] as const;
export type ComparisonOperator = (typeof COMPARISON_OPERATORS)[number];

export const RULE_ACTIONS = ['INFO', 'WARNING', 'POLICY_EXCEPTION', 'STOP', 'REJECT', 'ESCALATE'] as const;
export type RuleAction = (typeof RULE_ACTIONS)[number];

/**
 * Provenance status of a *rule or parameter*, as required by the source
 * traceability matrix. Keeps ATB's live policy separate from proposals.
 */
export const SOURCE_STATUSES = [
  'CURRENT',
  'PROMETEIA_PROPOSED',
  'BANK_PROPOSED',
  'HISTORICAL',
  'INFERRED',
  'NEEDS_CONFIRMATION',
] as const;
export type SourceStatus = (typeof SOURCE_STATUSES)[number];

/** Anything versioned carries this envelope so historic cases stay reproducible. */
export interface VersionedArtifact {
  version: string;
  label: string;
  status: SourceStatus;
  effectiveFrom: ISODate;
  effectiveTo?: ISODate;
  sourceRef: string;
}

export function compare(actual: number, operator: ComparisonOperator, threshold: number, upper?: number): boolean {
  switch (operator) {
    case 'GTE':
      return actual >= threshold;
    case 'GT':
      return actual > threshold;
    case 'LTE':
      return actual <= threshold;
    case 'LT':
      return actual < threshold;
    case 'EQ':
      return actual === threshold;
    case 'NEQ':
      return actual !== threshold;
    case 'BETWEEN':
      return actual >= threshold && actual <= (upper ?? threshold);
    default:
      return false;
  }
}

export function safeDiv(numerator: number, denominator: number): number | null {
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator === 0) return null;
  const r = numerator / denominator;
  return Number.isFinite(r) ? r : null;
}

/** A calculated figure that can explain itself in the UI (§27 Explainability). */
export interface ExplainedMetric {
  key: string;
  label: string;
  labelEn: string;
  value: number | null;
  unit: 'RATIO' | 'PERCENT' | 'DAYS' | 'CURRENCY' | 'TIMES' | 'SCORE';
  formula: string;
  inputs: Array<{ label: string; value: number }>;
  source: string;
  period?: string;
  lens?: FinancialLens;
}
