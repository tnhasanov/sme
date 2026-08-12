import type { LegacyAssessment, LegacyScoreAnswer } from '@/types/application';
import type { LegacyCategory, LegacyComponent, LegacyScorecard } from '@/config/scorecards';

/**
 * Legacy ATB "Yekun Rəy" engine (§40).
 *
 * Reproduces `Rəy forması` exactly:
 *  - WEIGHTED_SUM categories multiply each answer's achievement by its share
 *    of the category's points;
 *  - MEAN_OF_MANUAL_SCORES categories average the 0..100 sub-scores and scale
 *    the mean to the category's points;
 *  - a triggered stop factor zeroes its category;
 *  - a zeroed category that participates in the global stop zeroes the whole
 *    opinion (Excel J109's OR-guard). Collateral is excluded from that guard.
 */

export interface LegacyComponentResult {
  component: LegacyComponent;
  answer?: LegacyScoreAnswer;
  achievement: number;
  /** Manual 0..100 score for MEAN categories, else null. */
  manualScore: number | null;
  points: number;
  maxPoints: number;
  stopTriggered: boolean;
  stopMessageAz?: string;
  answered: boolean;
}

export interface LegacyCategoryResult {
  category: LegacyCategory;
  components: LegacyComponentResult[];
  points: number;
  maxPoints: number;
  achievedPct: number;
  bandLabelAz: string;
  bandLabelEn: string;
  bandTone: string;
  stopTriggered: boolean;
  stopReasonsAz: string[];
  cappedByNoHistory: boolean;
  fullyAnswered: boolean;
}

export interface LegacyOpinionResult {
  scorecardId: string;
  scorecardVersion: string;
  categories: LegacyCategoryResult[];
  rawTotal: number;
  totalScore: number;
  bandLabelAz: string;
  bandLabelEn: string;
  bandTone: string;
  globalStopTriggered: boolean;
  stopReasonsAz: string[];
  completenessPct: number;
}

export interface LegacyEvaluationOptions {
  /** "Mövcud deyil" — no credit history exists for the applicant. */
  noCreditHistory?: boolean;
  /** Sector name, used to waive sector-exempt stop factors. */
  sector?: string;
}

function bandFor(scorecard: LegacyScorecard, value: number) {
  return (
    scorecard.bands.find((b) => value >= b.min) ??
    scorecard.bands[scorecard.bands.length - 1]
  );
}

function answerFor(assessment: LegacyAssessment | undefined, key: string): LegacyScoreAnswer | undefined {
  return assessment?.answers.find((a) => a.componentKey === key);
}

function stopWaived(component: LegacyComponent, sector?: string): boolean {
  const waived = component.stopRule?.waivedForSectors;
  if (!waived || !sector) return false;
  return waived.includes(sector);
}

function evaluateComponent(
  component: LegacyComponent,
  category: LegacyCategory,
  assessment: LegacyAssessment | undefined,
  options: LegacyEvaluationOptions,
): LegacyComponentResult {
  const answer = answerFor(assessment, component.key);
  const answered = answer !== undefined;

  if (component.type === 'MANUAL_0_100') {
    // For MEAN categories the "achievement" is the 0..100 score itself.
    const manualScore = answer ? clamp(answer.achievement * 100, 0, 100) : 0;
    const stopTriggered =
      !!component.stopRule &&
      !stopWaived(component, options.sector) &&
      ((component.stopRule.when === 'ZERO' && answered && manualScore === 0) ||
        (component.stopRule.when === 'LTE' && answered && manualScore <= (component.stopRule.value ?? 0)));

    return {
      component,
      answer,
      achievement: manualScore / 100,
      manualScore,
      // Points are assigned at category level for MEAN aggregation.
      points: 0,
      maxPoints: category.weight / category.components.length,
      stopTriggered,
      stopMessageAz: stopTriggered ? component.stopRule?.messageAz : undefined,
      answered,
    };
  }

  const option = component.options?.find((o) => o.key === answer?.optionKey);
  const achievement = option ? option.achievement : answered ? answer!.achievement : 0;
  const maxPoints = (category.weight * component.weightWithinCategory) / 100;
  const points = maxPoints * achievement;

  const stopTriggered =
    !!component.stopRule &&
    !stopWaived(component, options.sector) &&
    component.stopRule.when === 'ZERO' &&
    answered &&
    achievement === 0;

  return {
    component,
    answer,
    achievement,
    manualScore: null,
    points,
    maxPoints,
    stopTriggered,
    stopMessageAz: stopTriggered ? component.stopRule?.messageAz : undefined,
    answered,
  };
}

