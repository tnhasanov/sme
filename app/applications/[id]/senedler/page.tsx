import { notFound } from 'next/navigation';
import { getCase } from '@/services/application-service';
import {
  Badge,
  DataTable,
  EmptyState,
  Panel,
  ProgressBar,
  Stat,
  Td,
  Th,
} from '@/components/ui/primitives';
import { DATA_QUALITY_V1 } from '@/config/scorecards';
import { dateAz, dateTimeAz, DOCUMENT_LABEL_AZ, EVIDENCE_CLASS, EVIDENCE_LABEL_AZ, pct, SOURCE_TYPE_LABEL_AZ } from '@/lib/format';
import { cn } from '@/lib/utils';

/** Documents, evidence status and the data-quality rating (§29-§30, §71). */
export default async function DocumentsPage({ params }: { params: { id: string } }) {
  const c = await getCase(params.id);
  if (!c) notFound();
  const { application: app, assessment: a } = c;
  const dq = a.dataQuality;

  return (
    <div className="space-y-4">
      <Panel bodyClassName="py-3">
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-6">
          <Stat
            label="Məlumat keyfiyyəti reytinqi"
            value={dq.grade}
            sub={dq.gradeLabelAz}
            tone={['A', 'B'].includes(dq.grade) ? 'good' : dq.grade === 'C' ? 'warn' : 'bad'}
          />
          <Stat label="Bal" value={`${dq.scorePct.toFixed(0)} / 100`} />
          <Stat
            label="Şifahi məlumatdan asılılıq"
            value={`${dq.verbalDependencyPct.toFixed(0)}%`}
            tone={dq.verbalDependencyPct > 25 ? 'bad' : 'default'}
          />
          <Stat label="Çatışmayan sənəd" value={dq.missingCount} tone={dq.missingCount > 0 ? 'warn' : 'good'} />
          <Stat label="Ziddiyyətli göstərici" value={dq.contradictoryCount} />
          <Stat
            label="Uğursuz uzlaşma"
            value={dq.unreconciledCount}
            tone={dq.unreconciledCount > 0 ? 'warn' : 'good'}
          />
        </div>
      </Panel>

      <Panel
        title="Məlumat keyfiyyəti amilləri"
        subtitle="Kredit reytinqindən ayrıca hesablanır: rəqəmin özü ilə ona etibar bir-birindən fərqli suallardır"
        actions={<span>{DATA_QUALITY_V1.sourceRef}</span>}
        bodyClassName="px-0 py-0"
      >
        <DataTable
          className="mx-0"
          head={
            <tr>
              <Th>Amil</Th>
              <Th align="right">Çəki</Th>
              <Th align="right">Bal</Th>
              <Th>Səviyyə</Th>
              <Th>Təsdiq mənbəyi</Th>
            </tr>
          }
        >
          {dq.factors.map((f) => (
            <tr key={f.key}>
              <Td>{f.labelAz}</Td>
              <Td align="right">{f.weight}%</Td>
              <Td align="right" className={f.score === 0 ? 'text-rose-300' : ''}>
                {pct(f.score, 0)}
              </Td>
              <Td className="w-40">
                <ProgressBar
                  value={f.score}
                  tone={f.score >= 0.8 ? 'emerald' : f.score >= 0.5 ? 'amber' : 'rose'}
                />
              </Td>
              <Td className="max-w-[420px] text-[10.5px] text-slate-400">
                {f.evidenceSummary}
                {f.supportingDocuments.length > 0 && (
                  <div className="text-slate-600">{f.supportingDocuments.join(' · ')}</div>
                )}
              </Td>
            </tr>
          ))}
        </DataTable>
        <div className="border-t border-slate-800 px-4 py-2 text-[10.5px] text-slate-500">
          Bandlar: {DATA_QUALITY_V1.bands.map((b) => `${b.grade} ≥ ${b.min} (${b.labelAz})`).join(' · ')}
        </div>
      </Panel>

      <Panel title="Sənəd reyestri" subtitle="Hər sənədin təsdiq statusu və hansı göstəricini dəstəklədiyi qeyd olunur" bodyClassName="px-0 py-0">
        {app.documents.length === 0 ? (
          <div className="px-4 py-3">
            <EmptyState>Sənəd yüklənməyib.</EmptyState>
          </div>
        ) : (
          <DataTable
            className="mx-0"
            head={
              <tr>
                <Th>Kateqoriya</Th>
                <Th>Sənəd</Th>
                <Th>Mənbə</Th>
                <Th align="center">Təsdiq</Th>
                <Th align="center">Məcburi</Th>
                <Th align="center">Alınıb</Th>
                <Th>Əlaqəli göstəricilər</Th>
                <Th>Yükləyən</Th>
              </tr>
            }
          >
            {app.documents.map((d) => (
              <tr key={d.id} className={!d.received ? 'bg-rose-500/5' : undefined}>
                <Td className="text-[10.5px] text-slate-400">{DOCUMENT_LABEL_AZ[d.category]}</Td>
                <Td>
                  {d.name}
                  {d.documentDate && <div className="text-[10px] text-slate-500">{dateAz(d.documentDate)}</div>}
                </Td>
                <Td className="text-[10.5px] text-slate-400">{SOURCE_TYPE_LABEL_AZ[d.sourceType]}</Td>
                <Td align="center">
                  <span
                    className={cn(
                      'rounded px-1.5 py-0.5 text-[10px] ring-1 ring-inset',
                      EVIDENCE_CLASS[d.evidence],
                    )}
                  >
                    {EVIDENCE_LABEL_AZ[d.evidence]}
                  </span>
                </Td>
                <Td align="center">{d.mandatory ? 'Bəli' : '—'}</Td>
                <Td align="center">
                  {d.received ? <Badge tone="emerald">Bəli</Badge> : <Badge tone="rose">Xeyr</Badge>}
                </Td>
                <Td className="text-[10px] text-slate-500">{d.relatedMetrics.join(', ') || '—'}</Td>
                <Td className="text-[10.5px]">
                  {d.uploadedBy}
                  <div className="text-[10px] text-slate-500">{dateTimeAz(d.uploadedAt)}</div>
                </Td>
              </tr>
            ))}
          </DataTable>
        )}
      </Panel>

      {app.pipeline.missingDocuments.length > 0 && (
        <Panel title="Çatışmayan sənədlər" subtitle="Sifariş bu sənədlər olmadan tam qiymətləndirilə bilməz">
          <ul className="space-y-1">
            {app.pipeline.missingDocuments.map((m, i) => (
              <li key={i} className="flex items-center gap-2 text-[11.5px] text-rose-200">
                <span className="h-1 w-1 rounded-full bg-rose-400" />
                {m}
              </li>
            ))}
          </ul>
          {app.pipeline.waitingReason && (
            <div className="mt-2 border-t border-slate-800 pt-2 text-[10.5px] text-slate-400">
              Gözləmə səbəbi: {app.pipeline.waitingReason}
            </div>
          )}
        </Panel>
      )}
    </div>
  );
}
