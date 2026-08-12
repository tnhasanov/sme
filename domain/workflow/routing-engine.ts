import type { RatingGrade } from '@/config/rating';
import {
  AUTHORITY_LABEL_AZ,
  AUTHORITY_RANK,
  type Authority,
  type CollateralCondition,
  type RoutingBucket,
  type WorkflowVersion,
} from '@/config/workflow';

/**
 * Approval routing engine (§49-§52, §76).
 *
 * Routing is never a function of amount alone. The decision context carries
 * exposure, collateral coverage, both ratings, stop factors and policy
 * exceptions, and the engine explains every reason it landed where it did —
 * "why is this application going to this committee?"
 */

export interface RoutingContext {
  postTransactionGroupExposure: number;
  requestedAmount: number;
  /** Eligible (post-haircut) collateral value / post-transaction exposure. */
  eligibleCollateralCoverage: number | null;
  bureauGrade: RatingGrade | null;
  finalInternalGrade: RatingGrade | null;
  isWorstRating: boolean;
  stopFactorCount: number;
  policyExceptionCount: number;
  product: string;
  segment: 'SMALL' | 'MEDIUM';
  preScreenRejected: boolean;
  underwriterAssessmentNegative: boolean;
}

export interface RoutingDecision {
  workflowVersion: string;
  workflowLabel: string;
  workflowStatus: WorkflowVersion['status'];
  bucket: RoutingBucket | null;
  bucketLabelAz: string;
  assessmentAuthority: Authority | null;
  decisionAuthority: Authority | null;
  escalationAuthority: Authority | null;
  assessmentAuthorityLabel: string;
  decisionAuthorityLabel: string;
  escalationAuthorityLabel: string | null;
  escalated: boolean;
  notchingLayers: Array<'BUSINESS' | 'FINANCIAL'>;
  reasons: string[];
  ambiguities: string[];
  operatorUsed: 'AND' | 'OR';
}

const FULL_COLLATERAL_THRESHOLD = 1.0;
const PARTIAL_COLLATERAL_THRESHOLD = 0.8;

function collateralMatches(condition: CollateralCondition, coverage: number | null): boolean {
  switch (condition) {
    case 'ANY':
      return true;
    case 'FULLY_COLLATERALISED':
      return coverage !== null && coverage >= FULL_COLLATERAL_THRESHOLD;
    case 'NOT_FULLY_COLLATERALISED':
      return coverage === null || coverage < FULL_COLLATERAL_THRESHOLD;
    case 'MIN_80_PCT':
      return coverage !== null && coverage >= PARTIAL_COLLATERAL_THRESHOLD;
  }
}

function pickBucket(workflow: WorkflowVersion, ctx: RoutingContext): RoutingBucket | null {
  const basis =
    workflow.routingBasis === 'POST_TRANSACTION_GROUP_EXPOSURE'
      ? ctx.postTransactionGroupExposure
      : ctx.requestedAmount;

  const inRange = workflow.buckets.filter((b) => basis >= b.minExposure && basis < b.maxExposure);
  if (inRange.length === 0) return null;

  // Prefer a bucket whose collateral condition the case actually satisfies;
  // fall back to the unconditional one so routing is always defined.
  const matching = inRange.filter((b) => collateralMatches(b.collateralCondition, ctx.eligibleCollateralCoverage));
  if (matching.length > 0) {
    // The most specific collateral condition wins.
    return (
      matching.find((b) => b.collateralCondition !== 'ANY') ?? matching[0]
    );
  }
  return inRange.find((b) => b.collateralCondition === 'ANY') ?? inRange[0];
}

