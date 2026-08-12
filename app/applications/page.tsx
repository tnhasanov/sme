import Link from 'next/link';
import { listCases } from '@/services/application-service';
import { Badge, DataTable, Panel, Stat, Td, Th } from '@/components/ui/primitives';
import { AUTHORITY_LABEL_AZ, SLA_V1 } from '@/config/workflow';
import { GradeChip } from '@/components/application/shared';
import { aznFull, dateAz, daysBetween, PRODUCT_LABEL_AZ, STAGE_LABEL_AZ, times } from '@/lib/format';

export default async function ApplicationsPage() {
  const cases = await listCases();
  const live = cases.filter((c) => !c.application.rejection);
  const rejected = cases.filter((c) => c.application.rejection);
  const now = new Date().toISOString();

  return (
    <div className="mx-auto max-w-[1720px] px-6 py-5">
      <header className="mb-4">
        <h1 className="text-lg font-semibold tracking-tight text-slate-100">Sifarişlər</h1>
        <p className="mt-0.5 text-[12px] text-slate-400">
          Bütün KOB kredit sifarişləri — imtina edilənlər də daxil olmaqla
        </p>
      </header>

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Panel bodyClassName="py-3">
          <Stat label="Aktiv" value={live.length} />
        </Panel>
        <Panel bodyClassName="py-3">
          <Stat label="İmtina qeydləri" value={rejected.length} />
        </Panel>
        <Panel bodyClassName="py-3">
          <Stat
            label="Anderraytinqdə"
            value={live.filter((c) => c.application.stage === 'UNDERWRITING').length}
          />
        </Panel>
        <Panel bodyClassName="py-3">
          <Stat label="Komitədə" value={live.filter((c) => c.application.stage === 'COMMITTEE').length} />
        </Panel>
        <Panel bodyClassName="py-3">
          <Stat
            label="Çatışmayan sənəd"
            value={live.reduce((s, c) => s + c.application.pipeline.missingDocuments.length, 0)}
          />
        </Panel>
      </div>

      <Panel title="Aktiv sifarişlər" bodyClassName="px-0 py-0">
        <DataTable
          className="mx-0"
          head={
            <tr>
              <Th>Sifariş</Th>
              <Th>Müştəri</Th>
              <Th>Məhsul</Th>
              <Th align="right">Məbləğ</Th>
              <Th align="right">Post-ekspozisiya</Th>
              <Th>AKB</Th>
              <Th>Yekun reytinq</Th>
              <Th align="right">DSCR</Th>
              <Th align="right">Girov</Th>
              <Th>Mərhələ</Th>
              <Th>Səlahiyyət</Th>
              <Th align="right">Gün</Th>
            </tr>
          }
        >
          {live.map(({ application: app, customer, assessment: a }) => {
            const d = daysBetween(app.pipeline.receivedAt, app.pipeline.decidedAt ?? now);
            const breached = d !== null && d > SLA_V1.targets.totalTat;
            return (
              <tr key={app.id} className="transition-colors hover:bg-slate-900/50">
                <Td>
                  <Link href={`/applications/${app.id}`} className="font-medium text-sky-300 hover:underline">
                    {app.reference}
                  </Link>
                  <div className="text-[10px] text-slate-500">{dateAz(app.applicationDate)}</div>
                </Td>
                <Td>
                  <div className="max-w-[180px] truncate">{customer.displayName}</div>
                  <div className="truncate text-[10px] text-slate-500">{app.branch}</div>
                </Td>
                <Td className="max-w-[140px] truncate text-[11px]">
                  {PRODUCT_LABEL_AZ[app.requestedStructure.product]}
                </Td>
                <Td align="right">{aznFull(app.requestedStructure.amount)}</Td>
                <Td align="right">{aznFull(a.groupExposure.postTransactionGroupExposure)}</Td>
                <Td>
                  <GradeChip grade={a.bureauRating.grade} />
                </Td>
                <Td>
                  <GradeChip grade={a.rating.finalGrade} worst={a.rating.isWorstRating} />
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
                <Td
                  align="right"
                  className={(a.collateral.eligibleCoverage ?? 0) >= 1 ? 'text-emerald-300' : 'text-amber-300'}
                >
                  {a.collateral.eligibleCoverage === null
                    ? '—'
                    : `${(a.collateral.eligibleCoverage * 100).toFixed(0)}%`}
                </Td>
                <Td>
                  <Badge tone="slate">{STAGE_LABEL_AZ[app.stage] ?? app.stage}</Badge>
                </Td>
                <Td className="max-w-[180px] text-[10.5px] leading-snug">
                  {a.routing.decisionAuthority ? AUTHORITY_LABEL_AZ[a.routing.decisionAuthority] : '—'}
                </Td>
                <Td align="right" className={breached ? 'text-amber-300' : ''}>
                  {d === null ? '—' : d.toFixed(0)}
                </Td>
              </tr>
            );
          })}
        </DataTable>
      </Panel>

      <Panel
        className="mt-4"
        title="İmtina edilmiş müraciətlər"
        subtitle="Heç bir imtina bazadan silinmir — model kalibrasiyası və approval rate təhlili üçün saxlanılır (§17)"
        bodyClassName="px-0 py-0"
      >
        <DataTable
          className="mx-0"
          head={
            <tr>
              <Th>Sifariş</Th>
              <Th>Müştəri</Th>
              <Th>Sektor</Th>
              <Th align="right">Məbləğ</Th>
              <Th align="right">Qrup ekspozisiyası</Th>
              <Th align="right">AKB skoru</Th>
              <Th>Mərhələ</Th>
              <Th>Səbəb</Th>
              <Th>Tarix</Th>
            </tr>
          }
        >
          {rejected.map(({ application: app, customer }) => (
            <tr key={app.id} className="transition-colors hover:bg-slate-900/50">
              <Td>
                <Link href={`/applications/${app.id}`} className="text-sky-300 hover:underline">
                  {app.reference}
                </Link>
              </Td>
              <Td className="max-w-[180px] truncate">{customer.displayName}</Td>
              <Td className="text-[11px] text-slate-400">{customer.sector}</Td>
              <Td align="right">{aznFull(app.rejection!.requestedAmount)}</Td>
              <Td align="right">{aznFull(app.rejection!.groupExposure)}</Td>
              <Td align="right">{app.rejection!.acbScore ?? '—'}</Td>
              <Td>
                <Badge tone="rose">{STAGE_LABEL_AZ[app.rejection!.stage] ?? app.rejection!.stage}</Badge>
              </Td>
              <Td className="max-w-[280px]">
                <div className="font-mono text-[10px] text-slate-400">{app.rejection!.reasonCode}</div>
                <div className="text-[10.5px] leading-snug text-slate-500">{app.rejection!.description}</div>
              </Td>
              <Td>{dateAz(app.rejection!.rejectedAt)}</Td>
            </tr>
          ))}
        </DataTable>
      </Panel>
    </div>
  );
}
