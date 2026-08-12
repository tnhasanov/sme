import { notFound } from 'next/navigation';
import { getCase } from '@/services/application-service';
import {
  Badge,
  DataTable,
  EmptyState,
  Panel,
  SeverityBadge,
  Stat,
  Td,
  Th,
} from '@/components/ui/primitives';
import { azn, aznFull, FINDING_CATEGORY_LABEL_AZ, pct } from '@/lib/format';

/** Reconciliation engine and the findings it produces (§31-§32). */
export default async function CrossChecksPage({ params }: { params: { id: string } }) {
  const c = await getCase(params.id);
  if (!c) notFound();
  const { assessment: a } = c;

  const failed = a.crossChecks.filter((x) => !x.passed);
  const bySeverity = (s: string) => a.findings.filter((f) => f.severity === s).length;

  return (
    <div className="space-y-4">
      <Panel bodyClassName="py-3">
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-6">
          <Stat
            label="Uzlaşma yoxlamaları"
            value={`${a.crossChecks.length - failed.length} / ${a.crossChecks.length}`}
            sub="Uğurlu / cəmi"
            tone={failed.length === 0 ? 'good' : 'warn'}
          />
          <Stat label="Kritik tapıntı" value={bySeverity('CRITICAL')} tone={bySeverity('CRITICAL') > 0 ? 'bad' : 'good'} />
          <Stat label="Yüksək" value={bySeverity('HIGH')} />
          <Stat label="Orta" value={bySeverity('MEDIUM')} />
          <Stat label="Aşağı" value={bySeverity('LOW')} />
          <Stat label="Cəmi tapıntı" value={a.findings.length} />
        </div>
      </Panel>

      {a.crossChecks.map((check) => (
        <Panel
          key={check.key}
          title={check.labelAz}
          subtitle={check.labelEn}
          actions={check.passed ? <Badge tone="emerald">Uzlaşır</Badge> : <SeverityBadge severity={check.severity} />}
        >
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
            <div>
              <div className="mb-2 font-mono text-[10.5px] text-slate-500">{check.formula}</div>
              <DataTable
                head={
                  <tr>
                    <Th>Komponent</Th>
                    <Th align="center">İşarə</Th>
                    <Th align="right">Məbləğ</Th>
                  </tr>
                }
              >
                {check.components.map((comp, i) => (
                  <tr key={i}>
                    <Td>{comp.label}</Td>
                    <Td align="center" className="text-slate-500">
                      {comp.sign}
                    </Td>
                    <Td align="right">{azn(comp.value)}</Td>
                  </tr>
                ))}
              </DataTable>
            </div>
            <div className="space-y-2">
              <div className="grid grid-cols-3 gap-3 rounded border border-slate-800 bg-slate-950/40 p-3">
                <Stat label="Gözlənilən" value={aznFull(check.expected)} />
                <Stat label="Faktiki" value={aznFull(check.actual)} />
                <Stat
                  label="Fərq"
                  value={aznFull(check.difference)}
                  sub={check.differencePct === null ? undefined : pct(check.differencePct)}
                  tone={check.passed ? 'good' : 'bad'}
                />
              </div>
              <p
                className={`text-[11.5px] leading-relaxed ${
                  check.passed ? 'text-slate-400' : 'text-rose-200'
                }`}
              >
                {check.interpretationAz}
              </p>
              <div className="text-[10px] text-slate-600">
                Dözümlülük həddi: {pct(check.toleranceP)} — bundan artıq fərq izah tələb edir.
              </div>
            </div>
          </div>
        </Panel>
      ))}

      <Panel
        title="Tapıntılar reyestri"
        subtitle="Hesablama nəticələrindən avtomatik yaradılır; analitik şərh və mitiqant əlavə edə bilər (§32)"
        bodyClassName="px-0 py-0"
      >
        {a.findings.length === 0 ? (
          <div className="px-4 py-3">
            <EmptyState>Tapıntı yoxdur.</EmptyState>
          </div>
        ) : (
          <DataTable
            className="mx-0"
            head={
              <tr>
                <Th align="center">Səviyyə</Th>
                <Th>Kateqoriya</Th>
                <Th>Tapıntı</Th>
                <Th align="right">Müşahidə</Th>
                <Th align="right">Gözlənilən</Th>
                <Th align="right">Maliyyə təsiri</Th>
                <Th>Mənbə</Th>
                <Th align="center">Status</Th>
              </tr>
            }
          >
            {a.findings.map((f) => (
              <tr key={f.id}>
                <Td align="center">
                  <SeverityBadge severity={f.severity} />
                </Td>
                <Td className="text-[10.5px] text-slate-400">{FINDING_CATEGORY_LABEL_AZ[f.category]}</Td>
                <Td className="max-w-[420px]">
                  <div className="font-medium text-slate-100">{f.title}</div>
                  <div className="mt-0.5 text-[10.5px] leading-relaxed text-slate-400">{f.description}</div>
                  {f.mitigant && (
                    <div className="mt-1 text-[10.5px] text-emerald-300">Mitiqant: {f.mitigant}</div>
                  )}
                </Td>
                <Td align="right" className="text-[10.5px]">
                  {f.observedValue ?? '—'}
                </Td>
                <Td align="right" className="text-[10.5px]">
                  {f.expectedValue ?? '—'}
                </Td>
                <Td align="right">{f.financialImpact ? aznFull(f.financialImpact) : '—'}</Td>
                <Td className="max-w-[240px] text-[10px] leading-snug text-slate-500">{f.source}</Td>
                <Td align="center">
                  <Badge tone={f.resolutionStatus === 'OPEN' ? 'amber' : 'emerald'}>{f.resolutionStatus}</Badge>
                </Td>
              </tr>
            ))}
          </DataTable>
        )}
      </Panel>
    </div>
  );
}