function escalationTriggered(bucket: RoutingBucket, workflow: WorkflowVersion, ctx: RoutingContext): {
  triggered: boolean;
  reason: string | null;
} {
  const coverage = ctx.eligibleCollateralCoverage;
  const requiredCoverage =
    bucket.collateralCondition === 'MIN_80_PCT' ? PARTIAL_COLLATERAL_THRESHOLD : FULL_COLLATERAL_THRESHOLD;
  const collateralOk = coverage !== null && coverage >= requiredCoverage;

  switch (bucket.escalationCondition) {
    case 'NONE':
      return { triggered: false, reason: null };

    case 'RATING_IS_WORST':
      return ctx.isWorstRating
        ? { triggered: true, reason: 'Yekun daxili reytinq ən zəif qiymətdədir — eskalasiya tələb olunur.' }
        : { triggered: false, reason: null };

    case 'UW_ASSESSMENT_NEGATIVE':
      return ctx.underwriterAssessmentNegative
        ? { triggered: true, reason: 'Anderraytinq rəyi mənfidir — imtina və ya yuxarı səlahiyyətə eskalasiya.' }
        : { triggered: false, reason: null };

    case 'NOT_COLLATERALISED_OR_WORST':
    case 'NOT_COLLATERALISED_AND_WORST': {
      // The deck states the passing condition; escalation is its negation.
      // OR-form pass:  collateralOk OR notWorst   ⇒ escalate when !collateralOk AND worst
      // AND-form pass: collateralOk AND notWorst  ⇒ escalate when !collateralOk OR  worst
      const notWorst = !ctx.isWorstRating;
      const passes =
        workflow.collateralRatingOperator === 'OR' ? collateralOk || notWorst : collateralOk && notWorst;

      if (passes) return { triggered: false, reason: null };

      const parts: string[] = [];
      if (!collateralOk) {
        parts.push(
          `uyğun girov örtüyü ${coverage === null ? 'hesablanmayıb' : `${(coverage * 100).toFixed(0)}%`} (tələb ${(
            requiredCoverage * 100
          ).toFixed(0)}%)`,
        );
      }
      if (ctx.isWorstRating) parts.push('yekun reytinq ən zəif qiymətdədir');

      return {
        triggered: true,
        reason: `Şərt ödənilmir (${workflow.collateralRatingOperator === 'OR' ? 'VƏ YA' : 'VƏ'} məntiqi): ${parts.join(
          ', ',
        )}.`,
      };
    }
  }
}

