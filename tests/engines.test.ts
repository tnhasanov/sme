import { describe, expect, it } from 'vitest';
import { LEGACY_SCORECARD_V1, BUSINESS_SCORECARD_PROMETEIA_V1 } from '@/config/scorecards';
import {
  ACB_SCALE_ATB_CURRENT_V1,
  ACB_SCALE_PROMETEIA_V1,
  NOTCHING_PROMETEIA_V1,
  SEGMENTATION_PROMETEIA_V1,
} from '@/config/rating';
import { POLICY_ATB_CURRENT_V1, STOP_FACTORS_V1 } from '@/config/policy';
import {
  WORKFLOW_ATB_CURRENT_V1,
  WORKFLOW_PROMETEIA_PROPOSED_V1,
  WORKFLOW_PROMETEIA_PROPOSED_V2,
} from '@/config/workflow';
import { evaluateLegacyOpinion } from '@/domain/scoring/legacy-opinion';
import {
  computeBureauRating,
  computeRating,
  determineSegment,
  gradeFromScore,
  preScreen,
} from '@/domain/rating/rating-engine';
import { evaluatePolicy, resolveApplicableRules } from '@/domain/rules/policy-engine';
import { evaluateStopFactors, triggeredStopFactors } from '@/domain/rules/stop-factors';
import { routeApplication } from '@/domain/workflow/routing-engine';
import { computeAltman } from '@/domain/calculations/altman';
import type { LegacyAssessment } from '@/types/application';

/* ------------------------------------------------------------------ */
/* Legacy Yekun Rəy                                                    */
/* ------------------------------------------------------------------ */

const legacyAnswers = (over: Record<string, { optionKey?: string; achievement: number }> = {}) => {
  const base: Record<string, { optionKey?: string; achievement: number }> = {
    AKB_EXTRACTS_OBTAINED: { optionKey: 'YES', achievement: 1 },
    UNJUSTIFIED_RECENT_INQUIRIES: { optionKey: 'NO', achievement: 1 },
    UNJUSTIFIED_DPD_0_30: { optionKey: 'NO', achievement: 1 },
    UNJUSTIFIED_DPD_30_PLUS: { optionKey: 'NO', achievement: 1 },
    REPAID_BY_INSTALMENTS: { optionKey: 'YES', achievement: 1 },
    DEBT_BURDEN_INCREASE: { optionKey: 'NO', achievement: 1 },
    BUSINESS_OWNERSHIP_LINK: { achievement: 1 },
    STRUCTURE_AND_MANAGEMENT: { achievement: 1 },
    DOCUMENTATION_REPORTING: { achievement: 1 },
    BALANCE_SHEET: { achievement: 1 },
    INCOME_STATEMENT: { achievement: 1 },
    CASH_FLOWS: { achievement: 1 },
    STATEMENT_COMPARISON: { achievement: 1 },
    RATIOS: { achievement: 1 },
    PURPOSE_DOCUMENTS: { optionKey: 'PRESENT', achievement: 1 },
    PURPOSE_EFFICIENCY: { optionKey: 'EFFICIENT', achievement: 1 },
    PURPOSE_CONTROL: { optionKey: 'POSSIBLE', achievement: 1 },
    COLLATERAL_OWNER_RELATION: { optionKey: 'YES', achievement: 1 },
    COLLATERAL_RISK_GRADE: { optionKey: 'LOW', achievement: 1 },
    GUARANTOR_SUITABILITY: { optionKey: 'SUITABLE', achievement: 1 },
    ...over,
  };
  const assessment: LegacyAssessment = {
    applicationId: 'a1',
    scorecardVersion: LEGACY_SCORECARD_V1.id,
    assessedBy: 'test',
    assessedAt: '2026-01-01T00:00:00.000Z',
    answers: Object.entries(base).map(([componentKey, v]) => ({ componentKey, ...v })),
  };
  return assessment;
};

