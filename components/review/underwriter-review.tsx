'use client';

import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Loader2, RotateCcw } from 'lucide-react';
import type { Decision, Finding } from '@/types/application';
import {
  DISPOSITION_LABEL_AZ,
  DISPOSITION_TONE,
  FINDING_DISPOSITIONS,
  type FindingDisposition,
  type UnderwriterReview,
  emptyReview,
  reviewProgress,
} from '@/domain/review/types';
import { clearReview, loadReview, saveReview, withFindingReview } from '@/lib/review-store';
import { Badge, EmptyState, Panel, ProgressBar, SeverityBadge } from '@/components/ui/primitives';
import { DECISION_LABEL_AZ, FINDING_CATEGORY_LABEL_AZ, aznFull, dateTimeAz } from '@/lib/format';
import { cn } from '@/lib/utils';

/**
 * Human-in-the-loop review workspace.
 *
 * The machine's draft is on the left of every row and the underwriter's
 * judgement on the right. Sign-off is blocked until every critical and
 * high-severity finding has been dispositioned by a person — the point of the
 * workflow is that nobody can wave through a case by not reading it.
 */

export interface OpinionSectionSummary {
  key: string;
  titleAz: string;
  paragraphs: string[];
}

export interface UnderwriterReviewProps {
  applicationId: string;
  findings: Finding[];
  sections: OpinionSectionSummary[];
  generatedRecommendation: {
    decision: Decision;
    recommendedAmount: number;
    rationale: string[];
    conditions: string[];
  };
  requestedAmount: number;
  positives: string[];
  negatives: string[];
}

const DECISIONS: Decision[] = [
  'APPROVE',
  'APPROVE_WITH_CONDITIONS',
  'DECLINE',
  'RETURN_FOR_INFORMATION',
  'ESCALATE',
];

