import { Fragment } from 'react';
import { notFound } from 'next/navigation';
import { getCase } from '@/services/application-service';
import {
  Badge,
  DataTable,
  EmptyState,
  KeyValue,
  Panel,
  ProgressBar,
  SectionTitle,
  Stat,
  StatusBadge,
  Td,
  Th,
} from '@/components/ui/primitives';
import { GradeChip, RatingWaterfall } from '@/components/application/shared';
import { BUSINESS_SCORECARD_PROMETEIA_V1, LEGACY_SCORECARD_V1 } from '@/config/scorecards';
import { NOTCHING_PROMETEIA_V1, SEGMENTATION_PROMETEIA_V1 } from '@/config/rating';
import { aznFull, pct } from '@/lib/format';

/**
 * Risk rating (§41-§46) and the legacy expert assessment (§40).
 *
 * The two engines are shown side by side but never merged: the Yekun Rəy is
 * ATB's current expert opinion, the waterfall is Prometeia's proposed
 * internal rating, and they answer different questions.
 */
export default async function RatingPage({ params }: { params: { id: string } }) {
  const c = await getCase(params.id);
  if (!c) notFound();
  const { assessment: a } = c;
  const legacy = a.legacy;

  return (
    <div className="space-y-4">
      <Panel bodyClassName="py-3">
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-6">
          <Stat label="AKB skoru" value={a.bureauRating.score ?? '—'} sub={a.bureauRating.bandLabel} />
          <Stat label="İlkin reytinq" value={<GradeChip grade={a.rating.initialGrade} />} />
          <Stat
            label="Biznes təhlili"
            value={`${a.rating.business.totalScore.toFixed(2)} / 9`}
            sub={a.rating.business.riskBandLabelAz}
          />
          <Stat
            label="Altman Z"
            value={a.altman?.z !== null && a.altman?.z !== undefined ? a.altman.z.toFixed(2) : '—'}
            sub={a.altman?.zoneLabelAz}
          />
          <Stat
            label="Yekun daxili reytinq"
            value={<GradeChip grade={a.rating.finalGrade} worst={a.rating.isWorstRating} />}
            sub={`Düzəliş: ${a.rating.totalNotch} pillə`}
          />
          <Stat
            label="Yekun Rəy (As-Is)"
            value={`${legacy.totalScore.toFixed(2)} / 100`}
            sub={legacy.bandLabelAz}
            tone={legacy.globalStopTriggered ? 'bad' : 'default'}
          />
        </div>
      </Panel>

      <div className="grid gap-4 xl:grid-cols-2">
        <Panel
          title="Reytinq şəlaləsi"
          subtitle="AKB reytinqi → biznes düzəlişi → maliyyə düzəlişi → yekun daxili reytinq"
          actions={<StatusBadge status="PROMETEIA_PROPOSED" />}
        >
          <RatingWaterfall rating={a.rating} />
          <div className="mt-3 border-t border-slate-800 pt-2">
            <KeyValue
              items={[
                { label: 'Seqment', value: a.rating.segment === 'MEDIUM' ? 'Orta (İri)' : 'Kiçik' },
                { label: 'Seqment əsası', value: a.rating.segmentReasonAz },
                {
                  label: 'Seqment həddi',
                  value: `${aznFull(SEGMENTATION_PROMETEIA_V1.mediumThresholdAzn)} — post-əməliyyat qrup ekspozisiyası`,
                },
                {
                  label: 'Kumulyativ düzəliş limiti',
                  value: `${NOTCHING_PROMETEIA_V1.maxTotalDowngrade} … +${NOTCHING_PROMETEIA_V1.maxTotalUpgrade} pillə`,
                },
                { label: 'Skorkart versiyası', value: a.rating.scorecardVersion },
                { label: 'İcra vaxtı', value: a.rating.executedAt },
              ]}
            />
          </div>
          {a.rating.overrideApplied && (
            <div className="mt-3 rounded border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-[11px] text-amber-200">
              Əl ilə override tətbiq edilib. Hesablanmış reytinq saxlanılır və audit izində görünür (§53-§54).
            </div>
          )}
        </Panel>

        <Panel
          title="Biznes təhlili qiymətləndirməsi"
          subtitle={`${BUSINESS_SCORECARD_PROMETEIA_V1.label} — hər sahə 1-3 bal, cəmi 3-9`}
          actions={<StatusBadge status={BUSINESS_SCORECARD_PROMETEIA_V1.status} />}
        >
          {a.rating.business.complete ? null : (
            <div className="mb-2 rounded border border-amber-500/30 bg-amber-500/5 px-2.5 py-1.5 text-[10.5px] text-amber-300">
              Qiymətləndirmə tamamlanmayıb: {a.rating.business.missingDimensions.join('; ')}
            </div>
          )}
          <div className="space-y-3">
            {a.rating.business.areas.map((area) => (
              <div key={area.areaKey} className="rounded border border-slate-800 bg-slate-950/40 p-2.5">
                <div className="mb-1.5 flex items-baseline justify-between gap-3">
                  <span className="text-[11.5px] font-medium text-slate-200">{area.labelAz}</span>
                  <span className="shrink-0 text-[11.5px] tabular-nums text-slate-100">
                    {area.score.toFixed(2)} / 3
                  </span>
                </div>
                <ProgressBar
                  value={area.score}
                  max={3}
                  tone={area.score >= 2.5 ? 'emerald' : area.score >= 1.75 ? 'amber' : 'rose'}
                />
                <ul className="mt-2 space-y-1.5">
                  {area.dimensions.map((d) => (
                    <li key={d.key} className="text-[10.5px] leading-relaxed">
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="text-slate-400">{d.labelAz}</span>
                        <Badge tone={d.score === 3 ? 'emerald' : d.score === 2 ? 'amber' : 'rose'}>
                          {d.score} bal
                        </Badge>
                      </div>
                      {d.justification && <p className="mt-0.5 text-slate-500">{d.justification}</p>}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <div className="mt-3 border-t border-slate-800 pt-2">
            <KeyValue
              items={[
                { label: 'Cəmi bal', value: `${a.rating.business.totalScore.toFixed(2)} / 9` },
                { label: 'Risk bandı', value: a.rating.business.riskBandLabelAz },
                {
                  label: 'Reytinq düzəlişi',
                  value: a.rating.business.notch === 0 ? 'Düzəliş yoxdur' : `${a.rating.business.notch} pillə`,
                },
              ]}
            />
          </div>
        </Panel>
      </div>

      {a.altman && (
        <Panel
          title="Maliyyə təbəqəsi — Altman Z-Score"
          subtitle={`${a.altman.config.labelAz}. Yalnız ${NOTCHING_PROMETEIA_V1.altman.appliesToSegments.join(', ')} seqmentinə tətbiq olunur.`}
          actions={<StatusBadge status="PROMETEIA_PROPOSED" />}
        >
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
            <DataTable
              head={
                <tr>
                  <Th>Komponent</Th>
                  <Th align="right">Nisbət</Th>
                  <Th align="right">Əmsal</Th>
                  <Th align="right">Töhfə</Th>
                </tr>
              }
            >
              {a.altman.terms.map((t) => (
                <tr key={t.key}>
                  <Td>
                    <span className="font-mono text-[10px] text-slate-500">{t.key.toUpperCase()}</span> {t.label}
                  </Td>
                  <Td align="right">{t.ratio === null ? '—' : t.ratio.toFixed(4)}</Td>
                  <Td align="right">{t.coefficient}</Td>
                  <Td align="right">{t.contribution.toFixed(4)}</Td>
                </tr>
              ))}
              {a.altman.config.coefficients.constant !== 0 && (
                <tr>
                  <Td>Sabit</Td>
                  <Td align="right">—</Td>
                  <Td align="right">{a.altman.config.coefficients.constant}</Td>
                  <Td align="right">{a.altman.config.coefficients.constant.toFixed(4)}</Td>
                </tr>
              )}
              <tr className="bg-slate-900/60 font-medium">
                <Td className="text-slate-100">Z</Td>
                <Td colSpan={2} />
                <Td align="right" className="text-slate-100">
                  {a.altman.z?.toFixed(4) ?? '—'}
                </Td>
              </tr>
            </DataTable>

            <div className="space-y-2">
              <div className="rounded border border-slate-800 bg-slate-950/40 p-3">
                <SectionTitle>Zonalar</SectionTitle>
                <ul className="space-y-1 text-[11px]">
                  <li className="flex justify-between gap-2">
                    <span className="text-slate-400">Aşağı risk</span>
                    <span className="text-emerald-300">Z &gt; {a.altman.config.lowRiskAbove}</span>
                  </li>
                  <li className="flex justify-between gap-2">
                    <span className="text-slate-400">Boz zona</span>
                    <span className="text-amber-300">
                      {a.altman.config.highRiskBelow} – {a.altman.config.lowRiskAbove}
                    </span>
                  </li>
                  <li className="flex justify-between gap-2">
                    <span className="text-slate-400">Yüksək risk</span>
                    <span className="text-rose-300">Z &lt; {a.altman.config.highRiskBelow}</span>
                  </li>
                </ul>
                <div className="mt-2 border-t border-slate-800 pt-2 text-[10.5px] text-slate-500">
                  Sərhəd dəyərlərinin (məs. Z = {a.altman.config.highRiskBelow}) hansı zonaya aid olması metodologiyada
                  dəqiq göstərilməyib — platforma konservativ olaraq boz zonaya aid edir və bu, konfiqurasiya ilə
                  dəyişdirilə bilər.
                </div>
              </div>
              <div className="rounded border border-slate-800 bg-slate-950/40 p-3">
                <SectionTitle>Reytinqə təsiri</SectionTitle>
                <p className="text-[11px] leading-relaxed text-slate-300">{a.rating.financial.reasonAz}</p>
              </div>
            </div>
          </div>
        </Panel>
      )}

      <Panel
        title="ATB Yekun Rəy — As-Is ekspert qiymətləndirməsi"
        subtitle={`${LEGACY_SCORECARD_V1.label} · ${LEGACY_SCORECARD_V1.version}. Bu, Yekun Daxili Reytinq deyil.`}
        actions={<StatusBadge status={LEGACY_SCORECARD_V1.status} />}
        bodyClassName="px-0 py-0"
      >
        {legacy.globalStopTriggered && (
          <div className="border-b border-rose-500/30 bg-rose-500/10 px-4 py-2.5">
            <div className="text-[11.5px] font-medium text-rose-200">
              Stop faktor işə düşüb — yekun bal 0 olaraq təyin edilir (Rəy forması J109).
            </div>
            <ul className="mt-1 space-y-0.5">
              {legacy.stopReasonsAz.map((r, i) => (
                <li key={i} className="text-[10.5px] text-rose-300">
                  • {r}
                </li>
              ))}
            </ul>
            <div className="mt-1 text-[10.5px] text-slate-400">
              Stop faktorsuz hesablanan bal: {legacy.rawTotal.toFixed(2)} / 100
            </div>
          </div>
        )}

        <DataTable
          className="mx-0"
          head={
            <tr>
              <Th>Meyar / bənd</Th>
              <Th align="right">Çəki</Th>
              <Th align="right">Cavab</Th>
              <Th align="right">Bal</Th>
              <Th align="right">Maksimum</Th>
              <Th>Risk bandı</Th>
            </tr>
          }
        >
          {legacy.categories.map((cat) => (
            <Fragment key={cat.category.key}>
              <tr className="bg-slate-900/60">
                <Td className="font-medium text-slate-100">
                  {cat.category.labelAz}
                  <div className="text-[10px] font-normal text-slate-500">{cat.category.labelEn}</div>
                </Td>
                <Td align="right" className="font-medium text-slate-200">
                  {cat.category.weight}%
                </Td>
                <Td align="right" className="text-slate-500">
                  {cat.category.aggregation === 'MEAN_OF_MANUAL_SCORES' ? 'orta bal' : 'çəkili cəm'}
                </Td>
                <Td align="right" className="font-medium text-slate-100">
                  {cat.points.toFixed(2)}
                </Td>
                <Td align="right" className="text-slate-400">
                  {cat.maxPoints}
                </Td>
                <Td>
                  <Badge tone={cat.bandTone as never}>{cat.bandLabelAz}</Badge>
                  {cat.stopTriggered && <Badge tone="rose" className="ml-1">STOP</Badge>}
                  {cat.cappedByNoHistory && (
                    <div className="mt-0.5 text-[9.5px] text-amber-400">
                      Kredit tarixçəsi yoxdur — {cat.category.noHistoryCapPct}% ilə məhdudlaşdırılıb
                    </div>
                  )}
                </Td>
              </tr>
              {cat.components.map((comp) => (
                <tr key={`${cat.category.key}-${comp.component.key}`}>
                  <Td className="pl-6">
                    <span className="text-slate-300">{comp.component.labelAz}</span>
                    <div className="text-[10px] text-slate-500">{comp.component.sourceRef}</div>
                    {comp.stopTriggered && (
                      <div className="mt-0.5 text-[10px] text-rose-300">{comp.stopMessageAz}</div>
                    )}
                  </Td>
                  <Td align="right" className="text-slate-500">
                    {comp.component.weightWithinCategory}%
                  </Td>
                  <Td align="right" className="text-[10.5px]">
                    {comp.component.type === 'MANUAL_0_100'
                      ? `${comp.manualScore?.toFixed(0) ?? '—'} / 100`
                      : (comp.component.options?.find((o) => o.key === comp.answer?.optionKey)?.labelAz ??
                        (comp.answered ? pct(comp.achievement, 0) : 'cavablandırılmayıb'))}
                  </Td>
                  <Td align="right">{comp.points.toFixed(2)}</Td>
                  <Td align="right" className="text-slate-500">
                    {comp.maxPoints.toFixed(2)}
                  </Td>
                  <Td className="max-w-[280px] text-[10px] leading-snug text-slate-500">
                    {comp.answer?.comment ?? ''}
                  </Td>
                </tr>
              ))}
            </Fragment>
          ))}
          <tr className="bg-slate-900/80 font-medium">
            <Td className="text-slate-100">Yekun</Td>
            <Td align="right">100%</Td>
            <Td align="right" />
            <Td align="right" className="text-slate-100">
              {legacy.totalScore.toFixed(2)}
            </Td>
            <Td align="right">100</Td>
            <Td>
              <Badge tone={legacy.bandTone as never}>{legacy.bandLabelAz}</Badge>
            </Td>
          </tr>
        </DataTable>

        <div className="border-t border-slate-800 px-4 py-2 text-[10.5px] text-slate-500">
          Tamlıq: {legacy.completenessPct.toFixed(0)}% sual cavablandırılıb. Bal bandları:{' '}
          {LEGACY_SCORECARD_V1.bands.map((b) => `${b.min}+ ${b.labelAz}`).join(' · ')}. Mənbə:{' '}
          {LEGACY_SCORECARD_V1.sourceRef}
        </div>
      </Panel>

      {!c.application.legacyAssessment && (
        <EmptyState>Yekun rəy qiymətləndirməsi hələ doldurulmayıb.</EmptyState>
      )}
    </div>
  );
}