describe('legacy Yekun Rəy engine', () => {
  it('weights the five criteria 20/20/35/15/10', () => {
    const weights = LEGACY_SCORECARD_V1.categories.map((c) => c.weight);
    expect(weights).toEqual([20, 20, 35, 15, 10]);
    expect(weights.reduce((s, w) => s + w, 0)).toBe(100);
  });

  it('scores a fully satisfactory file at 100', () => {
    const r = evaluateLegacyOpinion(LEGACY_SCORECARD_V1, legacyAnswers());
    expect(r.totalScore).toBeCloseTo(100, 6);
    expect(r.bandLabelEn).toBe('Low risk');
    expect(r.globalStopTriggered).toBe(false);
  });

  it('applies the >=86 / 71 / 56 / 41 band cutoffs', () => {
    const bands = LEGACY_SCORECARD_V1.bands.map((b) => b.min);
    expect(bands).toEqual([86, 71, 56, 41, 0]);
  });

  it('zeroes the whole opinion when a criterion-level stop factor fires', () => {
    const r = evaluateLegacyOpinion(
      LEGACY_SCORECARD_V1,
      legacyAnswers({ UNJUSTIFIED_DPD_30_PLUS: { optionKey: 'YES', achievement: 0 } }),
    );
    expect(r.globalStopTriggered).toBe(true);
    expect(r.totalScore).toBe(0);
    expect(r.rawTotal).toBeGreaterThan(0); // the pre-stop score is preserved
    expect(r.bandLabelEn).toBe('High risk');
  });

  it('treats a business-ownership score of 40 or less as a stop factor', () => {
    const at40 = evaluateLegacyOpinion(
      LEGACY_SCORECARD_V1,
      legacyAnswers({ BUSINESS_OWNERSHIP_LINK: { achievement: 0.4 } }),
    );
    const at41 = evaluateLegacyOpinion(
      LEGACY_SCORECARD_V1,
      legacyAnswers({ BUSINESS_OWNERSHIP_LINK: { achievement: 0.41 } }),
    );
    expect(at40.globalStopTriggered).toBe(true);
    expect(at41.globalStopTriggered).toBe(false);
  });

  it('only zeroes the purpose criterion when efficiency AND control are both zero', () => {
    const onlyEfficiency = evaluateLegacyOpinion(
      LEGACY_SCORECARD_V1,
      legacyAnswers({ PURPOSE_EFFICIENCY: { optionKey: 'INEFFICIENT', achievement: 0 } }),
    );
    const both = evaluateLegacyOpinion(
      LEGACY_SCORECARD_V1,
      legacyAnswers({
        PURPOSE_EFFICIENCY: { optionKey: 'INEFFICIENT', achievement: 0 },
        PURPOSE_CONTROL: { optionKey: 'NOT_POSSIBLE', achievement: 0 },
      }),
    );
    expect(onlyEfficiency.globalStopTriggered).toBe(false);
    expect(both.globalStopTriggered).toBe(true);
  });

  it('never lets collateral zero the opinion', () => {
    const r = evaluateLegacyOpinion(
      LEGACY_SCORECARD_V1,
      legacyAnswers({
        COLLATERAL_OWNER_RELATION: { optionKey: 'NO', achievement: 0 },
        COLLATERAL_RISK_GRADE: { optionKey: 'HIGH', achievement: 0 },
        GUARANTOR_SUITABILITY: { optionKey: 'UNSUITABLE', achievement: 0 },
      }),
    );
    expect(r.globalStopTriggered).toBe(false);
    expect(r.totalScore).toBeCloseTo(90, 6);
  });

  it('waives the debt-to-equity stop factor for the services sector', () => {
    const answers = legacyAnswers({ BALANCE_SHEET: { achievement: 0 } });
    const generic = evaluateLegacyOpinion(LEGACY_SCORECARD_V1, answers, { sector: 'Ticarət' });
    const services = evaluateLegacyOpinion(LEGACY_SCORECARD_V1, answers, { sector: 'Xidmət' });
    expect(generic.globalStopTriggered).toBe(true);
    expect(services.globalStopTriggered).toBe(false);
  });

  it('caps the credit-history criterion at 60% when there is no credit history', () => {
    const r = evaluateLegacyOpinion(LEGACY_SCORECARD_V1, legacyAnswers(), { noCreditHistory: true });
    const history = r.categories.find((c) => c.category.key === 'CREDIT_HISTORY')!;
    expect(history.points).toBeCloseTo(12, 6); // 60% of 20
    expect(history.cappedByNoHistory).toBe(true);
  });

  it('averages manual sub-scores for the financial criterion rather than weighting them', () => {
    const r = evaluateLegacyOpinion(
      LEGACY_SCORECARD_V1,
      legacyAnswers({
        BALANCE_SHEET: { achievement: 0.6 },
        INCOME_STATEMENT: { achievement: 0.56 },
        CASH_FLOWS: { achievement: 0.5 },
        STATEMENT_COMPARISON: { achievement: 0.5 },
        RATIOS: { achievement: 0.56 },
      }),
    );
    const financial = r.categories.find((c) => c.category.key === 'FINANCIAL')!;
    // mean 54.4% of 35 points = 19.04, matching the worked example in the source
    expect(financial.points).toBeCloseTo(19.04, 2);
  });
});

