import type { ISODateTime, Severity } from '@/types/core';
import type { StopFactorRule } from '@/config/policy';

/**
 * Stop factors (§48) — evaluated separately from the scorecard.
 *
 * A stop factor is not "a low score". It is a condition under which the bank
 * says the case cannot be objectively assessed, or must not proceed on
 * ordinary authority. Each evaluator reports the observed value that fired it
 * so the case file can prove why.
 */

export interface StopFactorContext {
  sector: string;
  segment: 'SMALL' | 'MEDIUM';
  product: string;

  /** Bureau extracts obtained for every connected person. */
  bureauExtractsComplete: boolean;
  missingBureauSubjects: string[];

  /** Unjustified 30+ DPD present anywhere in the group. */
  unjustifiedDpd30Plus: boolean;
  maxDpdObserved: number;

  /** Business-ownership evidence score, 0..100 (legacy sub-block 2.1). */
  ownershipEvidenceScore: number | null;

  debtToEquityInclNew: number | null;
  paymentToCapacity: number | null;
  forecastShowsCapacity: boolean;

  purposeEfficiencyScore: number | null;
  purposeControlScore: number | null;

  bureauScore: number | null;
  preScreenThreshold: number | null;
}

export interface StopFactorHit {
  rule: StopFactorRule;
  triggered: boolean;
  observedValue: string;
  severity: Severity;
  waivedBySector: boolean;
  evaluatedAt: ISODateTime;
  messageAz: string;
}

type Evaluator = (ctx: StopFactorContext) => { triggered: boolean; observed: string; messageAz: string } | null;

const EVALUATORS: Record<string, Evaluator> = {
  akbExtractsMissing: (ctx) => ({
    triggered: !ctx.bureauExtractsComplete,
    observed: ctx.bureauExtractsComplete
      ? 'Bütün əlaqəli şəxslər üzrə çıxarış alınıb'
      : `Çatışmayan çıxarışlar: ${ctx.missingBureauSubjects.join(', ') || 'təyin edilməyib'}`,
    messageAz: 'Biznesə aidiyyəti olan bütün şəxslər üzrə AKB çıxarışları alınmadan obyektiv qiymətləndirmə mümkün deyil.',
  }),

  unjustifiedDpd30Plus: (ctx) => ({
    triggered: ctx.unjustifiedDpd30Plus,
    observed: `Maksimum müşahidə olunan gecikmə: ${ctx.maxDpdObserved} gün`,
    messageAz: 'Bank öhdəlikləri üzrə əsaslandırılmamış 30+ gün gecikmə mövcuddur.',
  }),

  ownershipNotConfirmed: (ctx) => {
    if (ctx.ownershipEvidenceScore === null) return null;
    return {
      triggered: ctx.ownershipEvidenceScore <= 40,
      observed: `Aidiyyət balı: ${ctx.ownershipEvidenceScore} / 100 (hədd ≤ 40)`,
      messageAz:
        'Biznesin sifarişçiyə aidiyyəti sənəd və faktlarla təsdiqlənmir, yaxud dövr gəliri sifarişçinin sosial vəziyyətinə uyğun deyil.',
    };
  },

  debtToEquityOver100: (ctx) => {
    if (ctx.debtToEquityInclNew === null) return null;
    return {
      triggered: ctx.debtToEquityInclNew > 1,
      observed: `Kapitala nəzərən borclanma: ${(ctx.debtToEquityInclNew * 100).toFixed(0)}% (hədd 100%)`,
      messageAz:
        'Yeni kredit daxil olmaqla cəmi öhdəliklərin şəxsi kapitala nisbəti 100%-i keçir — kapital adekvatlığı pozulur.',
    };
  },

  repaymentCapacityNorm: (ctx) => {
    if (ctx.paymentToCapacity === null) return null;
    const breached = ctx.paymentToCapacity > 0.8;
    return {
      triggered: breached && !(ctx.sector === 'Kənd təsərrüfatı' && ctx.forecastShowsCapacity),
      observed: `Aylıq ödəniş / ödəmə qabiliyyəti: ${(ctx.paymentToCapacity * 100).toFixed(0)}% (norma ≤ 80%)`,
      messageAz:
        'Aylıq ödənişin proqnoz ödəmə qabiliyyətinə nisbəti 0.8 əmsalını keçir — ödəmə qabiliyyəti norması pozulur.',
    };
  },

  purposeNotAssessable: (ctx) => {
    if (ctx.purposeEfficiencyScore === null || ctx.purposeControlScore === null) return null;
    return {
      triggered: ctx.purposeEfficiencyScore === 0 && ctx.purposeControlScore === 0,
      observed: `Səmərəlilik: ${ctx.purposeEfficiencyScore}, nəzarət imkanı: ${ctx.purposeControlScore}`,
      messageAz:
        'Kreditin təyinatının səmərəliliyi və təyinata nəzarət imkanı eyni anda sıfırdır — təyinat qiymətləndirilə bilmir.',
    };
  },

  prescreenBureauScore: (ctx) => {
    if (ctx.bureauScore === null || ctx.preScreenThreshold === null) return null;
    return {
      triggered: ctx.bureauScore < ctx.preScreenThreshold,
      observed: `AKB skoru: ${ctx.bureauScore} (hədd ${ctx.preScreenThreshold})`,
      messageAz: 'AKB skoru ilkin süzgəc həddindən aşağıdır.',
    };
  },
};

export function evaluateStopFactors(
  rules: StopFactorRule[],
  ctx: StopFactorContext,
  now: ISODateTime = new Date().toISOString(),
): StopFactorHit[] {
  const hits: StopFactorHit[] = [];

  for (const rule of rules) {
    if (!rule.enabled) continue;
    if (!rule.applicableSegments.includes(ctx.segment)) continue;
    if (rule.applicableProducts !== 'ALL' && !rule.applicableProducts.includes(ctx.product)) continue;

    const evaluator = EVALUATORS[rule.evaluator];
    if (!evaluator) continue;

    const result = evaluator(ctx);
    if (!result) continue;

    const waivedBySector = !!rule.waivedForSectors?.includes(ctx.sector);

    hits.push({
      rule,
      triggered: result.triggered && !waivedBySector,
      observedValue: result.observed,
      severity: rule.severity,
      waivedBySector: waivedBySector && result.triggered,
      evaluatedAt: now,
      messageAz: result.messageAz,
    });
  }

  return hits;
}

export function triggeredStopFactors(hits: StopFactorHit[]): StopFactorHit[] {
  return hits.filter((h) => h.triggered);
}
