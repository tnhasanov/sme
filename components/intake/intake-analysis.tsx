'use client';

import type { CreditApplication, Customer } from '@/types/application';
import type { Assessment } from '@/services/assessment';
import { buildOpinionDraft } from '@/domain/opinion/opinion-builder';
import { UnderwriterReviewWorkspace } from '@/components/review/underwriter-review';
import { GradeChip } from '@/components/application/shared';
import { Badge, DataTable, EmptyState, Panel, SeverityBadge, Stat, Td, Th } from '@/components/ui/primitives';
import { azn, aznFull, pct, times } from '@/lib/format';
import { cn } from '@/lib/utils';

/**
 * What the underwriter sees once the analyst's file has been read.
 *
 * The order is deliberate: the headline numbers, then the reconciliations that
 * say whether those numbers can be trusted, then the human-in-the-loop review
 * where every serious finding has to be dispositioned by a person before the
 * opinion can be signed off.
 */

export function IntakeAnalysis({
  application,
  customer,
  assessment: a,
}: {
  application: CreditApplication;
  customer: Customer;
  assessment: Assessment;
}) {
  const draft = buildOpinionDraft(application, customer, a);
  const failedChecks = a.crossChecks.filter((c) => !c.passed);

  return (
    <div className="space-y-4">
      <Panel
        title="Avtomatik hazırlanmış təhlil"
        subtitle="Yüklənmiş fayldan oxunan rəqəmlər üzərində bütün hesablama, siyasət və reytinq mühərrikləri işlədilib"
        bodyClassName="py-3"
        actions={
          <span className="text-[10.5px] text-slate-500">
            {a.versions.workflowLabel} · {a.versions.policy}
          </span>
        }
      >
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-7">
          <Stat label="Müştəri" value={customer.displayName || '—'} sub={customer.sector} />
          <Stat
            label="Sifariş"
            value={aznFull(application.requestedStructure.amount)}
            sub={`${application.requestedStructure.tenorMonths} ay · ${application.requestedStructure.annualRatePct}%`}
          />
          <Stat
            label="Tövsiyə olunan"
            value={aznFull(draft.recommendation.recommendedAmount)}
            tone={
              draft.recommendation.recommendedAmount < application.requestedStructure.amount ? 'warn' : 'good'
            }
          />
          <Stat label="AKB reytinqi" value={<GradeChip grade={a.bureauRating.grade} />} />
          <Stat
            label="Yekun daxili reytinq"
            value={<GradeChip grade={a.rating.finalGrade} worst={a.rating.isWorstRating} />}
          />
          <Stat
            label="DSCR (sonra)"
            value={times(a.repayment?.dscrAfter)}
            tone={(a.repayment?.dscrAfter ?? 0) >= 1.5 ? 'good' : 'bad'}
          />
          <Stat
            label="Girov örtüyü"
            value={a.collateral.eligibleCoverage === null ? '—' : pct(a.collateral.eligibleCoverage)}
            tone={(a.collateral.eligibleCoverage ?? 0) >= 1 ? 'good' : 'warn'}
          />
        </div>

        <div className="mt-3 flex flex-wrap gap-1.5 border-t border-slate-800 pt-2.5">
          <Badge tone={a.activeStopFactors.length > 0 ? 'rose' : 'emerald'}>
            {a.activeStopFactors.length} stop faktor
          </Badge>
          <Badge tone={a.policy.breaches.length > 0 ? 'amber' : 'emerald'}>
            {a.policy.passedCount}/{a.policy.evaluatedCount} siyasət norması
          </Badge>
          <Badge tone={failedChecks.length > 0 ? 'amber' : 'emerald'}>
            {a.crossChecks.length - failedChecks.length}/{a.crossChecks.length} uzlaşma
          </Badge>
          <Badge tone={['A', 'B'].includes(a.dataQuality.grade) ? 'emerald' : 'amber'}>
            Məlumat keyfiyyəti {a.dataQuality.grade}
          </Badge>
          <Badge tone="slate">
            Aylıq ödəniş {azn(a.proposedMonthlyPayment)} · CFADS {azn(a.repayment?.cfads)}
          </Badge>
          <Badge tone="slate">Səlahiyyət: {a.routing.decisionAuthority ?? '—'}</Badge>
        </div>
      </Panel>

      {a.activeStopFactors.length > 0 && (
        <Panel
          title="Stop faktorlar"
          subtitle="Metodologiyaya görə bu hallar obyektiv qiymətləndirməni mümkünsüz edir — aradan qaldırılmadan irəli getmək olmaz"
        >
          <ul className="space-y-1.5">
            {a.activeStopFactors.map((s) => (
              <li key={s.rule.id} className="flex gap-2 text-[11.5px] leading-relaxed text-rose-200">
                <span className="mt-[6px] h-1 w-1 shrink-0 rounded-full bg-rose-400" />
                <span>
                  <strong>{s.rule.labelAz}</strong> — {s.observedValue}
                </span>
              </li>
            ))}
          </ul>
        </Panel>
      )}

      <Panel
        title="Kross-yoxlamalar"
        subtitle="Hesabatlar bir-biri ilə uzlaşırmı — uzlaşmayan rəqəm üzərində qurulan təhlil etibarsızdır"
        actions={
          <span className={cn(failedChecks.length > 0 ? 'text-amber-300' : 'text-emerald-300')}>
            {failedChecks.length} uyğunsuzluq
          </span>
        }
        bodyClassName="px-0 py-0"
      >
        {a.crossChecks.length === 0 ? (
          <div className="px-4 py-3">
            <EmptyState>
              Kross-yoxlama üçün kifayət qədər məlumat yoxdur — ən azı bir tam dövr üzrə balans və MZH tələb olunur.
            </EmptyState>
          </div>
        ) : (
          <DataTable
            className="mx-0"
            head={
              <tr>
                <Th>Yoxlama</Th>
                <Th align="right">Gözlənilən</Th>
                <Th align="right">Faktiki</Th>
                <Th align="right">Fərq</Th>
                <Th align="center">Nəticə</Th>
                <Th>Şərh</Th>
              </tr>
            }
          >
            {a.crossChecks.map((c) => (
              <tr key={c.key} className={cn(!c.passed && 'bg-amber-500/[0.03]')}>
                <Td title={c.formula}>{c.labelAz}</Td>
                <Td align="right">{azn(c.expected)}</Td>
                <Td align="right">{azn(c.actual)}</Td>
                <Td align="right" className={cn(!c.passed && 'text-amber-300')}>
                  {azn(c.difference)}
                  {c.differencePct !== null && (
                    <span className="ml-1 text-[10px] text-slate-500">({pct(c.differencePct)})</span>
                  )}
                </Td>
                <Td align="center">
                  {c.passed ? <Badge tone="emerald">uyğun</Badge> : <SeverityBadge severity={c.severity} />}
                </Td>
                <Td className="max-w-[340px] text-[10.5px] leading-snug text-slate-400">{c.interpretationAz}</Td>
              </tr>
            ))}
          </DataTable>
        )}
      </Panel>

      <UnderwriterReviewWorkspace
        applicationId={application.id}
        findings={a.findings}
        sections={draft.sections.map((s) => ({ key: s.key, titleAz: s.titleAz, paragraphs: s.paragraphs }))}
        generatedRecommendation={draft.recommendation}
        requestedAmount={application.requestedStructure.amount}
        positives={draft.positives}
        negatives={draft.negatives}
      />

      <div className="grid gap-4 xl:grid-cols-2">
        <Panel title="Müsbət tərəflər" subtitle="Key positive factors">
          {draft.positives.length === 0 ? (
            <EmptyState>Müsbət amil aşkarlanmayıb.</EmptyState>
          ) : (
            <ul className="space-y-1.5">
              {draft.positives.map((p, i) => (
                <li key={i} className="flex gap-2 text-[11.5px] leading-relaxed text-emerald-200">
                  <span className="mt-[6px] h-1 w-1 shrink-0 rounded-full bg-emerald-400" />
                  {p}
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Mənfi tərəflər" subtitle="Key negative factors">
          {draft.negatives.length === 0 ? (
            <EmptyState>Mənfi amil aşkarlanmayıb.</EmptyState>
          ) : (
            <ul className="space-y-1.5">
              {draft.negatives.map((p, i) => (
                <li key={i} className="flex gap-2 text-[11.5px] leading-relaxed text-rose-200">
                  <span className="mt-[6px] h-1 w-1 shrink-0 rounded-full bg-rose-400" />
                  {p}
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </div>
  );
}
