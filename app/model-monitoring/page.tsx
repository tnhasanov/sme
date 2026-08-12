import { listCases } from '@/services/application-service';
import { BAD_DEFINITIONS, CURRENT_SCORECARD_POWER, CURRENT_STATE_PERFORMANCE } from '@/config/monitoring';
import {
  Badge,
  DataTable,
  EmptyState,
  Panel,
  ProgressBar,
  Stat,
  StatusBadge,
  Td,
  Th,
} from '@/components/ui/primitives';
import { GRADE_LABEL_AZ, RATING_GRADES } from '@/config/rating';
import { pct } from '@/lib/format';

/** Model monitoring (§64-§66). */
export default async function ModelMonitoringPage() {
  const cases = await listCases();
  const live = cases.filter((c) => !c.application.rejection);
  const rejected = cases.filter((c) => c.application.rejection);
  const preScreenRejected = rejected.filter((c) => c.application.rejection?.stage === 'REJECTED_PRESCREEN');

  const migrations = live.map((c) => ({
    reference: c.application.reference,
    customer: c.customer.displayName,
    initial: c.assessment.rating.initialGrade,
    final: c.assessment.rating.finalGrade,
    notch: c.assessment.rating.totalNotch,
    override: c.assessment.rating.overrideApplied,
  }));

  const downgrades = migrations.filter((m) => m.notch < 0).length;
  const upgrades = migrations.filter((m) => m.notch > 0).length;
  const overrides = migrations.filter((m) => m.override).length;

  const totalCurrentState = CURRENT_STATE_PERFORMANCE.buckets.reduce((s, b) => s + b.count, 0);
  const totalInternalBad = CURRENT_STATE_PERFORMANCE.buckets.reduce((s, b) => s + b.internalBad, 0);
  const totalExternalBad = CURRENT_STATE_PERFORMANCE.buckets.reduce((s, b) => s + b.externalBad, 0);

  return (
    <div className="mx-auto max-w-[1600px] px-6 py-5">
      <header className="mb-4">
        <h1 className="text-lg font-semibold tracking-tight text-slate-100">Model monitorinqi</h1>
        <p className="mt-0.5 text-[12px] text-slate-400">
          Həcm, reytinq miqrasiyası, override nisbəti, defolt tərifləri və cari skorkartın ayırdetmə gücü
        </p>
      </header>

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-6">
        <Panel bodyClassName="py-3">
          <Stat label="Müraciət" value={cases.length} />
        </Panel>
        <Panel bodyClassName="py-3">
          <Stat label="İrəli keçən" value={live.length} />
        </Panel>
        <Panel bodyClassName="py-3">
          <Stat label="İmtina" value={rejected.length} />
        </Panel>
        <Panel bodyClassName="py-3">
          <Stat
            label="İlkin süzgəcdə imtina"
            value={preScreenRejected.length}
            sub={pct(preScreenRejected.length / Math.max(cases.length, 1))}
          />
        </Panel>
        <Panel bodyClassName="py-3">
          <Stat label="Reytinq aşağı düşməsi" value={downgrades} />
        </Panel>
        <Panel bodyClassName="py-3">
          <Stat label="Override nisbəti" value={pct(overrides / Math.max(live.length, 1))} />
        </Panel>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Panel title="Reytinq paylanması" subtitle="İlkin (AKB) və yekun daxili reytinq">
          <ul className="space-y-2">
            {[...RATING_GRADES].reverse().map((grade) => {
              const initial = live.filter((c) => c.assessment.rating.initialGrade === grade).length;
              const final = live.filter((c) => c.assessment.rating.finalGrade === grade).length;
              return (
                <li key={grade} className="text-[11.5px]">
                  <div className="mb-1 flex items-baseline justify-between gap-3">
                    <span className="text-slate-300">{GRADE_LABEL_AZ[grade]}</span>
                    <span className="tabular-nums text-slate-400">
                      İlkin {initial} → Yekun {final}
                    </span>
                  </div>
                  <div className="flex gap-1">
                    <ProgressBar value={initial / Math.max(live.length, 1)} tone="sky" className="flex-1" />
                    <ProgressBar value={final / Math.max(live.length, 1)} tone="emerald" className="flex-1" />
                  </div>
                </li>
              );
            })}
          </ul>
          <div className="mt-3 flex gap-4 border-t border-slate-800 pt-2 text-[10px] text-slate-500">
            <span className="flex items-center gap-1.5">
              <span className="h-1.5 w-4 rounded-full bg-sky-500" /> İlkin reytinq
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-1.5 w-4 rounded-full bg-emerald-500" /> Yekun daxili reytinq
            </span>
          </div>
        </Panel>

        <Panel title="Reytinq miqrasiyası" bodyClassName="px-0 py-0">
          <DataTable
            className="mx-0"
            head={
              <tr>
                <Th>Sifariş</Th>
                <Th>Müştəri</Th>
                <Th>İlkin</Th>
                <Th>Yekun</Th>
                <Th align="right">Düzəliş</Th>
                <Th align="center">Override</Th>
              </tr>
            }
          >
            {migrations.map((m) => (
              <tr key={m.reference}>
                <Td>{m.reference}</Td>
                <Td className="max-w-[180px] truncate">{m.customer}</Td>
                <Td>{m.initial ? GRADE_LABEL_AZ[m.initial] : '—'}</Td>
                <Td className="font-medium text-slate-100">{m.final ? GRADE_LABEL_AZ[m.final] : '—'}</Td>
                <Td
                  align="right"
                  className={m.notch < 0 ? 'text-rose-300' : m.notch > 0 ? 'text-emerald-300' : ''}
                >
                  {m.notch === 0 ? '—' : `${m.notch > 0 ? '+' : ''}${m.notch}`}
                </Td>
                <Td align="center">{m.override ? <Badge tone="amber">Bəli</Badge> : '—'}</Td>
              </tr>
            ))}
          </DataTable>
          <div className="border-t border-slate-800 px-4 py-2 text-[10.5px] text-slate-500">
            Aşağı düşmə: {downgrades} · Yüksəlmə: {upgrades} · Dəyişməyən: {live.length - downgrades - upgrades}
          </div>
        </Panel>
      </div>

      <Panel
        className="mt-4"
        title="Cari vəziyyətin faktiki performansı"
        subtitle={CURRENT_STATE_PERFORMANCE.periodAz}
        actions={<span>{CURRENT_STATE_PERFORMANCE.sourceRef}</span>}
        bodyClassName="px-0 py-0"
      >
        <DataTable
          className="mx-0"
          head={
            <tr>
              <Th>Ekspozisiya intervalı</Th>
              <Th>Qiymətləndirən</Th>
              <Th>Qərar səlahiyyəti</Th>
              <Th align="right">Say</Th>
              <Th align="right">Pay</Th>
              <Th align="right">Daxili defolt</Th>
              <Th align="right">Daxili %</Th>
              <Th align="right">Xarici defolt</Th>
              <Th align="right">Xarici %</Th>
            </tr>
          }
        >
          {CURRENT_STATE_PERFORMANCE.buckets.map((b) => (
            <tr key={b.bucketAz}>
              <Td>{b.bucketAz}</Td>
              <Td className="text-[10.5px]">{b.assessor}</Td>
              <Td className="max-w-[260px] text-[10.5px] text-slate-400">{b.decisionAuthority}</Td>
              <Td align="right">{b.count}</Td>
              <Td align="right">{pct(b.obsShare, 0)}</Td>
              <Td align="right">{b.internalBad}</Td>
              <Td align="right">{pct(b.internalBad / b.count)}</Td>
              <Td align="right">{b.externalBad}</Td>
              <Td align="right" className={b.externalBad / b.count > 0.2 ? 'text-amber-300' : ''}>
                {pct(b.externalBad / b.count)}
              </Td>
            </tr>
          ))}
          <tr className="bg-slate-900/60 font-medium">
            <Td colSpan={3}>Cəmi</Td>
            <Td align="right">{totalCurrentState}</Td>
            <Td align="right">100%</Td>
            <Td align="right">{totalInternalBad}</Td>
            <Td align="right">{pct(totalInternalBad / totalCurrentState)}</Td>
            <Td align="right">{totalExternalBad}</Td>
            <Td align="right">{pct(totalExternalBad / totalCurrentState)}</Td>
          </tr>
        </DataTable>
        <ul className="space-y-1 border-t border-slate-800 px-4 py-2.5">
          {CURRENT_STATE_PERFORMANCE.notes.map((n, i) => (
            <li key={i} className="text-[10.5px] leading-relaxed text-slate-500">
              • {n}
            </li>
          ))}
        </ul>
      </Panel>

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <Panel
          title="Cari skorkartın ayırdetmə gücü"
          subtitle={`Kiçik seqment üzrə ümumi GINI: ${CURRENT_SCORECARD_POWER.overallGiniSmall}`}
          actions={<span>{CURRENT_SCORECARD_POWER.sourceRef}</span>}
          bodyClassName="px-0 py-0"
        >
          <DataTable
            className="mx-0"
            head={
              <tr>
                <Th>Bölmə</Th>
                <Th align="right">Çəki</Th>
                <Th align="right">GINI</Th>
                <Th>Şərh</Th>
              </tr>
            }
          >
            {CURRENT_SCORECARD_POWER.sections.map((s) => (
              <tr key={s.sectionAz}>
                <Td>{s.sectionAz}</Td>
                <Td align="right">{s.weightPct}%</Td>
                <Td
                  align="right"
                  className={s.giniSmall !== null && s.giniSmall <= 0 ? 'text-rose-300' : 'text-slate-300'}
                >
                  {s.giniSmall === null ? '—' : s.giniSmall.toFixed(3)}
                </Td>
                <Td className="max-w-[300px] text-[10.5px] leading-snug text-slate-400">{s.commentAz}</Td>
              </tr>
            ))}
          </DataTable>
          <div className="border-t border-slate-800 px-4 py-2 text-[10.5px] leading-relaxed text-amber-300">
            Çəkisi 60% olan üç bölmə (maliyyə, təyinat, təminat) praktiki olaraq ayırdetmə gücü göstərmir. Bu, mövcud
            metodologiyanın saxlanılması ilə yanaşı ayrıca reytinq mühərrikinin qurulmasının əsas səbəbidir.
          </div>
        </Panel>

        <Panel
          title="Defolt tərifləri"
          subtitle="Performans tərifi versiyalanır — tərif dəyişəndə tarixi nəticələr yenidən yazılmır (§65)"
          bodyClassName="px-0 py-0"
        >
          <DataTable
            className="mx-0"
            head={
              <tr>
                <Th>Tərif</Th>
                <Th align="center">Status</Th>
                <Th align="right">Müşahidə dövrü</Th>
                <Th>Meyarlar</Th>
              </tr>
            }
          >
            {BAD_DEFINITIONS.map((d) => (
              <tr key={d.id}>
                <Td>
                  <div className="text-slate-200">{d.label}</div>
                  <div className="text-[10px] text-slate-500">{d.descriptionAz}</div>
                  <div className="font-mono text-[9.5px] text-slate-600">{d.id}</div>
                </Td>
                <Td align="center">
                  <StatusBadge status={d.status} />
                </Td>
                <Td align="right">{d.observationMonths} ay</Td>
                <Td className="text-[10.5px] text-slate-400">{d.criteria.join(' · ')}</Td>
              </tr>
            ))}
          </DataTable>
        </Panel>
      </div>

      <Panel className="mt-4" title="Model göstəriciləri" subtitle="GINI / AUC / KS — faktiki performans məlumatı toplandıqca hesablanacaq">
        <EmptyState>
          Bu mühitdə yalnız sintetik məlumat mövcuddur; GINI, AUC və KS göstəriciləri real portfel performansı
          toplandıqdan sonra hesablanır. Arxitektura champion/challenger, reject inference və backtesting üçün
          hazırdır — cari mərhələdə ML modeli tələb olunmur (§66).
        </EmptyState>
      </Panel>
    </div>
  );
}