/* ------------------------------------------------------------------ */
/* Rating engine                                                       */
/* ------------------------------------------------------------------ */

describe('bureau rating and pre-screening', () => {
  it('maps ACB scores to the proposed bands', () => {
    expect(gradeFromScore(0, ACB_SCALE_PROMETEIA_V1)).toBe('POOR');
    expect(gradeFromScore(149, ACB_SCALE_PROMETEIA_V1)).toBe('POOR');
    expect(gradeFromScore(150, ACB_SCALE_PROMETEIA_V1)).toBe('SATISFACTORY');
    expect(gradeFromScore(399, ACB_SCALE_PROMETEIA_V1)).toBe('SATISFACTORY');
    expect(gradeFromScore(400, ACB_SCALE_PROMETEIA_V1)).toBe('MEDIUM');
    expect(gradeFromScore(700, ACB_SCALE_PROMETEIA_V1)).toBe('GOOD');
    expect(gradeFromScore(860, ACB_SCALE_PROMETEIA_V1)).toBe('EXCELLENT');
  });

  it('takes the worse of the micro and individual bureau ratings', () => {
    const r = computeBureauRating(880, 'MEDIUM', ACB_SCALE_PROMETEIA_V1);
    expect(r.grade).toBe('MEDIUM');
    expect(r.worstGradeSource).toContain('Fərdi');
  });

  it('rejects below the 399 threshold and passes at 400', () => {
    const below = preScreen(computeBureauRating(399, null, ACB_SCALE_PROMETEIA_V1), ACB_SCALE_PROMETEIA_V1);
    const at = preScreen(computeBureauRating(400, null, ACB_SCALE_PROMETEIA_V1), ACB_SCALE_PROMETEIA_V1);
    expect(below.outcome).toBe('REJECT');
    expect(at.outcome).toBe('PASS');
  });

  it('does not gate at all under the current ATB scale', () => {
    const r = preScreen(computeBureauRating(120, null, ACB_SCALE_ATB_CURRENT_V1), ACB_SCALE_ATB_CURRENT_V1);
    expect(r.outcome).toBe('PASS');
    expect(r.enabled).toBe(false);
  });

  it('escalates rather than rejects when there is no score', () => {
    const r = preScreen(computeBureauRating(null, null, ACB_SCALE_PROMETEIA_V1), ACB_SCALE_PROMETEIA_V1);
    expect(r.outcome).toBe('ESCALATE_TO_UW');
  });
});