function evaluateCategory(
  category: LegacyCategory,
  scorecard: LegacyScorecard,
  assessment: LegacyAssessment | undefined,
  options: LegacyEvaluationOptions,
): LegacyCategoryResult {
  const components = category.components.map((c) => evaluateComponent(c, category, assessment, options));

  const stopReasonsAz = components.filter((c) => c.stopTriggered).map((c) => c.stopMessageAz!).filter(Boolean);

  // Joint stop: only fires when EVERY listed component scored zero.
  let jointStop = false;
  if (category.jointStopComponents && category.jointStopComponents.length > 0) {
    const listed = components.filter((c) => category.jointStopComponents!.includes(c.component.key));
    jointStop = listed.length > 0 && listed.every((c) => c.answered && c.achievement === 0);
    if (jointStop) {
      stopReasonsAz.push(
        'Kreditin təyinatının səmərəliliyi və təyinata nəzarət imkanı eyni anda qiymətləndirilə bilmir.',
      );
    }
  }

  const stopTriggered = stopReasonsAz.length > 0;

  let points: number;
  let cappedByNoHistory = false;

  if (stopTriggered) {
    points = 0;
  } else if (category.aggregation === 'MEAN_OF_MANUAL_SCORES') {
    const mean =
      components.reduce((s, c) => s + (c.manualScore ?? 0), 0) / Math.max(components.length, 1);
    points = (mean / 100) * category.weight;
    // Distribute the category points across components for display only.
    for (const c of components) {
      c.points = ((c.manualScore ?? 0) / 100) * (category.weight / components.length);
    }
  } else {
    points = components.reduce((s, c) => s + c.points, 0);
  }

  // Credit history absent: only the first component counts and the category
  // is capped, so the case cannot look artificially strong (§4.10).
  if (
    !stopTriggered &&
    options.noCreditHistory &&
    category.key === 'CREDIT_HISTORY' &&
    category.noHistoryCapPct !== undefined
  ) {
    const firstAnswered = components[0]?.achievement === 1;
    points = firstAnswered ? (category.weight * category.noHistoryCapPct) / 100 : 0;
    cappedByNoHistory = true;
  }

  const achievedPct = category.weight > 0 ? (points / category.weight) * 100 : 0;
  const band = bandFor(scorecard, achievedPct);

  return {
    category,
    components,
    points,
    maxPoints: category.weight,
    achievedPct,
    bandLabelAz: band.labelAz,
    bandLabelEn: band.labelEn,
    bandTone: band.tone,
    stopTriggered,
    stopReasonsAz,
    cappedByNoHistory,
    fullyAnswered: components.every((c) => c.answered),
  };
}

export function evaluateLegacyOpinion(
  scorecard: LegacyScorecard,
  assessment: LegacyAssessment | undefined,
  options: LegacyEvaluationOptions = {},
): LegacyOpinionResult {
  const categories = scorecard.categories.map((c) => evaluateCategory(c, scorecard, assessment, options));

  const rawTotal = categories.reduce((s, c) => s + c.points, 0);

  const stopping = categories.filter((c) => c.category.participatesInGlobalStop && c.stopTriggered);
  const globalStopTriggered = stopping.length > 0;
  const totalScore = globalStopTriggered ? 0 : rawTotal;

  const band = bandFor(scorecard, totalScore);

  const totalComponents = categories.reduce((s, c) => s + c.components.length, 0);
  const answeredComponents = categories.reduce((s, c) => s + c.components.filter((x) => x.answered).length, 0);

  return {
    scorecardId: scorecard.id,
    scorecardVersion: scorecard.version,
    categories,
    rawTotal,
    totalScore,
    bandLabelAz: band.labelAz,
    bandLabelEn: band.labelEn,
    bandTone: band.tone,
    globalStopTriggered,
    stopReasonsAz: stopping.flatMap((c) => c.stopReasonsAz),
    completenessPct: totalComponents > 0 ? (answeredComponents / totalComponents) * 100 : 0,
  };
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(Math.max(v, lo), hi);
}