export function routeApplication(workflow: WorkflowVersion, ctx: RoutingContext): RoutingDecision {
  const reasons: string[] = [];
  const basisLabel =
    workflow.routingBasis === 'POST_TRANSACTION_GROUP_EXPOSURE'
      ? 'əməliyyatdan sonrakı qrup ekspozisiyası'
      : 'maliyyələşdirilən məbləğ';
  const basisValue =
    workflow.routingBasis === 'POST_TRANSACTION_GROUP_EXPOSURE'
      ? ctx.postTransactionGroupExposure
      : ctx.requestedAmount;

  reasons.push(`Routing bazası: ${basisLabel} — ${formatAzn(basisValue)}.`);
  reasons.push(`Seqment: ${ctx.segment === 'MEDIUM' ? 'Orta (İri)' : 'Kiçik'}.`);

  /* --- Stop factors override ordinary routing --- */
  if (ctx.stopFactorCount > 0 && workflow.stopFactorEscalationAuthority !== 'NONE') {
    const authority = workflow.stopFactorEscalationAuthority;
    reasons.push(
      `${ctx.stopFactorCount} stop faktor aşkarlanıb — adi səlahiyyət marşrutu tətbiq edilmir, yalnız ${AUTHORITY_LABEL_AZ[authority]} baxa bilər.`,
    );
    return {
      workflowVersion: workflow.id,
      workflowLabel: workflow.label,
      workflowStatus: workflow.status,
      bucket: null,
      bucketLabelAz: 'Stop faktor marşrutu',
      assessmentAuthority: 'UNDERWRITING_TEAM',
      decisionAuthority: authority,
      escalationAuthority: null,
      assessmentAuthorityLabel: AUTHORITY_LABEL_AZ.UNDERWRITING_TEAM,
      decisionAuthorityLabel: AUTHORITY_LABEL_AZ[authority],
      escalationAuthorityLabel: null,
      escalated: true,
      notchingLayers: [],
      reasons,
      ambiguities: workflow.knownAmbiguities,
      operatorUsed: workflow.collateralRatingOperator,
    };
  }

  /* --- Pre-screen rejections still get a decision authority --- */
  if (ctx.preScreenRejected && workflow.preScreenEnabled) {
    reasons.push('Müraciət ilkin bürо süzgəcindən keçməyib — qeyd saxlanılır və ekspozisiyaya görə marşrutlanır.');
  }

  const bucket = pickBucket(workflow, ctx);
  if (!bucket) {
    reasons.push('Uyğun marşrut intervalı tapılmadı — konfiqurasiya yoxlanılmalıdır.');
    return {
      workflowVersion: workflow.id,
      workflowLabel: workflow.label,
      workflowStatus: workflow.status,
      bucket: null,
      bucketLabelAz: 'Təyin edilməyib',
      assessmentAuthority: null,
      decisionAuthority: null,
      escalationAuthority: null,
      assessmentAuthorityLabel: '—',
      decisionAuthorityLabel: '—',
      escalationAuthorityLabel: null,
      escalated: false,
      notchingLayers: [],
      reasons,
      ambiguities: workflow.knownAmbiguities,
      operatorUsed: workflow.collateralRatingOperator,
    };
  }

  reasons.push(`Marşrut intervalı: ${bucket.labelAz}.`);
  if (ctx.eligibleCollateralCoverage !== null) {
    reasons.push(`Uyğun girov örtüyü: ${(ctx.eligibleCollateralCoverage * 100).toFixed(0)}%.`);
  } else {
    reasons.push('Uyğun girov örtüyü hesablanmayıb.');
  }
  reasons.push(
    `Yekun daxili reytinq: ${ctx.finalInternalGrade ?? 'təyin edilməyib'}${
      ctx.isWorstRating ? ' (ən zəif qiymət)' : ''
    }.`,
  );

  const escalation = escalationTriggered(bucket, workflow, ctx);
  if (escalation.reason) reasons.push(escalation.reason);

  let decisionAuthority = bucket.decisionAuthority;
  if (escalation.triggered && bucket.escalationAuthority) {
    decisionAuthority = bucket.escalationAuthority;
  }

  if (ctx.policyExceptionCount > 0) {
    reasons.push(
      `${ctx.policyExceptionCount} siyasət istisnası tələb olunur — qərar verən orqan istisnaları da təsdiqləməlidir.`,
    );
  }

  reasons.push(
    `Qərar səlahiyyəti: ${AUTHORITY_LABEL_AZ[decisionAuthority]} (səviyyə ${AUTHORITY_RANK[decisionAuthority]}).`,
  );

  return {
    workflowVersion: workflow.id,
    workflowLabel: workflow.label,
    workflowStatus: workflow.status,
    bucket,
    bucketLabelAz: bucket.labelAz,
    assessmentAuthority: bucket.assessmentAuthority,
    decisionAuthority,
    escalationAuthority: bucket.escalationAuthority ?? null,
    assessmentAuthorityLabel: AUTHORITY_LABEL_AZ[bucket.assessmentAuthority],
    decisionAuthorityLabel: AUTHORITY_LABEL_AZ[decisionAuthority],
    escalationAuthorityLabel: bucket.escalationAuthority
      ? AUTHORITY_LABEL_AZ[bucket.escalationAuthority]
      : null,
    escalated: escalation.triggered,
    notchingLayers: bucket.notchingLayers,
    reasons,
    ambiguities: workflow.knownAmbiguities,
    operatorUsed: workflow.collateralRatingOperator,
  };
}

function formatAzn(n: number): string {
  return `${new Intl.NumberFormat('az-AZ', { maximumFractionDigits: 0 }).format(Math.round(n))} AZN`;
}
