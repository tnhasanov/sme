import type { ISODateTime } from '@/types/core';
import type { BusinessAssessment } from '@/types/application';
import type { BusinessScorecard } from '@/config/scorecards';
import {
  ACB_SCALES,
  type AcbRatingScale,
  type BusinessRiskBand,
  BUSINESS_RISK_LABEL_AZ,
  GRADE_LABEL_AZ,
  GRADE_ORDER,
  type NotchingConfig,
  type RatingGrade,
  type Segment,
  type SegmentationConfig,
} from '@/config/rating';
import type { AltmanResult } from '@/domain/calculations/altman';

/**
 * Prometeia quick-win rating engine (§41-§46).
 *
 * Waterfall: bureau rating → business-analysis notch → financial (Altman)
 * notch (Medium segment only) → final internal rating. Every step records why
 * it moved, so the UI can render the waterfall and the audit trail can prove
 * the result (§53).
 */

/* ------------------------------------------------------------------ */
/* Bureau rating                                                       */
/* ------------------------------------------------------------------ */

export interface BureauRatingResult {
  score: number | null;
  grade: RatingGrade | null;
  gradeLabelAz: string;
  scaleId: string;
  bandLabel: string;
  /** Worst grade observed across micro and individual bureau ratings. */
  worstGradeSource: string;
}

export function gradeFromScore(score: number, scale: AcbRatingScale): RatingGrade | null {
  const band = scale.bands.find((b) => score >= b.min && score <= b.max);
  return band?.grade ?? null;
}

export function weakerGrade(a: RatingGrade | null, b: RatingGrade | null): RatingGrade | null {
  if (a === null) return b;
  if (b === null) return a;
  return GRADE_ORDER.indexOf(a) <= GRADE_ORDER.indexOf(b) ? a : b;
}

export function computeBureauRating(
  microScore: number | null,
  individualGrade: RatingGrade | null,
  scale: AcbRatingScale,
): BureauRatingResult {
  const microGrade = microScore !== null ? gradeFromScore(microScore, scale) : null;
  const grade = weakerGrade(microGrade, individualGrade);

  const band = microScore !== null ? scale.bands.find((b) => microScore >= b.min && microScore <= b.max) : undefined;

  return {
    score: microScore,
    grade,
    gradeLabelAz: grade ? GRADE_LABEL_AZ[grade] : 'Reytinq yoxdur',
    scaleId: scale.id,
    bandLabel: band ? `${band.min}–${band.max}` : '—',
    worstGradeSource:
      microGrade && individualGrade
        ? grade === microGrade
          ? 'Mikro reytinq (daha zəif)'
          : 'Fərdi reytinq (daha zəif)'
        : microGrade
          ? 'Mikro reytinq'
          : individualGrade
            ? 'Fərdi reytinq'
            : 'Mənbə yoxdur',
  };
}

/* ------------------------------------------------------------------ */
/* Pre-screening (§16)                                                 */
/* ------------------------------------------------------------------ */

export type PreScreenOutcome = 'PASS' | 'REJECT' | 'ESCALATE_TO_UW';

export interface PreScreenResult {
  outcome: PreScreenOutcome;
  reasonAz: string;
  score: number | null;
  grade: RatingGrade | null;
  thresholdApplied: number | null;
  scaleId: string;
  enabled: boolean;
}

export function preScreen(bureau: BureauRatingResult, scale: AcbRatingScale): PreScreenResult {
  if (!scale.enabled || scale.preScreenRejectBelow === null) {
    return {
      outcome: 'PASS',
      reasonAz: 'Avtomatik bürо süzgəci aktiv deyil — qiymətləndirmə əl ilə aparılır.',
      score: bureau.score,
      grade: bureau.grade,
      thresholdApplied: null,
      scaleId: scale.id,
      enabled: false,
    };
  }

  if (bureau.score === null) {
    return {
      outcome: scale.noScoreAction === 'PASS' ? 'PASS' : scale.noScoreAction,
      reasonAz: 'AKB skoru mövcud deyil — anderraytinq qiymətləndirməsi tələb olunur.',
      score: null,
      grade: bureau.grade,
      thresholdApplied: scale.preScreenRejectBelow,
      scaleId: scale.id,
      enabled: true,
    };
  }

  if (bureau.score < scale.preScreenRejectBelow) {
    return {
      outcome: scale.preScreenAction,
      reasonAz: `AKB skoru ${bureau.score} — ilkin süzgəc həddindən (${scale.preScreenRejectBelow}) aşağıdır. Reytinq: ${bureau.gradeLabelAz}.`,
      score: bureau.score,
      grade: bureau.grade,
      thresholdApplied: scale.preScreenRejectBelow,
      scaleId: scale.id,
      enabled: true,
    };
  }

  return {
    outcome: 'PASS',
    reasonAz: `AKB skoru ${bureau.score} (${bureau.gradeLabelAz}) ilkin süzgəci keçir.`,
    score: bureau.score,
    grade: bureau.grade,
    thresholdApplied: scale.preScreenRejectBelow,
    scaleId: scale.id,
    enabled: true,
  };
}