describe('segmentation and notching', () => {
  it('splits Small and Medium at 300k post-transaction group exposure', () => {
    expect(determineSegment(299_999, SEGMENTATION_PROMETEIA_V1).segment).toBe('SMALL');
    expect(determineSegment(300_000, SEGMENTATION_PROMETEIA_V1).segment).toBe('MEDIUM');
  });

  const businessAssessment = (scores: [number, number, number, number]) => ({
    applicationId: 'a1',
    scorecardVersion: BUSINESS_SCORECARD_PROMETEIA_V1.id,
    assessedBy: 't',
    assessedAt: '2026-01-01T00:00:00.000Z',
    answers: [
      { areaKey: 'RELATIONSHIP_VERIFICATION', dimensionKey: 'RELATIONSHIP_VERIFICATION', score: scores[0], justification: '', supportingDocuments: [] },
      { areaKey: 'STRUCTURE_AND_MANAGEMENT', dimensionKey: 'TRACK_RECORD', score: scores[1], justification: '', supportingDocuments: [] },
      { areaKey: 'STRUCTURE_AND_MANAGEMENT', dimensionKey: 'BUSINESS_STRUCTURE', score: scores[2], justification: '', supportingDocuments: [] },
      { areaKey: 'DOCUMENTATION_REPORTING', dimensionKey: 'DOCUMENTATION_REPORTING', score: scores[3], justification: '', supportingDocuments: [] },
    ] as never,
  });

  const rate = (opts: {
    score: number;
    exposure: number;
    business: [number, number, number, number];
    z?: number;
  }) =>
    computeRating({
      microScore: opts.score,
      individualBureauGrade: null,
      postTransactionGroupExposure: opts.exposure,
      businessAssessment: businessAssessment(opts.business),
      altman:
        opts.z === undefined
          ? undefined
          : computeAltman(
              {
                workingCapital: opts.z * 1000,
                retainedEarnings: 0,
                ebit: 0,
                equity: 0,
                totalLiabilities: 1000,
                sales: 0,
                totalAssets: 1000,
              },
              'PRIVATE',
            ),
      scale: ACB_SCALE_PROMETEIA_V1,
      segmentation: SEGMENTATION_PROMETEIA_V1,
      notching: NOTCHING_PROMETEIA_V1,
      businessScorecard: BUSINESS_SCORECARD_PROMETEIA_V1,
    });

  it('averages the two dimensions of the structure area', () => {
    const r = rate({ score: 750, exposure: 100_000, business: [3, 3, 1, 3] });
    // 3 + (3+1)/2 + 3 = 8
    expect(r.business.totalScore).toBeCloseTo(8, 6);
    expect(r.business.riskBand).toBe('LOW_MEDIUM');
    expect(r.business.notch).toBe(0);
  });

  it('downgrades one notch at Medium-High business risk', () => {
    const r = rate({ score: 750, exposure: 100_000, business: [2, 2, 1, 1] }); // 2 + 1.5 + 1 = 4.5
    expect(r.business.riskBand).toBe('MEDIUM_HIGH');
    expect(r.initialGrade).toBe('GOOD');
    expect(r.finalGrade).toBe('MEDIUM');
  });

  it('downgrades two notches at High business risk', () => {
    const r = rate({ score: 750, exposure: 100_000, business: [1, 1, 1, 1] }); // 3.0
    expect(r.business.riskBand).toBe('HIGH');
    expect(r.finalGrade).toBe('SATISFACTORY');
  });

  it('skips the financial layer entirely for the Small segment', () => {
    const r = rate({ score: 750, exposure: 100_000, business: [3, 3, 3, 3], z: 5 });
    expect(r.segment).toBe('SMALL');
    expect(r.financial.applies).toBe(false);
    expect(r.financial.notch).toBe(0);
  });

  it('upgrades one notch on a low-risk Altman in the Medium segment', () => {
    const r = rate({ score: 750, exposure: 400_000, business: [3, 3, 3, 3], z: 5 });
    expect(r.segment).toBe('MEDIUM');
    expect(r.financial.notch).toBe(1);
    expect(r.finalGrade).toBe('EXCELLENT');
  });

  it('blocks the Altman upgrade when the initial rating is Poor', () => {
    const r = rate({ score: 100, exposure: 400_000, business: [3, 3, 3, 3], z: 5 });
    expect(r.initialGrade).toBe('POOR');
    expect(r.financial.notch).toBe(0);
    expect(r.finalGrade).toBe('POOR');
    expect(r.isWorstRating).toBe(true);
  });

  it('caps the combined downgrade at two notches', () => {
    const r = rate({ score: 900, exposure: 400_000, business: [1, 1, 1, 1], z: 0.5 });
    // Business -2 and Altman -2 would be -4 without the cap.
    expect(r.totalNotch).toBe(NOTCHING_PROMETEIA_V1.maxTotalDowngrade);
    expect(r.cappedAt).toBe(-2);
    expect(r.finalGrade).toBe('MEDIUM'); // EXCELLENT − 2
  });

  it('keeps the calculated grade visible after an override', () => {
    const r = computeRating({
      microScore: 750,
      individualBureauGrade: null,
      postTransactionGroupExposure: 100_000,
      businessAssessment: businessAssessment([3, 3, 3, 3]),
      override: { grade: 'MEDIUM', reason: 'test', approver: 'CRO' },
      scale: ACB_SCALE_PROMETEIA_V1,
      segmentation: SEGMENTATION_PROMETEIA_V1,
      notching: NOTCHING_PROMETEIA_V1,
      businessScorecard: BUSINESS_SCORECARD_PROMETEIA_V1,
    });
    expect(r.calculatedGrade).toBe('GOOD');
    expect(r.finalGrade).toBe('MEDIUM');
    expect(r.overrideApplied).toBe(true);
    expect(r.steps.some((s) => s.key === 'OVERRIDE')).toBe(true);
  });

  it('does not notch on an incomplete business assessment', () => {
    const r = computeRating({
      microScore: 750,
      individualBureauGrade: null,
      postTransactionGroupExposure: 100_000,
      businessAssessment: undefined,
      scale: ACB_SCALE_PROMETEIA_V1,
      segmentation: SEGMENTATION_PROMETEIA_V1,
      notching: NOTCHING_PROMETEIA_V1,
      businessScorecard: BUSINESS_SCORECARD_PROMETEIA_V1,
    });
    expect(r.business.complete).toBe(false);
    expect(r.business.notch).toBe(0);
    expect(r.finalGrade).toBe('GOOD');
  });
});