export function UnderwriterReviewWorkspace(props: UnderwriterReviewProps) {
  const { applicationId, findings, sections, generatedRecommendation, requestedAmount } = props;

  const [review, setReview] = useState<UnderwriterReview>(() =>
    emptyReview(applicationId, new Date().toISOString()),
  );
  const [hydrated, setHydrated] = useState(false);

  // Load once on the client so the server render stays deterministic.
  useEffect(() => {
    setReview(loadReview(applicationId));
    setHydrated(true);
  }, [applicationId]);

  useEffect(() => {
    if (hydrated) saveReview(review);
  }, [review, hydrated]);

  const priority = useMemo(
    () => findings.filter((f) => f.severity === 'CRITICAL' || f.severity === 'HIGH'),
    [findings],
  );
  const secondary = useMemo(
    () => findings.filter((f) => f.severity !== 'CRITICAL' && f.severity !== 'HIGH'),
    [findings],
  );

  const progress = useMemo(() => reviewProgress(findings, review), [findings, review]);

  const update = (patch: Partial<UnderwriterReview>) =>
    setReview((r) => ({ ...r, ...patch, updatedAt: new Date().toISOString() }));

  const setFinding = (
    id: string,
    patch: { disposition?: FindingDisposition; note?: string; mitigant?: string },
  ) => setReview((r) => withFindingReview(r, id, patch));

  const effectiveDecision = review.recommendationOverride?.decision ?? generatedRecommendation.decision;
  const effectiveAmount =
    review.recommendationOverride?.recommendedAmount ?? generatedRecommendation.recommendedAmount;

  if (!hydrated) {
    return (
      <Panel title="Anderrayter nəzərdən keçirməsi">
        <div className="flex items-center gap-2 py-6 text-[12px] text-slate-400">
          <Loader2 className="h-4 w-4 animate-spin" /> Qeydlər yüklənir…
        </div>
      </Panel>
    );
  }

  return (
    <div className="space-y-4">
      {/* ---------- Progress / sign-off ---------- */}
      <Panel
        title="Anderrayter nəzərdən keçirməsi"
        subtitle="Sistem layihəni hazırlayır — qərar anderraytere aiddir. Hər kritik və yüksək tapıntı insan tərəfindən qiymətləndirilməlidir."
        actions={
          review.signedOffAt ? (
            <Badge tone="emerald">Təsdiqlənib</Badge>
          ) : (
            <Badge tone={progress.canSignOff ? 'lime' : 'amber'}>
              {progress.reviewed} / {progress.total} baxılıb
            </Badge>
          )
        }
      >
        <ProgressBar
          value={progress.total === 0 ? 1 : progress.reviewed / progress.total}
          tone={progress.canSignOff ? 'emerald' : 'amber'}
        />

        <div className="mt-3 grid gap-3 md:grid-cols-[minmax(0,1fr)_260px]">
          <div>
            <label className="mb-1 block text-[10px] uppercase tracking-wide text-slate-500">
              Anderrayterin ümumi qeydi
            </label>
            <textarea
              value={review.overallNote}
              onChange={(e) => update({ overallNote: e.target.value })}
              rows={4}
              placeholder="Sistemin hazırladığı təhlilə əlavə şərhinizi buraya yazın — bu mətn yekun rəyə əlavə olunur."
              className="w-full resize-y rounded border border-slate-700 bg-slate-950/60 px-2.5 py-2 text-[12px] leading-relaxed text-slate-200 outline-none placeholder:text-slate-600 focus:border-sky-600"
            />
          </div>

          <div className="space-y-2">
            <div>
              <label className="mb-1 block text-[10px] uppercase tracking-wide text-slate-500">
                Rəyi verən əməkdaş
              </label>
              <input
                value={review.underwriterName}
                onChange={(e) => update({ underwriterName: e.target.value })}
                placeholder="Ad, Soyad"
                className="w-full rounded border border-slate-700 bg-slate-950/60 px-2.5 py-1.5 text-[12px] text-slate-200 outline-none placeholder:text-slate-600 focus:border-sky-600"
              />
            </div>

            {review.signedOffAt ? (
              <div className="rounded border border-emerald-500/30 bg-emerald-500/5 px-2.5 py-2 text-[11px] text-emerald-200">
                <div className="flex items-center gap-1.5 font-medium">
                  <CheckCircle2 className="h-3.5 w-3.5" /> Rəy təsdiqlənib
                </div>
                <div className="mt-0.5 text-emerald-300/80">
                  {review.underwriterName || '—'} · {dateTimeAz(review.signedOffAt)}
                </div>
                <button
                  onClick={() => update({ signedOffAt: undefined })}
                  className="mt-1.5 text-[10.5px] text-slate-400 underline underline-offset-2 hover:text-slate-200"
                >
                  Təsdiqi geri al
                </button>
              </div>
            ) : (
              <>
                <button
                  disabled={!progress.canSignOff}
                  onClick={() => update({ signedOffAt: new Date().toISOString() })}
                  className={cn(
                    'w-full rounded px-3 py-2 text-[12px] font-medium transition-colors',
                    progress.canSignOff
                      ? 'bg-sky-600 text-white hover:bg-sky-500'
                      : 'cursor-not-allowed bg-slate-800 text-slate-500',
                  )}
                >
                  Rəyi təsdiqlə
                </button>
                {progress.blockingReasonAz && (
                  <p className="text-[10.5px] leading-snug text-amber-300">{progress.blockingReasonAz}</p>
                )}
              </>
            )}

            <button
              onClick={() => {
                clearReview(applicationId);
                setReview(emptyReview(applicationId, new Date().toISOString()));
              }}
              className="flex w-full items-center justify-center gap-1.5 rounded border border-slate-800 px-3 py-1.5 text-[10.5px] text-slate-500 transition-colors hover:border-slate-700 hover:text-slate-300"
            >
              <RotateCcw className="h-3 w-3" /> Qeydləri sıfırla
            </button>
          </div>
        </div>
      </Panel>

      {/* ---------- Priority findings ---------- */}
      <Panel
        title="Əsas problemlər"
        subtitle="Hər biri üzrə qərar verilməlidir — sistem yalnız aşkarlayır, qiymətləndirmə insana aiddir"
        actions={<span>{priority.length} kritik və yüksək</span>}
        bodyClassName="px-0 py-0"
      >
        {priority.length === 0 ? (
          <div className="px-4 py-3">
            <EmptyState>Kritik və ya yüksək səviyyəli problem aşkarlanmayıb.</EmptyState>
          </div>
        ) : (
          <ul className="divide-y divide-slate-800">
            {priority.map((f) => {
              const r = review.findings[f.id];
              const disposition = r?.disposition ?? 'OPEN';
              return (
                <li key={f.id} className={cn('px-4 py-3', disposition === 'OPEN' && 'bg-amber-500/[0.03]')}>
                  <div className="grid gap-3 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
                    {/* Machine side */}
                    <div className="min-w-0">
                      <div className="mb-1 flex flex-wrap items-center gap-1.5">
                        <SeverityBadge severity={f.severity} />
                        <span className="text-[10px] uppercase tracking-wide text-slate-500">
                          {FINDING_CATEGORY_LABEL_AZ[f.category]}
                        </span>
                        <Badge tone="slate">avtomatik</Badge>
                      </div>
                      <div className="text-[12.5px] font-medium text-slate-100">{f.title}</div>
                      <p className="mt-1 text-[11.5px] leading-relaxed text-slate-400">{f.description}</p>
                      <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-0.5 text-[10px] text-slate-500">
                        {f.observedValue && <span>Müşahidə: {f.observedValue}</span>}
                        {f.expectedValue && <span>Gözlənilən: {f.expectedValue}</span>}
                        {f.financialImpact !== undefined && <span>Təsir: {aznFull(f.financialImpact)}</span>}
                      </div>
                      <div className="mt-1 text-[10px] text-slate-600">Mənbə: {f.source}</div>
                    </div>

                    {/* Human side */}
                    <div className="min-w-0 rounded border border-slate-800 bg-slate-950/40 p-2.5">
                      <div className="mb-1.5 flex flex-wrap gap-1">
                        {FINDING_DISPOSITIONS.map((d) => (
                          <button
                            key={d}
                            onClick={() => setFinding(f.id, { disposition: d })}
                            className={cn(
                              'rounded px-1.5 py-0.5 text-[10px] ring-1 ring-inset transition-colors',
                              disposition === d
                                ? toneClass(DISPOSITION_TONE[d])
                                : 'text-slate-500 ring-slate-800 hover:text-slate-300',
                            )}
                          >
                            {DISPOSITION_LABEL_AZ[d]}
                          </button>
                        ))}
                      </div>

                      <textarea
                        value={r?.note ?? ''}
                        onChange={(e) => setFinding(f.id, { note: e.target.value })}
                        rows={2}
                        placeholder="Anderrayter qeydi — bu tapıntı ilə bağlı şərhiniz"
                        className="mb-1.5 w-full resize-y rounded border border-slate-800 bg-slate-950/70 px-2 py-1.5 text-[11px] leading-relaxed text-slate-200 outline-none placeholder:text-slate-600 focus:border-sky-700"
                      />
                      <input
                        value={r?.mitigant ?? ''}
                        onChange={(e) => setFinding(f.id, { mitigant: e.target.value })}
                        placeholder="Mitiqant / şərt (varsa)"
                        className="w-full rounded border border-slate-800 bg-slate-950/70 px-2 py-1.5 text-[11px] text-slate-200 outline-none placeholder:text-slate-600 focus:border-sky-700"
                      />
                      {r?.updatedAt && (
                        <div className="mt-1 text-[9.5px] text-slate-600">Yeniləndi: {dateTimeAz(r.updatedAt)}</div>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Panel>

      {/* ---------- Secondary findings ---------- */}
      {secondary.length > 0 && (
        <Panel
          title="Digər tapıntılar"
          subtitle="Təsdiq üçün məcburi deyil, lakin qeyd əlavə edilə bilər"
          bodyClassName="px-0 py-0"
        >
          <ul className="divide-y divide-slate-800/70">
            {secondary.map((f) => {
              const r = review.findings[f.id];
              return (
                <li key={f.id} className="flex flex-wrap items-start gap-3 px-4 py-2">
                  <SeverityBadge severity={f.severity} />
                  <div className="min-w-[220px] flex-1">
                    <div className="text-[11.5px] text-slate-200">{f.title}</div>
                    <div className="text-[10.5px] text-slate-500">{f.description}</div>
                  </div>
                  <input
                    value={r?.note ?? ''}
                    onChange={(e) => setFinding(f.id, { note: e.target.value })}
                    placeholder="Qeyd"
                    className="w-[260px] rounded border border-slate-800 bg-slate-950/70 px-2 py-1 text-[11px] text-slate-200 outline-none placeholder:text-slate-600 focus:border-sky-700"
                  />
                </li>
              );
            })}
          </ul>
        </Panel>
      )}

      {/* ---------- Recommendation ---------- */}
      <Panel
        title="Tövsiyə"
        subtitle="Sistemin hesabladığı tövsiyə saxlanılır; anderrayter onu dəyişdirə bilər və səbəbi qeyd olunur"
      >
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded border border-slate-800 bg-slate-950/40 p-3">
            <div className="mb-1.5 text-[10px] uppercase tracking-wide text-slate-500">Sistem tövsiyəsi</div>
            <div className="mb-1 flex items-center gap-2">
              <Badge
                tone={
                  generatedRecommendation.decision === 'DECLINE'
                    ? 'rose'
                    : generatedRecommendation.decision === 'APPROVE'
                      ? 'emerald'
                      : 'amber'
                }
              >
                {DECISION_LABEL_AZ[generatedRecommendation.decision]}
              </Badge>
              <span className="text-[12px] text-slate-200">
                {aznFull(generatedRecommendation.recommendedAmount)}
              </span>
              <span className="text-[10.5px] text-slate-500">
                (sifariş {aznFull(requestedAmount)})
              </span>
            </div>
            <ul className="space-y-1">
              {generatedRecommendation.rationale.map((x, i) => (
                <li key={i} className="text-[11px] leading-relaxed text-slate-400">
                  {x}
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded border border-sky-500/20 bg-sky-500/[0.04] p-3">
            <div className="mb-1.5 text-[10px] uppercase tracking-wide text-slate-500">Anderrayter qərarı</div>
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <select
                value={effectiveDecision}
                onChange={(e) =>
                  update({
                    recommendationOverride: {
                      decision: e.target.value as Decision,
                      recommendedAmount: effectiveAmount,
                      rationale: review.recommendationOverride?.rationale ?? '',
                    },
                  })
                }
                className="rounded border border-slate-700 bg-slate-950/70 px-2 py-1 text-[11.5px] text-slate-200 outline-none focus:border-sky-600"
              >
                {DECISIONS.map((d) => (
                  <option key={d} value={d}>
                    {DECISION_LABEL_AZ[d]}
                  </option>
                ))}
              </select>
              <input
                type="number"
                value={effectiveAmount}
                onChange={(e) =>
                  update({
                    recommendationOverride: {
                      decision: effectiveDecision,
                      recommendedAmount: Number(e.target.value),
                      rationale: review.recommendationOverride?.rationale ?? '',
                    },
                  })
                }
                className="w-36 rounded border border-slate-700 bg-slate-950/70 px-2 py-1 text-right text-[11.5px] tabular-nums text-slate-200 outline-none focus:border-sky-600"
              />
              <span className="text-[11px] text-slate-500">AZN</span>
            </div>
            <textarea
              value={review.recommendationOverride?.rationale ?? ''}
              onChange={(e) =>
                update({
                  recommendationOverride: {
                    decision: effectiveDecision,
                    recommendedAmount: effectiveAmount,
                    rationale: e.target.value,
                  },
                })
              }
              rows={3}
              placeholder="Qərarın əsaslandırılması (məcburidir, əgər sistem tövsiyəsindən fərqlənirsə)"
              className="w-full resize-y rounded border border-slate-700 bg-slate-950/60 px-2 py-1.5 text-[11.5px] leading-relaxed text-slate-200 outline-none placeholder:text-slate-600 focus:border-sky-600"
            />
            {review.recommendationOverride &&
              review.recommendationOverride.decision !== generatedRecommendation.decision &&
              !review.recommendationOverride.rationale.trim() && (
                <p className="mt-1 text-[10.5px] text-amber-300">
                  Sistem tövsiyəsindən fərqli qərar üçün əsaslandırma tələb olunur.
                </p>
              )}
          </div>
        </div>

        {generatedRecommendation.conditions.length > 0 && (
          <div className="mt-3 border-t border-slate-800 pt-2">
            <div className="mb-1 text-[10px] uppercase tracking-wide text-slate-500">Təklif olunan şərtlər</div>
            <ul className="space-y-1">
              {generatedRecommendation.conditions.map((c, i) => (
                <li key={i} className="flex gap-2 text-[11.5px] leading-relaxed text-slate-300">
                  <span className="mt-[6px] h-1 w-1 shrink-0 rounded-full bg-amber-400" />
                  {c}
                </li>
              ))}
            </ul>
          </div>
        )}
      </Panel>

      {/* ---------- Section notes ---------- */}
      <Panel
        title="Rəy bölmələri üzrə qeydlər"
        subtitle="Sistem mətni dəyişdirilmir — sizin şərhiniz onun yanına əlavə olunur"
        bodyClassName="px-0 py-0"
      >
        <div className="divide-y divide-slate-800">
          {sections.map((s, i) => (
            <details key={s.key} open={i < 2} className="group">
              <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-2 hover:bg-slate-900/40">
                <span className="w-6 shrink-0 text-[10px] tabular-nums text-slate-600">{i + 1}.</span>
                <span className="flex-1 text-[12px] font-medium text-slate-100">{s.titleAz}</span>
                {review.sectionNotes[s.key]?.trim() && <Badge tone="sky">qeyd var</Badge>}
                <span className="text-[9px] text-slate-600 transition-transform group-open:rotate-90">▶</span>
              </summary>
              <div className="grid gap-3 px-4 pb-3 pl-12 lg:grid-cols-2">
                <div className="space-y-1.5">
                  {s.paragraphs.map((p, j) => (
                    <p key={j} className="text-[11.5px] leading-relaxed text-slate-400">
                      {p}
                    </p>
                  ))}
                </div>
                <textarea
                  value={review.sectionNotes[s.key] ?? ''}
                  onChange={(e) =>
                    update({ sectionNotes: { ...review.sectionNotes, [s.key]: e.target.value } })
                  }
                  rows={4}
                  placeholder="Bu bölmə üzrə anderrayter qeydi"
                  className="w-full resize-y rounded border border-slate-800 bg-slate-950/70 px-2 py-1.5 text-[11.5px] leading-relaxed text-slate-200 outline-none placeholder:text-slate-600 focus:border-sky-700"
                />
              </div>
            </details>
          ))}
        </div>
      </Panel>
    </div>
  );
}

function toneClass(tone: string): string {
  const map: Record<string, string> = {
    slate: 'bg-slate-500/15 text-slate-200 ring-slate-500/40',
    amber: 'bg-amber-500/15 text-amber-300 ring-amber-500/40',
    lime: 'bg-lime-500/15 text-lime-300 ring-lime-500/40',
    emerald: 'bg-emerald-500/15 text-emerald-300 ring-emerald-500/40',
    violet: 'bg-violet-500/15 text-violet-300 ring-violet-500/40',
    rose: 'bg-rose-500/15 text-rose-300 ring-rose-500/40',
  };
  return map[tone] ?? map.slate;
}
