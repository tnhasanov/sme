import { notFound } from 'next/navigation';
import { getCase } from '@/services/application-service';
import { buildOpinionDraft } from '@/domain/opinion/opinion-builder';
import { UnderwriterReviewWorkspace } from '@/components/review/underwriter-review';
import { COVENANT_TEMPLATES } from '@/config/policy';
import {
  Badge,
  DataTable,
  EmptyState,
  KeyValue,
  Panel,
  SeverityBadge,
  Stat,
  Td,
  Th,
} from '@/components/ui/primitives';
import { GradeChip } from '@/components/application/shared';
import { aznFull, DECISION_LABEL_AZ, pct, RISK_CATEGORY_LABEL_AZ, times } from '@/lib/format';

/** Underwriting opinion, risks & mitigants, covenants and conditions (§56-§60). */
export default async function OpinionPage({ params }: { params: { id: string } }) {
  const c = await getCase(params.id);
  if (!c) notFound();
  const { application: app, customer, assessment: a } = c;
  const draft = buildOpinionDraft(app, customer, a);

  const suggestedCovenants = COVENANT_TEMPLATES.filter((t) =>
    ['DEBT_TO_EBITDA', 'DSCR', 'EQUITY_TO_ASSETS', 'ADDITIONAL_DEBT_RESTRICTION', 'COLLATERAL_COVERAGE'].includes(
      t.key,
    ),
  );

  return (
    <div className="space-y-4">
      <Panel
        title="İcraçı kredit xülasəsi"
        subtitle="Komitə üçün bir ekranlıq xülasə — case 2 dəqiqədə başa düşülməlidir (§60)"
        bodyClassName="py-3"
      >
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-7">
          <Stat label="Müştəri" value={customer.displayName} sub={customer.sector} />
          <Stat
            label="Sifariş"
            value={aznFull(app.requestedStructure.amount)}
            sub={`${app.requestedStructure.tenorMonths} ay · ${app.requestedStructure.annualRatePct}%`}
          />
          <Stat
            label="Tövsiyə olunan"
            value={aznFull(draft.recommendation.recommendedAmount)}
            tone={draft.recommendation.recommendedAmount < app.requestedStructure.amount ? 'warn' : 'good'}
          />
          <Stat label="AKB reytinqi" value={<GradeChip grade={a.bureauRating.grade} />} />
          <Stat
            label="Yekun daxili reytinq"
            value={<GradeChip grade={a.rating.finalGrade} worst={a.rating.isWorstRating} />}
          />
          <Stat label="DSCR" value={times(a.repayment?.dscrAfter)} />
          <Stat
            label="Girov örtüyü"
            value={a.collateral.eligibleCoverage === null ? '—' : pct(a.collateral.eligibleCoverage)}
          />
        </div>
      </Panel>

      <UnderwriterReviewWorkspace
        applicationId={app.id}
        findings={a.findings}
        sections={draft.sections.map((s) => ({
          key: s.key,
          titleAz: s.titleAz,
          paragraphs: s.paragraphs,
        }))}
        generatedRecommendation={draft.recommendation}
        requestedAmount={app.requestedStructure.amount}
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

      <Panel
        title="Anderraytinq tövsiyəsi"
        subtitle="Hesablanmış məlumat əsasında deterministik ilkin layihə — analitik redaktə edə bilər"
      >
        <div className="mb-3 flex flex-wrap items-center gap-3">
          <Badge
            tone={
              draft.recommendation.decision === 'DECLINE'
                ? 'rose'
                : draft.recommendation.decision === 'APPROVE'
                  ? 'emerald'
                  : 'amber'
            }
          >
            {DECISION_LABEL_AZ[draft.recommendation.decision]}
          </Badge>
          <span className="text-[12px] text-slate-300">
            Tövsiyə olunan məbləğ: <strong>{aznFull(draft.recommendation.recommendedAmount)}</strong>
          </span>
        </div>
        <ul className="space-y-1.5">
          {draft.recommendation.rationale.map((r, i) => (
            <li key={i} className="text-[12px] leading-relaxed text-slate-300">
              {r}
            </li>
          ))}
        </ul>

        {app.underwriterRecommendation && (
          <div className="mt-3 rounded border border-sky-500/20 bg-sky-500/5 px-3 py-2">
            <div className="mb-1 text-[10px] uppercase tracking-wide text-slate-500">
              Anderrayterin qeyd etdiyi tövsiyə
            </div>
            <div className="mb-1 flex items-center gap-2">
              <Badge tone="sky">{DECISION_LABEL_AZ[app.underwriterRecommendation.decision]}</Badge>
              <span className="text-[11.5px] text-slate-300">
                {aznFull(app.underwriterRecommendation.recommendedAmount)}
              </span>
            </div>
            <p className="text-[11.5px] leading-relaxed text-slate-300">
              {app.underwriterRecommendation.narrative}
            </p>
            <div className="mt-1 text-[10px] text-slate-500">
              {app.underwriterRecommendation.preparedBy} · {app.underwriterRecommendation.preparedAt}
            </div>
          </div>
        )}
      </Panel>

      <Panel
        title="Strukturlaşdırılmış rəy"
        subtitle="21 bölmədən ibarət standart struktur (§59)"
        bodyClassName="px-0 py-0"
      >
        <div className="divide-y divide-slate-800">
          {draft.sections.map((section, i) => (
            <details key={section.key} open={i < 3} className="group">
              <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-2 hover:bg-slate-900/40">
                <span className="w-6 shrink-0 text-[10px] tabular-nums text-slate-600">{i + 1}.</span>
                <span className="flex-1 text-[12px] font-medium text-slate-100">{section.titleAz}</span>
                <span className="text-[10px] text-slate-600">{section.titleEn}</span>
                <span className="text-[9px] text-slate-600 transition-transform group-open:rotate-90">▶</span>
              </summary>
              <div className="space-y-2 px-4 pb-3 pl-12">
                {section.paragraphs.map((p, j) => (
                  <p key={j} className="text-[11.5px] leading-relaxed text-slate-300">
                    {p}
                  </p>
                ))}
                {section.bullets && section.bullets.length > 0 && (
                  <ul className="space-y-1 pt-1">
                    {section.bullets.map((b, j) => (
                      <li key={j} className="flex gap-2 text-[11px] leading-relaxed text-slate-400">
                        <span className="mt-[6px] h-1 w-1 shrink-0 rounded-full bg-slate-600" />
                        {b}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </details>
          ))}
        </div>
      </Panel>

      <Panel title="Əsas risklər və mitiqantlar" subtitle="Key risks & mitigants (§56)" bodyClassName="px-0 py-0">
        {app.riskMitigants.length === 0 ? (
          <div className="px-4 py-3">
            <EmptyState>Risk-mitiqant cədvəli hələ doldurulmayıb.</EmptyState>
          </div>
        ) : (
          <DataTable
            className="mx-0"
            head={
              <tr>
                <Th>Risk kateqoriyası</Th>
                <Th align="center">Səviyyə</Th>
                <Th>Təsvir</Th>
                <Th>Mitiqant</Th>
                <Th align="center">Qalıq risk</Th>
              </tr>
            }
          >
            {app.riskMitigants.map((r) => (
              <tr key={r.id}>
                <Td>{RISK_CATEGORY_LABEL_AZ[r.category]}</Td>
                <Td align="center">
                  <SeverityBadge severity={r.severity} />
                </Td>
                <Td className="max-w-[320px] leading-relaxed">{r.description}</Td>
                <Td className="max-w-[320px] leading-relaxed text-emerald-200">{r.mitigant}</Td>
                <Td align="center">
                  <SeverityBadge severity={r.residualRisk} />
                </Td>
              </tr>
            ))}
          </DataTable>
        )}
      </Panel>

      <div className="grid gap-4 xl:grid-cols-2">
        <Panel title="Kovenantlar" subtitle="Şablon əsasında təklif olunan öhdəliklər (§57)" bodyClassName="px-0 py-0">
          <DataTable
            className="mx-0"
            head={
              <tr>
                <Th>Kovenant</Th>
                <Th align="right">Hədd</Th>
                <Th>Tezlik</Th>
                <Th>Pozuntu halında</Th>
              </tr>
            }
          >
            {(app.covenants.length > 0
              ? app.covenants.map((cv) => ({
                  key: cv.id,
                  label: cv.label,
                  operator: cv.operator,
                  threshold: cv.threshold,
                  frequency: cv.testFrequency,
                  action: cv.breachAction,
                }))
              : suggestedCovenants.map((t) => ({
                  key: t.key,
                  label: t.labelAz,
                  operator: t.operator,
                  threshold: t.defaultThreshold,
                  frequency: t.defaultFrequency,
                  action: t.breachAction,
                }))
            ).map((cv) => (
              <tr key={cv.key}>
                <Td>{cv.label}</Td>
                <Td align="right">
                  {cv.operator === 'GTE' ? '≥' : '≤'} {cv.threshold}
                </Td>
                <Td>{cv.frequency}</Td>
                <Td className="max-w-[220px] text-[10.5px] leading-snug text-slate-400">{cv.action}</Td>
              </tr>
            ))}
          </DataTable>
          {app.covenants.length === 0 && (
            <div className="border-t border-slate-800 px-4 py-2 text-[10.5px] text-slate-500">
              Şablon dəyərləri göstərilir — komitə qərarında dəqiqləşdirilməlidir.
            </div>
          )}
        </Panel>

        <Panel title="Şərtlər" subtitle="Conditions precedent / subsequent (§58)">
          <div className="mb-1.5 text-[10px] uppercase tracking-wide text-slate-500">
            Ödənişdən əvvəlki şərtlər (Conditions Precedent)
          </div>
          {draft.recommendation.conditions.length === 0 ? (
            <EmptyState>Əlavə şərt tələb olunmur.</EmptyState>
          ) : (
            <ul className="space-y-1.5">
              {draft.recommendation.conditions.map((cond, i) => (
                <li key={i} className="flex gap-2 text-[11.5px] leading-relaxed text-slate-300">
                  <span className="mt-[6px] h-1 w-1 shrink-0 rounded-full bg-amber-400" />
                  {cond}
                </li>
              ))}
            </ul>
          )}

          <div className="mb-1.5 mt-4 text-[10px] uppercase tracking-wide text-slate-500">
            Ödənişdən sonrakı şərtlər (Conditions Subsequent)
          </div>
          <ul className="space-y-1.5">
            {[
              'Rüblük maliyyə hesabatlarının təqdim edilməsi.',
              'İllik bank dövriyyəsi öhdəliyinin yerinə yetirilməsi.',
              'Kovenantların rüblük yoxlanılması.',
              'Girovun illik yenidən qiymətləndirilməsi və sığortanın yenilənməsi.',
            ].map((cond, i) => (
              <li key={i} className="flex gap-2 text-[11.5px] leading-relaxed text-slate-300">
                <span className="mt-[6px] h-1 w-1 shrink-0 rounded-full bg-sky-400" />
                {cond}
              </li>
            ))}
          </ul>

          {app.conditions.length > 0 && (
            <div className="mt-4 border-t border-slate-800 pt-2">
              <KeyValue
                items={app.conditions.map((cond) => ({
                  label: cond.label,
                  value: `${cond.status} · ${cond.responsible}`,
                }))}
              />
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}