/* ------------------------------------------------------------------ */
/* Business analysis layer (§42)                                       */
/* ------------------------------------------------------------------ */

export interface BusinessAreaResult {
  areaKey: string;
  labelAz: string;
  score: number;
  dimensions: Array<{ key: string; labelAz: string; score: number; justification: string }>;
}

export interface BusinessAnalysisResult {
  scorecardId: string;
  areas: BusinessAreaResult[];
  totalScore: number;
  riskBand: BusinessRiskBand | null;
  riskBandLabelAz: string;
  notch: number;
  complete: boolean;
  missingDimensions: string[];
}

export function evaluateBusinessAnalysis(
  scorecard: BusinessScorecard,
  assessment: BusinessAssessment | undefined,
  notching: NotchingConfig,
): BusinessAnalysisResult {
  const areas: BusinessAreaResult[] = [];
  const missing: string[] = [];

  for (const area of scorecard.areas) {
    const dims = area.dimensions.map((d) => {
      const answer = assessment?.answers.find((a) => a.areaKey === area.key && a.dimensionKey === d.key);
      if (!answer) missing.push(`${area.labelAz} → ${d.labelAz}`);
      return {
        key: d.key,
        labelAz: d.labelAz,
        score: answer?.score ?? 0,
        justification: answer?.justification ?? '',
      };
    });

    const answered = dims.filter((d) => d.score > 0);
    const areaScore = answered.length > 0 ? answered.reduce((s, d) => s + d.score, 0) / answered.length : 0;

    areas.push({ areaKey: area.key, labelAz: area.labelAz, score: areaScore, dimensions: dims });
  }

  const complete = missing.length === 0;
  const totalScore = areas.reduce((s, a) => s + a.score, 0);

  const bandRule = complete
    ? notching.businessBands.find((b) => totalScore >= b.min && totalScore <= b.max)
    : undefined;

  return {
    scorecardId: scorecard.id,
    areas,
    totalScore,
    riskBand: bandRule?.band ?? null,
    riskBandLabelAz: bandRule ? BUSINESS_RISK_LABEL_AZ[bandRule.band] : 'Qiymətləndirilməyib',
    notch: bandRule?.notch ?? 0,
    complete,
    missingDimensions: missing,
  };
}

/* ------------------------------------------------------------------ */
/* Financial (Altman) layer (§46)                                      */
/* ------------------------------------------------------------------ */

export interface FinancialLayerResult {
  applies: boolean;
  reasonAz: string;
  altman?: AltmanResult;
  notch: number;
}

