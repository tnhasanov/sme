import { notFound } from 'next/navigation';
import { getCase } from '@/services/application-service';
import {
  Badge,
  DataTable,
  EmptyState,
  Panel,
  SeverityBadge,
  Stat,
  StatusBadge,
  Td,
  Th,
} from '@/components/ui/primitives';
import { operatorSymbol } from '@/domain/rules/policy-engine';
import { dateTimeAz } from '@/lib/format';

/** Policy limits, stop factors and exceptions (§26, §48, §55). */
export default async function PolicyPage({ params }: { params: { id: string } }) {
  const c = await getCase(params.id);
  if (!c) notFound();
  const { application: app, assessment: a } = c;

  const waived = a.stopFactors.filter((s) => s.waivedBySector);
  const notTriggered = a.stopFactors.filter((s) => !s.triggered && !s.waivedBySector);

  return (
    <div className="space-y-4">
      <Panel bodyClassName="py-3">
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-6">
          <Stat
            label="İşə düşən stop faktorlar"
            value={a.activeStopFactors.length}
            tone={a.activeStopFactors.length > 0 ? 'bad' : 'good'}
          />
          <Stat label="Sektor istisnası tətbiq edilib" value={waived.length} tone={waived.length > 0 ? 'warn' : 'good'} />
          <Stat
            label="Siyasət pozuntuları"
            value={a.policy.breaches.length}
            tone={a.policy.breaches.length > 0 ? 'warn' : 'good'}
          />
          <Stat label="Siyasət istisnası tələb olunur" value={a.policy.exceptions.length} />
          <Stat label="Xəbərdarlıqlar" value={a.policy.warnings.length} />
          <Stat label="Ödənilən normalar" value={`${a.policy.passedCount} / ${a.policy.evaluatedCount}`} />
        </div>
      </Panel>

      <Panel
        title="Stop faktorlar"
        subtitle="Skorkartdan ayrıca qiymətləndirilir. Stop faktor aşağı bal deyil — obyektiv qiymətləndirməni mümkünsüz edən şərtdir."
        bodyClassName="px-0 py-0"
      >
        <DataTable
          className="mx-0"
          head={
            <tr>
              <Th align="center">Vəziyyət</Th>
              <Th>Qayda</Th>
              <Th>Müşahidə olunan dəyər</Th>
              <Th align="center">Avtomatik imtina</Th>
              <Th align="center">Eskalasiya</Th>
              <Th>Mənbə</Th>
            </tr>
          }
        >
          {[...a.activeStopFactors, ...waived, ...notTriggered].map((hit) => (
            <tr
              key={hit.rule.id}
              className={hit.triggered ? 'bg-rose-500/5' : hit.waivedBySector ? 'bg-amber-500/5' : undefined}
            >
              <Td align="center">
                {hit.triggered ? (
                  <Badge tone="rose">İşə düşüb</Badge>
                ) : hit.waivedBySector ? (
                  <Badge tone="amber">Sektor istisnası</Badge>
                ) : (
                  <Badge tone="emerald">Təmiz</Badge>
                )}
              </Td>
              <Td className="max-w-[360px]">
                <div className="font-medium text-slate-100">{hit.rule.labelAz}</div>
                <div className="mt-0.5 text-[10.5px] leading-relaxed text-slate-400">{hit.rule.description}</div>
                {hit.waivedBySector && (
                  <div className="mt-0.5 text-[10.5px] text-amber-300">
                    İstisna sektorları: {hit.rule.waivedForSectors?.join(', ')}
                  </div>
                )}
              </Td>
              <Td className="text-[10.5px]">{hit.observedValue}</Td>
              <Td align="center">{hit.rule.automaticRejection ? 'Bəli' : 'Xeyr'}</Td>
              <Td align="center">{hit.rule.escalationAllowed ? 'Mümkündür' : 'Yoxdur'}</Td>
              <Td className="max-w-[260px] text-[10px] leading-snug text-slate-500">
                <StatusBadge status={hit.rule.status} />
                <div className="mt-0.5">{hit.rule.sourceRef}</div>
                <div className="text-slate-600">{dateTimeAz(hit.evaluatedAt)}</div>
              </Td>
            </tr>
          ))}
        </DataTable>
      </Panel>

      <Panel
        title="Siyasət qaydaları"
        subtitle={`Siyasət versiyası: ${a.policy.policyVersion}. Alt-sektor qaydası sektor qaydasını, sektor qaydası baza qaydasını əvəz edir.`}
        bodyClassName="px-0 py-0"
      >
        <DataTable
          className="mx-0"
          head={
            <tr>
              <Th align="center">Nəticə</Th>
              <Th>Qayda</Th>
              <Th>Əhatə</Th>
              <Th align="right">Faktiki</Th>
              <Th align="right">Norma</Th>
              <Th align="center">Tədbir</Th>
              <Th>Mənbə</Th>
            </tr>
          }
        >
          {[...a.policy.breaches, ...a.policy.outcomes.filter((o) => o.passed)].map((o) => (
            <tr key={o.ruleId} className={o.passed ? undefined : 'bg-slate-900/40'}>
              <Td align="center">
                {o.passed ? <Badge tone="emerald">Ödənilir</Badge> : <SeverityBadge severity={o.severity} />}
              </Td>
              <Td className="max-w-[280px]">
                <div className="text-slate-200">{o.ruleName}</div>
                <div className="font-mono text-[9.5px] text-slate-600">{o.metric}</div>
              </Td>
              <Td className="text-[10.5px] text-slate-400">{o.scope}</Td>
              <Td align="right" className={o.passed ? '' : 'text-rose-300'}>
                {o.actual === null ? '—' : o.actual.toFixed(2)}
              </Td>
              <Td align="right">
                {operatorSymbol(o.operator)} {o.threshold}
              </Td>
              <Td align="center">
                <Badge
                  tone={
                    o.action === 'STOP' || o.action === 'REJECT'
                      ? 'rose'
                      : o.action === 'POLICY_EXCEPTION'
                        ? 'orange'
                        : o.action === 'WARNING'
                          ? 'amber'
                          : 'slate'
                  }
                >
                  {o.action}
                </Badge>
              </Td>
              <Td className="max-w-[280px] text-[10px] leading-snug text-slate-500">
                <StatusBadge status={o.status} />
                <div className="mt-0.5">{o.source}</div>
              </Td>
            </tr>
          ))}
        </DataTable>

        {a.policy.notEvaluated.length > 0 && (
          <div className="border-t border-slate-800 px-4 py-2.5">
            <div className="mb-1 text-[10px] uppercase tracking-wide text-slate-500">
              Qiymətləndirilə bilməyən qaydalar
            </div>
            <ul className="space-y-0.5">
              {a.policy.notEvaluated.map((n) => (
                <li key={n.ruleId} className="text-[10.5px] text-amber-300">
                  {n.ruleName} — {n.reason}
                </li>
              ))}
            </ul>
          </div>
        )}
      </Panel>

      <Panel
        title="Siyasət istisnaları"
        subtitle="Skorkart override ilə siyasət istisnası eyni şey deyil (§55)"
        bodyClassName="px-0 py-0"
      >
        {app.policyExceptions.length === 0 ? (
          <div className="px-4 py-3">
            {a.policy.exceptions.length > 0 ? (
              <div className="rounded border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-[11.5px] text-amber-200">
                {a.policy.exceptions.length} qayda pozulur və siyasət istisnası tələb edir, lakin hələ rəsmi istisna
                sorğusu qeydə alınmayıb:
                <ul className="mt-1 space-y-0.5">
                  {a.policy.exceptions.map((e) => (
                    <li key={e.ruleId} className="text-[10.5px] text-amber-300">
                      • {e.message}
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <EmptyState>Siyasət istisnası tələb olunmur.</EmptyState>
            )}
          </div>
        ) : (
          <DataTable
            className="mx-0"
            head={
              <tr>
                <Th>Qayda</Th>
                <Th align="right">Norma</Th>
                <Th align="right">Faktiki</Th>
                <Th>Tələb olunan güzəşt</Th>
                <Th>Əsaslandırma</Th>
                <Th>Mitiqant</Th>
                <Th>Təsdiq edən</Th>
                <Th align="center">Status</Th>
              </tr>
            }
          >
            {app.policyExceptions.map((e) => (
              <tr key={e.id}>
                <Td>{e.ruleName}</Td>
                <Td align="right">{e.threshold}</Td>
                <Td align="right">{e.actual ?? '—'}</Td>
                <Td>{e.requestedWaiver}</Td>
                <Td className="max-w-[240px] text-[10.5px]">{e.justification}</Td>
                <Td className="max-w-[240px] text-[10.5px]">{e.mitigant}</Td>
                <Td>{e.approver}</Td>
                <Td align="center">
                  <Badge tone={e.status === 'APPROVED' ? 'emerald' : e.status === 'REJECTED' ? 'rose' : 'amber'}>
                    {e.status}
                  </Badge>
                </Td>
              </tr>
            ))}
          </DataTable>
        )}
      </Panel>
    </div>
  );
}