/* ------------------------------------------------------------------ */
/* Policy engine                                                       */
/* ------------------------------------------------------------------ */

describe('policy engine', () => {
  const ctx = (over: Partial<Parameters<typeof evaluatePolicy>[1]> = {}) => ({
    sector: 'Ticarət',
    metrics: {
      currentRatio: 2,
      debtToEquityInclNew: 0.5,
      dscrCurrent: 2,
      inventoryDays: 40,
    } as Record<string, number | null>,
    ...over,
  });

  it('lets a sector rule replace the base rule for the same metric', () => {
    const rules = resolveApplicableRules(POLICY_ATB_CURRENT_V1, ctx());
    const inventoryRules = rules.filter((r) => r.metric === 'inventoryDays');
    expect(inventoryRules).toHaveLength(1);
    expect(inventoryRules[0].sector).toBe('Ticarət');
  });

  it('drops a rule entirely for a sector it is waived in', () => {
    const rules = resolveApplicableRules(POLICY_ATB_CURRENT_V1, ctx({ sector: 'Xidmət' }));
    expect(rules.some((r) => r.metric === 'debtToEquityInclNew')).toBe(false);
  });

  it('classifies outcomes by the action the rule carries', () => {
    const r = evaluatePolicy(POLICY_ATB_CURRENT_V1, ctx({ metrics: { debtToEquityInclNew: 1.5, currentRatio: 1.0 } }));
    expect(r.stops.some((o) => o.metric === 'debtToEquityInclNew')).toBe(true);
    expect(r.exceptions.some((o) => o.metric === 'currentRatio')).toBe(true);
  });

  it('reports an uncomputable metric instead of silently passing it', () => {
    const r = evaluatePolicy(POLICY_ATB_CURRENT_V1, ctx({ metrics: { currentRatio: null } }));
    expect(r.notEvaluated.some((n) => n.ruleId === 'RATIO_CURRENT_RATIO')).toBe(true);
    expect(r.outcomes.some((o) => o.metric === 'currentRatio')).toBe(false);
  });

  it('treats Infinity as a breach, not as non-computable', () => {
    const r = evaluatePolicy(
      POLICY_ATB_CURRENT_V1,
      ctx({ metrics: { paymentToCapacity: Number.POSITIVE_INFINITY } }),
    );
    const outcome = r.outcomes.find((o) => o.metric === 'paymentToCapacity');
    expect(outcome?.passed).toBe(false);
  });
});

/* ------------------------------------------------------------------ */
/* Stop factors                                                        */
/* ------------------------------------------------------------------ */

