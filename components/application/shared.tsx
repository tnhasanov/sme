import type { ExplainedMetric, RuleOutcome, TracedValue } from '@/types/core';
import { valueOf } from '@/types/core';
import type { RatingResult } from '@/domain/rating/rating-engine';
import { GRADE_LABEL_AZ } from '@/config/rating';
import { Badge, Td } from '@/components/ui/primitives';
import {
  azn,
  EVIDENCE_CLASS,
  EVIDENCE_LABEL_AZ,
  metricValue,
  SOURCE_TYPE_LABEL_AZ,
} from '@/lib/format';
import { operatorSymbol, formatValue } from '@/domain/rules/policy-engine';
import { cn } from '@/lib/utils';

/**
 * Explainability and lineage components (§27-§28, §84).
 *
 * Built on native <details> so drill-down works without client-side state —
 * an underwriter can expand a dozen ratios at once and print the result.
 */

export function MetricExplain({
  metric,
  outcome,
  className,
}: {
  metric: ExplainedMetric | undefined;
  outcome?: RuleOutcome;
  className?: string;
}) {
  if (!metric) return <span className="text-slate-600">—</span>;

  const failed = outcome && !outcome.passed;

  return (
    <details className={cn('group', className)}>
      <summary
        className={cn(
          'flex cursor-pointer list-none items-center justify-end gap-1.5 tabular-nums',
          failed ? 'text-rose-300' : 'text-slate-200',
        )}
      >
        <span className="font-medium">{metricValue(metric)}</span>
        <span className="text-[9px] text-slate-600 transition-transform group-open:rotate-90">▶</span>
      </summary>
      <div className="mt-1.5 rounded border border-slate-800 bg-slate-950/70 p-2 text-left text-[10.5px] leading-relaxed">
        <div className="font-mono text-slate-400">{metric.formula}</div>
        <table className="mt-1.5 w-full">
          <tbody>
            {metric.inputs.map((input, i) => (
              <tr key={i}>
                <td className="py-0.5 pr-3 text-slate-500">{input.label}</td>
                <td className="py-0.5 text-right tabular-nums text-slate-300">{azn(input.value)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 border-t border-slate-800 pt-1.5 text-slate-500">
          <span>Mənbə: {metric.source}</span>
          {metric.period && <span>Dövr: {metric.period}</span>}
          {metric.lens && <span>{metric.lens === 'ADJUSTED' ? 'Düzəliş edilmiş' : 'Bəyan edilmiş'}</span>}
        </div>
        {outcome && (
          <div className={cn('mt-1.5 border-t border-slate-800 pt-1.5', failed ? 'text-rose-300' : 'text-emerald-300')}>
            Norma {operatorSymbol(outcome.operator)}{' '}
            {formatValue(outcome.threshold, unitOf(metric))} — {failed ? 'POZULUR' : 'ödənilir'}
            <div className="mt-0.5 text-slate-500">Mənbə: {outcome.source}</div>
          </div>
        )}
      </div>
    </details>
  );
}

function unitOf(metric: ExplainedMetric): 'RATIO' | 'PERCENT' | 'DAYS' | 'CURRENCY' | 'TIMES' {
  return metric.unit === 'SCORE' ? 'RATIO' : metric.unit;
}

/** A balance-sheet / P&L figure with its lineage (§28). */
export function TracedCell({
  value,
  align = 'right',
  showEvidence = true,
}: {
  value: TracedValue | undefined;
  align?: 'left' | 'right';
  showEvidence?: boolean;
}) {
  if (!value) return <Td align={align}>—</Td>;
  const adjusted = value.adjusted !== undefined && value.adjusted !== value.raw;

  return (
    <Td align={align}>
      <details className="group inline-block text-right">
        <summary className="flex cursor-pointer list-none items-center justify-end gap-1.5">
          <span className={cn('tabular-nums', adjusted ? 'text-sky-300' : 'text-slate-200')}>
            {azn(valueOf(value, 'ADJUSTED'))}
          </span>
          {showEvidence && (
            <span
              title={EVIDENCE_LABEL_AZ[value.evidence]}
              className={cn('h-1.5 w-1.5 shrink-0 rounded-full', evidenceDot(value.evidence))}
            />
          )}
        </summary>
        <div className="mt-1 w-56 rounded border border-slate-800 bg-slate-950/90 p-2 text-left text-[10px] leading-relaxed">
          <div className="flex justify-between gap-2">
            <span className="text-slate-500">Bəyan edilmiş</span>
            <span className="tabular-nums text-slate-300">{azn(value.raw)}</span>
          </div>
          {adjusted && (
            <div className="flex justify-between gap-2">
              <span className="text-slate-500">Düzəliş edilmiş</span>
              <span className="tabular-nums text-sky-300">{azn(value.adjusted!)}</span>
            </div>
          )}
          <div className="mt-1 border-t border-slate-800 pt-1">
            <span className="text-slate-500">Mənbə: </span>
            <span className="text-slate-300">{SOURCE_TYPE_LABEL_AZ[value.sourceType] ?? value.sourceType}</span>
          </div>
          <div>
            <span className="text-slate-500">Təsdiq: </span>
            <span className={cn('rounded px-1 ring-1 ring-inset', EVIDENCE_CLASS[value.evidence])}>
              {EVIDENCE_LABEL_AZ[value.evidence]}
            </span>
          </div>
          {value.documentRef && <div className="text-slate-500">Sənəd: {value.documentRef}</div>}
          {value.modificationReason && (
            <div className="mt-1 border-t border-slate-800 pt-1 text-slate-400">{value.modificationReason}</div>
          )}
        </div>
      </details>
    </Td>
  );
}

function evidenceDot(evidence: string): string {
  switch (evidence) {
    case 'VERIFIED':
      return 'bg-emerald-400';
    case 'PARTIALLY_VERIFIED':
      return 'bg-lime-400';
    case 'VERBAL':
      return 'bg-amber-400';
    case 'ANALYST_ESTIMATE':
      return 'bg-sky-400';
    case 'MISSING':
    case 'CONTRADICTORY':
      return 'bg-rose-400';
    default:
      return 'bg-slate-600';
  }
}

/** Rating waterfall (§82). */
export function RatingWaterfall({ rating }: { rating: RatingResult }) {
  return (
    <div className="space-y-1">
      {rating.steps.map((step, i) => {
        const isFinal = step.key === 'FINAL';
        const tone =
          step.notch < 0 ? 'text-rose-300' : step.notch > 0 ? 'text-emerald-300' : 'text-slate-400';
        return (
          <details key={`${step.key}-${i}`} className="group rounded border border-slate-800 bg-slate-950/40">
            <summary className="flex cursor-pointer list-none items-center gap-3 px-3 py-1.5">
              <span className="w-44 shrink-0 text-[11px] text-slate-400">{step.labelAz}</span>
              <span className={cn('w-14 shrink-0 text-[11px] tabular-nums', tone)}>
                {step.notch === 0 ? '—' : `${step.notch > 0 ? '+' : ''}${step.notch} pillə`}
              </span>
              <span className="flex min-w-0 flex-1 items-center gap-2 text-[11.5px]">
                {step.gradeBefore && !isFinal && (
                  <>
                    <span className="text-slate-500">{GRADE_LABEL_AZ[step.gradeBefore]}</span>
                    <span className="text-slate-700">→</span>
                  </>
                )}
                <span className={cn('font-medium', isFinal ? 'text-sky-300' : 'text-slate-100')}>
                  {step.gradeAfter ? GRADE_LABEL_AZ[step.gradeAfter] : '—'}
                </span>
              </span>
              <span className="shrink-0 text-[9px] text-slate-600 transition-transform group-open:rotate-90">▶</span>
            </summary>
            <div className="border-t border-slate-800 px-3 py-2 text-[10.5px] leading-relaxed text-slate-400">
              {step.reasonAz}
            </div>
          </details>
        );
      })}
    </div>
  );
}

export function GradeChip({ grade, worst }: { grade: string | null; worst?: boolean }) {
  if (!grade) return <Badge tone="slate">Təyin edilməyib</Badge>;
  const tone =
    grade === 'EXCELLENT'
      ? 'emerald'
      : grade === 'GOOD'
        ? 'lime'
        : grade === 'MEDIUM'
          ? 'amber'
          : grade === 'SATISFACTORY'
            ? 'orange'
            : 'rose';
  return (
    <Badge tone={tone as never}>
      {GRADE_LABEL_AZ[grade as keyof typeof GRADE_LABEL_AZ] ?? grade}
      {worst ? ' · ən zəif' : ''}
    </Badge>
  );
}
