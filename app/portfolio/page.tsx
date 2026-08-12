import { listCases } from '@/services/application-service';
import { DataTable, Panel, ProgressBar, Stat, Td, Th } from '@/components/ui/primitives';
import { GRADE_LABEL_AZ, RATING_GRADES } from '@/config/rating';
import { AUTHORITY_LABEL_AZ, SLA_V1 } from '@/config/workflow';
import { aznFull, daysBetween, pct, times } from '@/lib/format';

/** Portfolio view and pipeline / SLA analytics (§63). */
export default async function PortfolioPage() {
  const cases = await listCases();
  const live = cases.filter((c) => !c.application.rejection);
  const rejected = cases.filter((c) => c.application.rejection);
  const now = new Date().toISOString();

  const bySector = new Map<string, { count: number; exposure: number; avgDscr: number[] }>();
  for (const c of live) {
    const key = c.customer.sector;
    const entry = bySector.get(key) ?? { count: 0, exposure: 0, avgDscr: [] };
    entry.count += 1;
    entry.exposure += c.assessment.groupExposure.postTransactionGroupExposure;
    if (c.assessment.repayment?.dscrAfter !== null && c.assessment.repayment?.dscrAfter !== undefined) {
      entry.avgDscr.push(c.assessment.repayment.dscrAfter);
    }
    bySector.set(key, entry);
  }

  const byBranch = new Map<string, { count: number; amount: number; rejected: number }>();
  for (const c of cases) {
    const key = c.application.branch;
    const entry = byBranch.get(key) ?? { count: 0, amount: 0, rejected: 0 };
    entry.count += 1;
    entry.amount += c.application.requestedStructure.amount;
    if (c.application.rejection) entry.rejected += 1;
    byBranch.set(key, entry);
  }

  const byAuthority = new Map<string, number>();
  for (const c of live) {
    const key = c.assessment.routing.decisionAuthority ?? 'UNKNOWN';
    byAuthority.set(key, (byAuthority.get(key) ?? 0) + 1);
  }

  const totalExposure = live.reduce((s, c) => s + c.assessment.groupExposure.postTransactionGroupExposure, 0);
  const approvalRate = cases.length > 0 ? live.length / cases.length : 0;

  return (
    <div className="mx-auto max-w-[1600px] px-6 py-5">
      <header className="mb-4">
        <h1 className="text-lg font-semibold tracking-tight text-slate-100">Portfel</h1>
        <p className="mt-0.5 text-[12px] text-slate-400">
          Sektor, filial, reytinq və qərar səlahiyyəti üzrə paylanma; emal müddəti göstəriciləri
        </p>
      </header>

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-6">
        <Panel bodyClassName="py-3">
          <Stat label="Aktiv sifariş" value={live.length} />
        </Panel>
        <Panel bodyClassName="py-3">
          <Stat label="İmtina" value={rejected.length} />
        </Panel>
        <Panel bodyClassName="py-3">
          <Stat label="Təsdiq nisbəti (irəli keçən)" value={pct(approvalRate)} />
        </Panel>
        <Panel bodyClassName="py-3">
          <Stat label="Cəmi post-ekspozisiya" value={aznFull(totalExposure)} />
        </Panel>
        <Panel bodyClassName="py-3">
          <Stat
            label="Orta DSCR"
            value={times(
              live
                .map((c) => c.assessment.repayment?.dscrAfter)
                .filter((d): d is number => d !== null && d !== undefined)
                .reduce((s, d, _, arr) => s + d / arr.length, 0),
            )}
          />
        </Panel>
        <Panel bodyClassName="py-3">
          <Stat
            label="Stop faktorlu"
            value={live.filter((c) => c.assessment.activeStopFactors.length > 0).length}
            tone="bad"
          />
        </Panel>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Panel title="Sektor üzrə paylanma" bodyClassName="px-0 py-0">
          <DataTable
            className="mx-0"
            head={
              <tr>
                <Th>Sektor</Th>
                <Th align="right">Sifariş</Th>
                <Th align="right">Ekspozisiya</Th>
                <Th align="right">Pay</Th>
                <Th align="right">Orta DSCR</Th>
                <Th>Paylanma</Th>
              </tr>
            }
          >
            {[...bySector.entries()]
              .sort((a, b) => b[1].exposure - a[1].exposure)
              .map(([sector, e]) => (
                <tr key={sector}>
                  <Td>{sector}</Td>
                  <Td align="right">{e.count}</Td>
                  <Td align="right">{aznFull(e.exposure)}</Td>
                  <Td align="right">{pct(totalExposure > 0 ? e.exposure / totalExposure : 0)}</Td>
                  <Td align="right">
                    {times(e.avgDscr.length ? e.avgDscr.reduce((s, d) => s + d, 0) / e.avgDscr.length : null)}
                  </Td>
                  <Td className="w-32">
                    <ProgressBar value={totalExposure > 0 ? e.exposure / totalExposure : 0} />
                  </Td>
                </tr>
              ))}
          </DataTable>
        </Panel>

        <Panel title="Filial üzrə paylanma" bodyClassName="px-0 py-0">
          <DataTable
            className="mx-0"
            head={
              <tr>
                <Th>Filial</Th>
                <Th align="right">Sifariş</Th>
                <Th align="right">Məbləğ</Th>
                <Th align="right">İmtina</Th>
                <Th align="right">İmtina nisbəti</Th>
              </tr>
            }
          >
            {[...byBranch.entries()]
              .sort((a, b) => b[1].amount - a[1].amount)
              .map(([branch, e]) => (
                <tr key={branch}>
                  <Td>{branch}</Td>
                  <Td align="right">{e.count}</Td>
                  <Td align="right">{aznFull(e.amount)}</Td>
                  <Td align="right">{e.rejected}</Td>
                  <Td align="right" className={e.rejected / e.count > 0.4 ? 'text-amber-300' : ''}>
                    {pct(e.rejected / e.count)}
                  </Td>
                </tr>
              ))}
          </DataTable>
        </Panel>

        <Panel title="Yekun daxili reytinq üzrə paylanma">
          <ul className="space-y-2">
            {[...RATING_GRADES].reverse().map((grade) => {
              const items = live.filter((c) => c.assessment.rating.finalGrade === grade);
              const exposure = items.reduce(
                (s, c) => s + c.assessment.groupExposure.postTransactionGroupExposure,
                0,
              );
              return (
                <li key={grade} className="text-[11.5px]">
                  <div className="mb-1 flex items-baseline justify-between gap-3">
                    <span className="text-slate-300">{GRADE_LABEL_AZ[grade]}</span>
                    <span className="tabular-nums text-slate-400">
                      {items.length} sifariş · {aznFull(exposure)}
                    </span>
                  </div>
                  <ProgressBar
                    value={totalExposure > 0 ? exposure / totalExposure : 0}
                    tone={grade === 'POOR' ? 'rose' : grade === 'SATISFACTORY' ? 'amber' : 'emerald'}
                  />
                </li>
              );
            })}
          </ul>
        </Panel>

        <Panel title="Qərar səlahiyyəti üzrə iş yükü" bodyClassName="px-0 py-0">
          <DataTable
            className="mx-0"
            head={
              <tr>
                <Th>Səlahiyyət</Th>
                <Th align="right">Sifariş</Th>
                <Th align="right">Pay</Th>
                <Th>Paylanma</Th>
              </tr>
            }
          >
            {[...byAuthority.entries()]
              .sort((a, b) => b[1] - a[1])
              .map(([authority, count]) => (
                <tr key={authority}>
                  <Td className="max-w-[280px]">
                    {AUTHORITY_LABEL_AZ[authority as keyof typeof AUTHORITY_LABEL_AZ] ?? authority}
                  </Td>
                  <Td align="right">{count}</Td>
                  <Td align="right">{pct(count / Math.max(live.length, 1))}</Td>
                  <Td className="w-32">
                    <ProgressBar value={count / Math.max(live.length, 1)} tone="sky" />
                  </Td>
                </tr>
              ))}
          </DataTable>
        </Panel>
      </div>

      <Panel
        className="mt-4"
        title="Pipeline və emal müddəti"
        subtitle={`SLA hədəfləri: anderraytinqə ${SLA_V1.targets.daysToUnderwriting} gün · anderraytinqdə ${SLA_V1.targets.daysInUnderwriting} gün · komitəyə ${SLA_V1.targets.daysToCommittee} gün · ümumi ${SLA_V1.targets.totalTat} gün`}
        bodyClassName="px-0 py-0"
      >
        <DataTable
          className="mx-0"
          head={
            <tr>
              <Th>Sifariş</Th>
              <Th>Filial / RM</Th>
              <Th>Mərhələ</Th>
              <Th align="right">Anderraytinqə qədər</Th>
              <Th align="right">Anderraytinqdə</Th>
              <Th align="right">Komitəyə qədər</Th>
              <Th align="right">Ümumi TAT</Th>
              <Th align="right">Geri qaytarma</Th>
              <Th>Gözləmə səbəbi</Th>
              <Th align="center">SLA</Th>
            </tr>
          }
        >
          {cases.map(({ application: app, customer }) => {
            const p = app.pipeline;
            const toUw = daysBetween(p.receivedAt, p.assignedToUwAt);
            const inUw = daysBetween(p.assignedToUwAt, p.uwCompletedAt);
            const toCommittee = daysBetween(p.uwCompletedAt, p.committeeAt);
            const total = daysBetween(p.receivedAt, p.decidedAt ?? now);
            const breached = total !== null && total > SLA_V1.targets.totalTat;
            return (
              <tr key={app.id}>
                <Td>
                  {app.reference}
                  <div className="max-w-[180px] truncate text-[10px] text-slate-500">{customer.displayName}</div>
                </Td>
                <Td className="text-[10.5px]">
                  {app.branch}
                  <div className="text-slate-500">{app.rm}</div>
                </Td>
                <Td className="text-[10.5px] text-slate-400">{app.stage}</Td>
                <Td align="right">{toUw === null ? '—' : toUw.toFixed(1)}</Td>
                <Td align="right">{inUw === null ? '—' : inUw.toFixed(1)}</Td>
                <Td align="right">{toCommittee === null ? '—' : toCommittee.toFixed(1)}</Td>
                <Td align="right" className={breached ? 'text-amber-300' : ''}>
                  {total === null ? '—' : total.toFixed(1)}
                </Td>
                <Td align="right">{p.returnCount}</Td>
                <Td className="max-w-[220px] text-[10.5px] text-slate-400">{p.waitingReason ?? '—'}</Td>
                <Td align="center" className={breached ? 'text-amber-300' : 'text-emerald-300'}>
                  {breached ? 'Pozulub' : 'Uyğun'}
                </Td>
              </tr>
            );
          })}
        </DataTable>
      </Panel>
    </div>
  );
}