describe('stop factors', () => {
  const ctx = (over: Record<string, unknown> = {}) =>
    ({
      sector: 'Ticarət',
      segment: 'MEDIUM' as const,
      product: 'WORKING_CAPITAL_LOAN',
      bureauExtractsComplete: true,
      missingBureauSubjects: [],
      unjustifiedDpd30Plus: false,
      maxDpdObserved: 0,
      ownershipEvidenceScore: 80,
      debtToEquityInclNew: 0.5,
      paymentToCapacity: 0.5,
      forecastShowsCapacity: true,
      purposeEfficiencyScore: 100,
      purposeControlScore: 100,
      bureauScore: 700,
      preScreenThreshold: 400,
      ...over,
    }) as never;

  it('fires nothing on a clean file', () => {
    expect(triggeredStopFactors(evaluateStopFactors(STOP_FACTORS_V1, ctx()))).toHaveLength(0);
  });

  it('fires when bureau extracts are missing', () => {
    const hits = triggeredStopFactors(
      evaluateStopFactors(STOP_FACTORS_V1, ctx({ bureauExtractsComplete: false, missingBureauSubjects: ['X'] })),
    );
    expect(hits.map((h) => h.rule.id)).toContain('SF_AKB_EXTRACTS_MISSING');
    expect(hits[0].observedValue).toContain('X');
  });

  it('fires on debt-to-equity above 100% but not at exactly 100%', () => {
    const over = triggeredStopFactors(evaluateStopFactors(STOP_FACTORS_V1, ctx({ debtToEquityInclNew: 1.01 })));
    const at = triggeredStopFactors(evaluateStopFactors(STOP_FACTORS_V1, ctx({ debtToEquityInclNew: 1.0 })));
    expect(over.map((h) => h.rule.id)).toContain('SF_DEBT_TO_EQUITY_OVER_100');
    expect(at.map((h) => h.rule.id)).not.toContain('SF_DEBT_TO_EQUITY_OVER_100');
  });

  it('waives the services-sector debt-to-equity stop and records the waiver', () => {
    const hits = evaluateStopFactors(STOP_FACTORS_V1, ctx({ sector: 'Xidmət', debtToEquityInclNew: 1.5 }));
    const hit = hits.find((h) => h.rule.id === 'SF_DEBT_TO_EQUITY_OVER_100')!;
    expect(hit.triggered).toBe(false);
    expect(hit.waivedBySector).toBe(true);
  });

  it('waives the capacity stop for agriculture only when the forecast supports it', () => {
    const supported = evaluateStopFactors(
      STOP_FACTORS_V1,
      ctx({ sector: 'Kənd təsərrüfatı', paymentToCapacity: 1.2, forecastShowsCapacity: true }),
    ).find((h) => h.rule.id === 'SF_REPAYMENT_CAPACITY_NORM')!;
    expect(supported.triggered).toBe(false);
  });

  it('keeps the Prometeia pre-screen stop factor disabled by default', () => {
    const rule = STOP_FACTORS_V1.find((s) => s.id === 'SF_PRESCREEN_BUREAU_SCORE')!;
    expect(rule.enabled).toBe(false);
    expect(rule.status).toBe('PROMETEIA_PROPOSED');
  });
});

/* ------------------------------------------------------------------ */
/* Routing engine                                                      */
/* ------------------------------------------------------------------ */