export function evaluateFinancialLayer(
  segment: Segment,
  altman: AltmanResult | undefined,
  initialGrade: RatingGrade | null,
  notching: NotchingConfig,
): FinancialLayerResult {
  if (!notching.altman.appliesToSegments.includes(segment)) {
    return {
      applies: false,
      reasonAz: `Maliyyə təbəqəsi yalnız ${notching.altman.appliesToSegments.join(', ')} seqmentinə tətbiq olunur — bu sifariş ${segment} seqmentindədir.`,
      notch: 0,
    };
  }
  if (!altman || altman.z === null || altman.zone === null) {
    return {
      applies: true,
      reasonAz: 'Altman Z hesablanmayıb — maliyyə məlumatları natamamdır.',
      altman,
      notch: 0,
    };
  }

  const { zone } = altman;
  if (zone === 'HIGH_RISK') {
    return {
      applies: true,
      reasonAz: `Altman Z = ${altman.z.toFixed(2)} yüksək risk zonasındadır (< ${altman.config.highRiskBelow}).`,
      altman,
      notch: notching.altman.highRiskNotch,
    };
  }
  if (zone === 'LOW_RISK') {
    const blocked = initialGrade !== null && notching.altman.lowRiskUpgradeBlockedForGrades.includes(initialGrade);
    return {
      applies: true,
      reasonAz: blocked
        ? `Altman Z = ${altman.z.toFixed(2)} aşağı risk zonasındadır, lakin ilkin reytinq "${GRADE_LABEL_AZ[initialGrade!]}" olduğu üçün yüksəlmə tətbiq edilmir.`
        : `Altman Z = ${altman.z.toFixed(2)} aşağı risk zonasındadır (> ${altman.config.lowRiskAbove}).`,
      altman,
      notch: blocked ? 0 : notching.altman.lowRiskNotch,
    };
  }
  return {
    applies: true,
    reasonAz: `Altman Z = ${altman.z.toFixed(2)} boz zonadadır (${altman.config.highRiskBelow}–${altman.config.lowRiskAbove}) — düzəliş tətbiq edilmir.`,
    altman,
    notch: notching.altman.greyNotch,
  };
}

/* ------------------------------------------------------------------ */
/* Waterfall                                                           */
/* ------------------------------------------------------------------ */

export interface RatingStep {
  key: 'INITIAL' | 'BUSINESS' | 'FINANCIAL' | 'CAP' | 'OVERRIDE' | 'FINAL';
  labelAz: string;
  notch: number;
  gradeBefore: RatingGrade | null;
  gradeAfter: RatingGrade | null;
  reasonAz: string;
}

export interface RatingResult {
  scorecardVersion: string;
  segment: Segment;
  segmentReasonAz: string;
  bureau: BureauRatingResult;
  business: BusinessAnalysisResult;
  financial: FinancialLayerResult;
  steps: RatingStep[];
  initialGrade: RatingGrade | null;
  calculatedGrade: RatingGrade | null;
  finalGrade: RatingGrade | null;
  finalGradeLabelAz: string;
  totalNotch: number;
  cappedAt: number | null;
  isWorstRating: boolean;
  overrideApplied: boolean;
  executedAt: ISODateTime;
}

function shiftGrade(grade: RatingGrade | null, notch: number): RatingGrade | null {
  if (grade === null) return null;
  const idx = GRADE_ORDER.indexOf(grade);
  const next = Math.min(Math.max(idx + notch, 0), GRADE_ORDER.length - 1);
  return GRADE_ORDER[next];
}

export function determineSegment(
  postTransactionGroupExposure: number,
  cfg: SegmentationConfig,
): { segment: Segment; reasonAz: string } {
  const segment: Segment = postTransactionGroupExposure >= cfg.mediumThresholdAzn ? 'MEDIUM' : 'SMALL';
  return {
    segment,
    reasonAz: `Əməliyyatdan sonrakı qrup ekspozisiyası ${formatAzn(postTransactionGroupExposure)} — hədd ${formatAzn(
      cfg.mediumThresholdAzn,
    )} olduğu üçün seqment: ${segment === 'MEDIUM' ? 'Orta (İri)' : 'Kiçik'}.`,
  };
}

export interface RatingInput {
  microScore: number | null;
  individualBureauGrade: RatingGrade | null;
  postTransactionGroupExposure: number;
  businessAssessment?: BusinessAssessment;
  altman?: AltmanResult;
  override?: { grade: RatingGrade; reason: string; approver: string };
  scale?: AcbRatingScale;
  segmentation: SegmentationConfig;
  notching: NotchingConfig;
  businessScorecard: BusinessScorecard;
  worstGrade?: RatingGrade;
  executedAt?: ISODateTime;
}

