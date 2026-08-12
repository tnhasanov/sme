import Link from 'next/link';
import { AlertTriangle, ArrowUpRight, Clock, Layers, TrendingUp } from 'lucide-react';
import { listCases } from '@/services/application-service';
import { Badge, DataTable, Panel, SeverityBadge, Stat, Td, Th } from '@/components/ui/primitives';
import { AUTHORITY_LABEL_AZ } from '@/config/workflow';
import { GRADE_LABEL_AZ } from '@/config/rating';
import { SLA_V1 } from '@/config/workflow';
import { aznCompact, aznFull, daysBetween, dateAz, STAGE_LABEL_AZ, times } from '@/lib/format';

export default async function DashboardPage() {
  const cases = await listCases();
  const live = cases.filter((c) => !c.application.rejection);
  const rejected = cases.filter((c) => c.application.rejection);

  const requestedTotal = live.reduce((s, c) => s + c.application.requestedStructure.amount, 0);
  const exposureTotal = live.reduce((s, c) => s + c.assessment.groupExposure.postTransactionGroupExposure, 0);
  const withStops = live.filter((c) => c.assessment.activeStopFactors.length > 0);
  const criticalFindings = live.reduce(
    (s, c) => s + c.assessment.findings.filter((f) => f.severity === 'CRITICAL').length,
    0,
  );

  const now = new Date().toISOString();
  const slaBreached = live.filter((c) => {
    const d = daysBetween(c.application.pipeline.receivedAt, c.application.pipeline.decidedAt ?? now);
    return d !== null && d > SLA_V1.targets.totalTat;
  });

  return (
    <div className="mx-auto max-w-[1600px] px-6 py-5">
      <header className="mb-5 flex items-end justify-between gap-6">
        <div>
          <h1 className="text-lg font-semibold tracking-tight text-slate-100">İdarə paneli</h1>
          <p className="mt-0.5 text-[12px] text-slate-400">
            KOB kredit sifarişlərinin cari vəziyyəti, risk siqnalları və qərar marşrutları
          </p>
        </div>
        <Link
          href="/applications"
          className="inline-flex items-center gap-1.5 rounded border border-slate-700 px-3 py-1.5 text-[11.5px] text-slate-300 transition-colors hover:border-slate-600 hover:text-slate-100"
        >
          Bütün sifarişlər <ArrowUpRight className="h-3.5 w-3.5" />
        </Link>
      </header>

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-6">
        <Panel bodyClassName="py-3">
          <Stat label="Aktiv sifariş" value={live.length} sub={`${rejected.length} imtina qeydi saxlanılır`} />
        </Panel>
        <Panel bodyClassName="py-3">
          <Stat label="Tələb olunan məbləğ" value={aznCompact(requestedTotal)} />
        </Panel>
        <Panel bodyClassName="py-3">
          <Stat
            label="Post-əməliyyat ekspozisiya"
            value={aznCompact(exposureTotal)}
            hint="Əməliyyatdan sonrakı qrup ekspozisiyalarının cəmi"
          />
        </Panel>
        <Panel bodyClassName="py-3">
          <Stat
            label="Stop faktorlu sifariş"
            value={withStops.length}
            tone={withStops.length > 0 ? 'bad' : 'good'}
          />
        </Panel>
        <Panel bodyClassName="py-3">
          <Stat label="Kritik tapıntı" value={criticalFindings} tone={criticalFindings > 0 ? 'bad' : 'good'} />
        </Panel>
        <Panel bodyClassName="py-3">
          <Stat
            label="SLA pozuntusu"
            value={slaBreached.length}
            sub={`Hədəf ${SLA_V1.targets.totalTat} gün`}
            tone={slaBreached.length > 0 ? 'warn' : 'good'}
          />
        </Panel>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <Panel
          title="Aktiv sifariş axını"
          subtitle="Qərar səlahiyyəti hesablanmış routing mühərriki tərəfindən müəyyən edilir"
          actions={<Badge tone="violet">Prometeia təklifi V2</Badge>}
          bodyClassName="px-0 py-0"
        >
          <DataTable
            className="mx-0"
            head={
              <tr>
                <Th>Sifariş</Th>
                <Th>Müştəri</Th>
                <Th align="right">Məbləğ</Th>
                <Th align="right">Qrup ekspozisiyası</Th>
                <Th>Reytinq</Th>
                <Th align="right">DSCR</Th>
                <Th>Mərhələ</Th>
                <Th>Qərar səlahiyyəti</Th>
                <Th align="center">Risk</Th>
              </tr>
            }
          >
            {live.map(({ application: app, customer, assessment: a }) => {
              const critical = a.findings.filter((f) => f.severity === 'CRITICAL').length;
              return (
                <tr key={app.id} className="transition-colors hover:bg-slate-900/50">
                  <Td>
                    <Link
                      href={`/applications/${app.id}`}
                      className="font-medium text-sky-300 hover:text-sky-200 hover:underline"
                    >
                      {app.reference}
                    </Link>
                    <div className="text-[10px] text-slate-500">{dateAz(app.applicationDate)}</div>
                  </Td>
                  <Td>
                    <div className="max-w-[190px] truncate text-slate-200">{customer.displayName}</div>
                    <div className="truncate text-[10px] text-slate-500">{customer.sector}</div>
                  </Td>
                  <Td align="right">{aznFull(app.requestedStructure.amount)}</Td>
                  <Td align="right">{aznFull(a.groupExposure.postTransactionGroupExposure)}</Td>
                  <Td>
                    <div className="flex items-center gap-1">
                      <span className="text-slate-400">{a.bureauRating.grade ? GRADE_LABEL_AZ[a.bureauRating.grade] : '—'}</span>
                      <span className="text-slate-600">→</span>
                      <span
                        className={
                          a.rating.isWorstRating ? 'font-medium text-rose-300' : 'font-medium text-slate-100'
                        }
                      >
                        {a.rating.finalGradeLabelAz}
                      </span>
                    </div>
                    <div className="text-[10px] text-slate-500">
                      Yekun rəy {a.legacy.totalScore.toFixed(0)}/100
                    </div>
                  </Td>
                  <Td
                    align="right"
                    className={
                      (a.repayment?.dscrAfter ?? 0) < 1
                        ? 'text-rose-300'
                        : (a.repayment?.dscrAfter ?? 0) < 1.5
                          ? 'text-amber-300'
                          : 'text-emerald-300'
                    }
                  >
                    {times(a.repayment?.dscrAfter)}
                  </Td>
                  <Td>
                    <Badge tone="slate">{STAGE_LABEL_AZ[app.stage] ?? app.stage}</Badge>
                  </Td>
                  <Td>
                    <div className="max-w-[210px] text-[11px] leading-snug text-slate-300">
                      {a.routing.decisionAuthority ? AUTHORITY_LABEL_AZ[a.routing.decisionAuthority] : '—'}
                    </div>
                    {a.routing.escalated && (
                      <div className="mt-0.5 text-[10px] text-amber-400">Eskalasiya edilib</div>
                    )}
                  </Td>
                  <Td align="center">
                    {a.activeStopFactors.length > 0 ? (
                      <Badge tone="rose">{a.activeStopFactors.length} stop</Badge>
                    ) : critical > 0 ? (
                      <Badge tone="orange">{critical} kritik</Badge>
                    ) : (
                      <Badge tone="emerald">təmiz</Badge>
                    )}
                  </Td>
                </tr>
              );
            })}
          </DataTable>
        </Panel>

        <div className="space-y-4">
          <Panel
            title="Diqqət tələb edən siqnallar"
            subtitle="Bütün aktiv sifarişlər üzrə ən ciddi avtomatik tapıntılar"
          >
            <ul className="space-y-2">
              {live
                .flatMap(({ application, customer, assessment }) =>
                  assessment.findings
                    .filter((f) => f.severity === 'CRITICAL' || f.severity === 'HIGH')
                    .slice(0, 3)
                    .map((f) => ({ f, application, customer })),
                )
                .slice(0, 8)
                .map(({ f, application, customer }, i) => (
                  <li key={`${application.id}-${f.id}-${i}`} className="flex gap-2.5">
                    <AlertTriangle
                      className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${
                        f.severity === 'CRITICAL' ? 'text-rose-400' : 'text-orange-400'
                      }`}
                    />
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <SeverityBadge severity={f.severity} />
                        <Link
                          href={`/applications/${application.id}`}
                          className="truncate text-[11px] text-slate-400 hover:text-slate-200"
                        >
                          {customer.displayName}
                        </Link>
                      </div>
                      <div className="mt-0.5 text-[11.5px] leading-snug text-slate-200">{f.title}</div>
                    </div>
                  </li>
                ))}
            </ul>
          </Panel>

          <Panel title="İmtina edilmiş müraciətlər" subtitle="Heç bir imtina bazadan silinmir (§17)">
            <div className="mb-2 flex items-center gap-2 text-[11px] text-slate-400">
              <Layers className="h-3.5 w-3.5" />
              {rejected.length} qeyd — reject analizi və gələcək model kalibrasiyası üçün saxlanılır
            </div>
            <ul className="space-y-1.5">
              {rejected.slice(0, 6).map(({ application, customer }) => (
                <li key={application.id} className="flex items-baseline justify-between gap-3 text-[11px]">
                  <Link
                    href={`/applications/${application.id}`}
                    className="min-w-0 truncate text-slate-300 hover:text-slate-100"
                  >
                    {customer.displayName}
                  </Link>
                  <span className="shrink-0 text-[10px] uppercase tracking-wide text-slate-500">
                    {application.rejection?.reasonCode}
                  </span>
                </li>
              ))}
            </ul>
          </Panel>

          <Panel title="Emal müddəti" subtitle={`SLA hədəfi: ${SLA_V1.targets.totalTat} gün`}>
            <ul className="space-y-2">
              {live.map(({ application, customer }) => {
                const d = daysBetween(application.pipeline.receivedAt, application.pipeline.decidedAt ?? now);
                const breached = d !== null && d > SLA_V1.targets.totalTat;
                return (
                  <li key={application.id} className="flex items-center justify-between gap-3 text-[11px]">
                    <span className="min-w-0 truncate text-slate-400">{customer.displayName}</span>
                    <span
                      className={`inline-flex shrink-0 items-center gap-1 tabular-nums ${
                        breached ? 'text-amber-300' : 'text-slate-300'
                      }`}
                    >
                      <Clock className="h-3 w-3" />
                      {d === null ? '—' : `${d.toFixed(0)} gün`}
                    </span>
                  </li>
                );
              })}
            </ul>
          </Panel>

          <Panel title="Reytinq paylanması" subtitle="Yekun daxili reytinq üzrə aktiv sifarişlər">
            <ul className="space-y-1.5">
              {(['EXCELLENT', 'GOOD', 'MEDIUM', 'SATISFACTORY', 'POOR'] as const).map((grade) => {
                const count = live.filter((c) => c.assessment.rating.finalGrade === grade).length;
                return (
                  <li key={grade} className="flex items-center gap-2 text-[11px]">
                    <span className="w-24 shrink-0 text-slate-400">{GRADE_LABEL_AZ[grade]}</span>
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-800">
                      <div
                        className="h-full rounded-full bg-sky-500"
                        style={{ width: `${live.length ? (count / live.length) * 100 : 0}%` }}
                      />
                    </div>
                    <span className="w-5 shrink-0 text-right tabular-nums text-slate-300">{count}</span>
                  </li>
                );
              })}
            </ul>
            <div className="mt-3 flex items-center gap-1.5 border-t border-slate-800 pt-2 text-[10px] text-slate-500">
              <TrendingUp className="h-3 w-3" />
              Reytinq AKB skorundan başlayıb biznes və maliyyə düzəlişləri ilə formalaşır
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}
