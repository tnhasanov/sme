import type { ExplainedMetric, RuleOutcome } from '@/types/core';
import { compare } from '@/types/core';
import type { PolicyRule, PolicyVersion } from '@/config/policy';

/**
 * Generic rule engine (§75).
 *
 * Rules are resolved by metric with sub-sector overriding sector overriding
 * base, so a sector-specific inventory-day norm silently replaces the generic
 * one instead of firing twice.
 */

export interface PolicyContext {
  sector: string;
  subSector?: string;
  product?: string;
  segment?: 'SMALL' | 'MEDIUM';
  /** Metric key → value. Nulls mean "not computable", which never fails. */
  metrics: Record<string, number | null>;
  /** Optional explained metrics, used to enrich the message. */
  explained?: Record<string, ExplainedMetric>;
}

export interface PolicyEvaluation {
  policyVersion: string;
  outcomes: RuleOutcome[];
  breaches: RuleOutcome[];
  stops: RuleOutcome[];
  exceptions: RuleOutcome[];
  warnings: RuleOutcome[];
  passedCount: number;
  evaluatedCount: number;
  notEvaluated: Array<{ ruleId: string; ruleName: string; reason: string }>;
}

/** Picks the most specific enabled rule per metric. */
export function resolveApplicableRules(policy: PolicyVersion, ctx: PolicyContext): PolicyRule[] {
  const byMetric = new Map<string, PolicyRule>();

  const specificity = (r: PolicyRule): number => {
    if (r.scope === 'SUBSECTOR') return 4;
    if (r.scope === 'SECTOR') return 3;
    if (r.scope === 'PRODUCT') return 2;
    if (r.scope === 'SEGMENT') return 2;
    return 1;
  };

  for (const rule of policy.rules) {
    if (!rule.enabled) continue;
    if (rule.sector && rule.sector !== ctx.sector) continue;
    if (rule.subSector && rule.subSector !== ctx.subSector) continue;
    if (rule.product && rule.product !== ctx.product) continue;
    if (rule.segment && rule.segment !== ctx.segment) continue;
    if (rule.waivedForSectors?.includes(ctx.sector)) continue;

    const existing = byMetric.get(rule.metric);
    if (!existing || specificity(rule) > specificity(existing)) {
      byMetric.set(rule.metric, rule);
    }
  }

  return [...byMetric.values()];
}

export function evaluatePolicy(policy: PolicyVersion, ctx: PolicyContext): PolicyEvaluation {
  const rules = resolveApplicableRules(policy, ctx);
  const outcomes: RuleOutcome[] = [];
  const notEvaluated: PolicyEvaluation['notEvaluated'] = [];

  for (const rule of rules) {
    const actual = ctx.metrics[rule.metric];

    // Infinity is a meaningful result here — it is how "no capacity at all"
    // reaches the engine — so only NaN counts as non-computable.
    if (actual === undefined || actual === null || Number.isNaN(actual)) {
      notEvaluated.push({
        ruleId: rule.id,
        ruleName: rule.nameAz,
        reason: 'Göstərici hesablana bilmir — məlumat natamamdır.',
      });
      continue;
    }

    const passed = compare(actual, rule.operator, rule.threshold, rule.upperThreshold);

    outcomes.push({
      ruleId: rule.id,
      ruleName: rule.nameAz,
      scope: rule.sector ? `${rule.scope}: ${rule.sector}` : rule.scope,
      metric: rule.metric,
      actual,
      operator: rule.operator,
      threshold: rule.threshold,
      passed,
      severity: passed ? 'INFO' : rule.severity,
      action: passed ? 'INFO' : rule.action,
      source: rule.sourceRef,
      status: rule.status,
      message: passed
        ? `${rule.nameAz}: ${formatValue(actual, rule.unit)} — norma ${operatorSymbol(rule.operator)} ${formatValue(
            rule.threshold,
            rule.unit,
          )} ödənilir.`
        : `${rule.nameAz}: ${formatValue(actual, rule.unit)} — norma ${operatorSymbol(rule.operator)} ${formatValue(
            rule.threshold,
            rule.unit,
          )} pozulur.`,
    });
  }

  const failing = outcomes.filter((o) => !o.passed);

  return {
    policyVersion: policy.id,
    outcomes,
    breaches: failing,
    stops: failing.filter((o) => o.action === 'STOP' || o.action === 'REJECT'),
    exceptions: failing.filter((o) => o.action === 'POLICY_EXCEPTION'),
    warnings: failing.filter((o) => o.action === 'WARNING' || o.action === 'INFO'),
    passedCount: outcomes.filter((o) => o.passed).length,
    evaluatedCount: outcomes.length,
    notEvaluated,
  };
}

export function operatorSymbol(op: RuleOutcome['operator']): string {
  switch (op) {
    case 'GTE':
      return '≥';
    case 'GT':
      return '>';
    case 'LTE':
      return '≤';
    case 'LT':
      return '<';
    case 'EQ':
      return '=';
    case 'NEQ':
      return '≠';
    case 'BETWEEN':
      return '∈';
  }
}

export function formatValue(value: number, unit: PolicyRule['unit']): string {
  if (!Number.isFinite(value)) return 'ödəmə qabiliyyəti yoxdur';
  switch (unit) {
    case 'PERCENT':
      return `${(value * 100).toFixed(1)}%`;
    case 'DAYS':
      return `${value.toFixed(0)} gün`;
    case 'CURRENCY':
      return `${new Intl.NumberFormat('az-AZ', { maximumFractionDigits: 0 }).format(Math.round(value))} AZN`;
    case 'TIMES':
      return `${value.toFixed(2)}x`;
    case 'RATIO':
    default:
      return value.toFixed(2);
  }
}