export function computeRating(input: RatingInput): RatingResult {
  const scale = input.scale ?? ACB_SCALES.ACB_SCALE_PROMETEIA_V1;
  const bureau = computeBureauRating(input.microScore, input.individualBureauGrade, scale);
  const { segment, reasonAz: segmentReasonAz } = determineSegment(
    input.postTransactionGroupExposure,
    input.segmentation,
  );

  const business = evaluateBusinessAnalysis(input.businessScorecard, input.businessAssessment, input.notching);
  const initialGrade = bureau.grade;

  const steps: RatingStep[] = [];

  steps.push({
    key: 'INITIAL',
    labelAz: 'İlkin reytinq (AKB)',
    notch: 0,
    gradeBefore: null,
    gradeAfter: initialGrade,
    reasonAz:
      bureau.score !== null
        ? `AKB Micro Score ${bureau.score} → ${bureau.gradeLabelAz} (${bureau.bandLabel}). Mənbə: ${bureau.worstGradeSource}.`
        : 'AKB skoru mövcud deyil.',
  });

  const afterBusiness = shiftGrade(initialGrade, business.notch);
  steps.push({
    key: 'BUSINESS',
    labelAz: 'Biznes təhlili düzəlişi',
    notch: business.notch,
    gradeBefore: initialGrade,
    gradeAfter: afterBusiness,
    reasonAz: business.complete
      ? `Biznes təhlili balı ${business.totalScore.toFixed(2)} / 9 → ${business.riskBandLabelAz}. Düzəliş: ${
          business.notch === 0 ? 'yoxdur' : `${business.notch} pillə`
        }.`
      : `Biznes təhlili tamamlanmayıb (${business.missingDimensions.length} sual cavablandırılmayıb) — düzəliş tətbiq edilmir.`,
  });

  const financial = evaluateFinancialLayer(segment, input.altman, initialGrade, input.notching);
  const afterFinancial = shiftGrade(afterBusiness, financial.notch);
  steps.push({
    key: 'FINANCIAL',
    labelAz: 'Maliyyə təhlili düzəlişi (Altman)',
    notch: financial.notch,
    gradeBefore: afterBusiness,
    gradeAfter: afterFinancial,
    reasonAz: financial.reasonAz,
  });

  // Cap the combined movement.
  const rawNotch = business.notch + financial.notch;
  const cappedNotch = Math.min(
    Math.max(rawNotch, input.notching.maxTotalDowngrade),
    input.notching.maxTotalUpgrade,
  );
  const cappedAt = cappedNotch !== rawNotch ? cappedNotch : null;
  let calculatedGrade = shiftGrade(initialGrade, cappedNotch);

  if (cappedAt !== null) {
    steps.push({
      key: 'CAP',
      labelAz: 'Kumulyativ düzəliş limiti',
      notch: cappedNotch - rawNotch,
      gradeBefore: afterFinancial,
      gradeAfter: calculatedGrade,
      reasonAz: `Ümumi düzəliş ${rawNotch} pillə hesablandı, lakin limit (${input.notching.maxTotalDowngrade} … +${input.notching.maxTotalUpgrade}) tətbiq edilərək ${cappedNotch} pilləyə məhdudlaşdırıldı.`,
    });
  }

  let finalGrade = calculatedGrade;
  let overrideApplied = false;

  if (input.override) {
    overrideApplied = true;
    steps.push({
      key: 'OVERRIDE',
      labelAz: 'Əl ilə override',
      notch: calculatedGrade ? GRADE_ORDER.indexOf(input.override.grade) - GRADE_ORDER.indexOf(calculatedGrade) : 0,
      gradeBefore: calculatedGrade,
      gradeAfter: input.override.grade,
      reasonAz: `${input.override.reason} (təsdiq: ${input.override.approver}). Hesablanmış reytinq saxlanılır.`,
    });
    finalGrade = input.override.grade;
  }

  steps.push({
    key: 'FINAL',
    labelAz: 'Yekun daxili reytinq',
    notch: 0,
    gradeBefore: calculatedGrade,
    gradeAfter: finalGrade,
    reasonAz: finalGrade ? `Yekun daxili reytinq: ${GRADE_LABEL_AZ[finalGrade]}.` : 'Yekun reytinq təyin edilməyib.',
  });

  const worst = input.worstGrade ?? 'POOR';

  return {
    scorecardVersion: input.businessScorecard.id,
    segment,
    segmentReasonAz,
    bureau,
    business,
    financial,
    steps,
    initialGrade,
    calculatedGrade,
    finalGrade,
    finalGradeLabelAz: finalGrade ? GRADE_LABEL_AZ[finalGrade] : 'Təyin edilməyib',
    totalNotch: cappedNotch,
    cappedAt,
    isWorstRating: finalGrade === worst,
    overrideApplied,
    executedAt: input.executedAt ?? new Date().toISOString(),
  };
}

function formatAzn(n: number): string {
  return `${new Intl.NumberFormat('az-AZ', { maximumFractionDigits: 0 }).format(Math.round(n))} AZN`;
}