describe('routing engine', () => {
  const ctx = (over: Record<string, unknown> = {}) =>
    ({
      postTransactionGroupExposure: 150_000,
      requestedAmount: 150_000,
      eligibleCollateralCoverage: 0.9,
      bureauGrade: 'MEDIUM' as const,
      finalInternalGrade: 'MEDIUM' as const,
      isWorstRating: false,
      stopFactorCount: 0,
      policyExceptionCount: 0,
      product: 'WORKING_CAPITAL_LOAN',
      segment: 'SMALL' as const,
      preScreenRejected: false,
      underwriterAssessmentNegative: false,
      ...over,
    }) as never;

  it('routes on post-transaction group exposure and explains why', () => {
    const r = routeApplication(WORKFLOW_PROMETEIA_PROPOSED_V2, ctx());
    expect(r.bucket?.key).toBe('B_100K_200K');
    expect(r.decisionAuthority).toBe('DIRECTOR_UW_AND_HEAD_KOB');
    expect(r.reasons.join(' ')).toContain('qrup ekspozisiyası');
  });

  it('sends a worst-rated but well-collateralised case to the director under OR logic', () => {
    const r = routeApplication(WORKFLOW_PROMETEIA_PROPOSED_V2, ctx({ isWorstRating: true }));
    expect(r.escalated).toBe(false);
    expect(r.decisionAuthority).toBe('DIRECTOR_UW_AND_HEAD_KOB');
  });

  it('escalates the same case once the operator is switched to AND', () => {
    const andVersion = { ...WORKFLOW_PROMETEIA_PROPOSED_V2, collateralRatingOperator: 'AND' as const };
    const r = routeApplication(andVersion, ctx({ isWorstRating: true }));
    expect(r.escalated).toBe(true);
    expect(r.decisionAuthority).toBe('SMALL_COMMITTEE');
  });

  it('escalates when neither the collateral nor the rating condition holds', () => {
    const r = routeApplication(
      WORKFLOW_PROMETEIA_PROPOSED_V2,
      ctx({ isWorstRating: true, eligibleCollateralCoverage: 0.4 }),
    );
    expect(r.escalated).toBe(true);
    expect(r.decisionAuthority).toBe('SMALL_COMMITTEE');
  });

  it('overrides ordinary routing when a stop factor is present', () => {
    const r = routeApplication(WORKFLOW_PROMETEIA_PROPOSED_V2, ctx({ stopFactorCount: 1 }));
    expect(r.decisionAuthority).toBe('BIG_COMMITTEE');
    expect(r.bucket).toBeNull();
    expect(r.reasons.join(' ')).toContain('stop faktor');
  });

  it('sends stop-factor cases to the Management Board under V1 naming', () => {
    const r = routeApplication(WORKFLOW_PROMETEIA_PROPOSED_V1, ctx({ stopFactorCount: 1 }));
    expect(r.decisionAuthority).toBe('MANAGEMENT_BOARD');
  });

  it('applies both notching layers only above 300k', () => {
    const small = routeApplication(WORKFLOW_PROMETEIA_PROPOSED_V2, ctx());
    const medium = routeApplication(
      WORKFLOW_PROMETEIA_PROPOSED_V2,
      ctx({ postTransactionGroupExposure: 400_000, segment: 'MEDIUM' }),
    );
    expect(small.notchingLayers).toEqual(['BUSINESS']);
    expect(medium.notchingLayers).toEqual(['BUSINESS', 'FINANCIAL']);
  });

  it('splits the top bucket at 500k under V1 and 700k under V2', () => {
    const v1 = routeApplication(WORKFLOW_PROMETEIA_PROPOSED_V1, ctx({ postTransactionGroupExposure: 600_000 }));
    const v2 = routeApplication(WORKFLOW_PROMETEIA_PROPOSED_V2, ctx({ postTransactionGroupExposure: 600_000 }));
    expect(v1.decisionAuthority).toBe('MANAGEMENT_BOARD');
    expect(v2.decisionAuthority).toBe('SMALL_COMMITTEE');
  });

  it('reproduces the current-state routing without any notching', () => {
    const r = routeApplication(WORKFLOW_ATB_CURRENT_V1, ctx({ postTransactionGroupExposure: 200_000 }));
    expect(r.decisionAuthority).toBe('SME_COMMITTEE');
    expect(r.notchingLayers).toEqual([]);
  });

  it('escalates the 50-100k bucket on a negative underwriting assessment', () => {
    const r = routeApplication(
      WORKFLOW_ATB_CURRENT_V1,
      ctx({ postTransactionGroupExposure: 75_000, underwriterAssessmentNegative: true }),
    );
    expect(r.escalated).toBe(true);
    expect(r.decisionAuthority).toBe('SME_COMMITTEE');
  });

  it('surfaces the documented AND/OR ambiguity rather than hiding it', () => {
    const r = routeApplication(WORKFLOW_PROMETEIA_PROPOSED_V2, ctx());
    expect(r.ambiguities.length).toBeGreaterThan(0);
    expect(r.ambiguities.join(' ')).toContain('VƏ YA');
  });
});
