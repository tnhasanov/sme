import { notFound } from 'next/navigation';
import { getCase } from '@/services/application-service';
import { assessApplication } from '@/services/assessment';
import { AUTHORITY_LABEL_AZ, WORKFLOW_VERSIONS } from '@/config/workflow';
import {
  Badge,
  DataTable,
  EmptyState,
  KeyValue,
  Panel,
  Stat,
  StatusBadge,
  Td,
  Th,
} from '@/components/ui/primitives';
import { aznFull, DECISION_LABEL_AZ, dateTimeAz, pct } from '@/lib/format';

/**
 * Approval routing (§49-§52) and the committee decision.
 *
 * The comparison table re-runs the routing engine under every seeded workflow
 * version so the reader can see exactly what the proposals would change,
 * without any version being presented as approved policy.
 */
export default async function ApprovalPage({ params }: { params: { id: string } }) {
  const c = await getCase(params.id);
  if (!c) notFound();
  const { application: app, customer, assessment: a } = c;

  const comparison = Object.values(WORKFLOW_VERSIONS).map((wf) => ({
    workflow: wf,
    result: assessApplication(app, customer, { workflowVersionId: wf.id }).routing,
  }));

  return (
    <div className="space-y-4">
      <Panel bodyClassName="py-3">
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
          <Stat
            label="Post-əməliyyat qrup ekspozisiyası"
            value={aznFull(a.groupExposure.postTransactionGroupExposure)}
          />
          <Stat label="Seqment" value={a.rating.segment === 'MEDIUM' ? 'Orta (İri)' : 'Kiçik'} />
          <Stat
            label="Uyğun girov örtüyü"
            value={a.collateral.eligibleCoverage === null ? '—' : pct(a.collateral.eligibleCoverage)}
          />
          <Stat
            label="Yekun daxili reytinq"
            value={a.rating.finalGradeLabelAz}
            tone={a.rating.isWorstRating ? 'bad' : 'good'}
          />
          <Stat
            label="Stop faktor / istisna"
            value={`${a.activeStopFactors.length} / ${a.policy.exceptions.length}`}
            tone={a.activeStopFactors.length > 0 ? 'bad' : 'default'}
          />
        </div>
      </Panel>

      <Panel
        title="Niyə bu sifariş bu komitəyə gedir?"
        subtitle="Marşrutlaşdırma yalnız məbləğə deyil, ekspozisiya, girov, reytinq və stop faktorlara əsaslanır"
        actions={<StatusBadge status={a.routing.workflowStatus} />}
      >
        <div className="mb-3 grid gap-3 md:grid-cols-3">
          <div className="rounded border border-slate-800 bg-slate-950/40 p-3">
            <div className="text-[10px] uppercase tracking-wide text-slate-500">Qiymətləndirmə səlahiyyəti</div>
            <div className="mt-1 text-[12px] font-medium text-slate-100">
              {a.routing.assessmentAuthority ? AUTHORITY_LABEL_AZ[a.routing.assessmentAuthority] : '—'}
            </div>
          </div>
          <div className="rounded border border-sky-500/25 bg-sky-500/5 p-3">
            <div className="text-[10px] uppercase tracking-wide text-slate-500">Qərar səlahiyyəti</div>
            <div className="mt-1 text-[12px] font-semibold text-sky-300">
              {a.routing.decisionAuthority ? AUTHORITY_LABEL_AZ[a.routing.decisionAuthority] : '—'}
            </div>
          </div>
          <div className="rounded border border-slate-800 bg-slate-950/40 p-3">
            <div className="text-[10px] uppercase tracking-wide text-slate-500">Eskalasiya səlahiyyəti</div>
            <div className="mt-1 text-[12px] font-medium text-slate-100">
              {a.routing.escalationAuthorityLabel ?? 'Tətbiq edilmir'}
            </div>
          </div>
        </div>

        <ul className="space-y-1">
          {a.routing.reasons.map((r, i) => (
            <li key={i} className="flex gap-2 text-[11.5px] leading-relaxed text-slate-300">
              <span className="mt-[6px] h-1 w-1 shrink-0 rounded-full bg-slate-600" />
              {r}
            </li>
          ))}
        </ul>

        <div className="mt-3 border-t border-slate-800 pt-2">
          <KeyValue
            items={[
              { label: 'Workflow versiyası', value: `${a.routing.workflowLabel} (${a.routing.workflowVersion})` },
              { label: 'Marşrut intervalı', value: a.routing.bucketLabelAz },
              {
                label: 'Tətbiq olunan notching təbəqələri',
                value: a.routing.notchingLayers.length ? a.routing.notchingLayers.join(' + ') : 'Yoxdur',
              },
              { label: 'Şərt operatoru', value: a.routing.operatorUsed === 'OR' ? 'VƏ YA' : 'VƏ' },
            ]}
          />
        </div>
      </Panel>

      <Panel
        title="Workflow versiyalarının müqayisəsi"
        subtitle="Eyni sifariş hər versiya üzrə yenidən marşrutlaşdırılır — heç bir təklif təsdiqlənmiş siyasət kimi təqdim edilmir"
        bodyClassName="px-0 py-0"
      >
        <DataTable
          className="mx-0"
          head={
            <tr>
              <Th>Versiya</Th>
              <Th align="center">Status</Th>
              <Th>Marşrut intervalı</Th>
              <Th>Qiymətləndirmə</Th>
              <Th>Qərar</Th>
              <Th align="center">Eskalasiya</Th>
              <Th>Notching</Th>
            </tr>
          }
        >
          {comparison.map(({ workflow, result }) => (
            <tr key={workflow.id} className={workflow.id === a.routing.workflowVersion ? 'bg-sky-500/5' : undefined}>
              <Td>
                <div className={workflow.id === a.routing.workflowVersion ? 'font-medium text-sky-300' : ''}>
                  {workflow.label}
                </div>
                <div className="font-mono text-[9.5px] text-slate-600">{workflow.id}</div>
              </Td>
              <Td align="center">
                <StatusBadge status={workflow.status} />
              </Td>
              <Td className="text-[10.5px]">{result.bucketLabelAz}</Td>
              <Td className="text-[10.5px]">{result.assessmentAuthorityLabel}</Td>
              <Td className="text-[10.5px] font-medium text-slate-200">{result.decisionAuthorityLabel}</Td>
              <Td align="center">{result.escalated ? <Badge tone="amber">Bəli</Badge> : '—'}</Td>
              <Td className="text-[10.5px] text-slate-400">
                {result.notchingLayers.length ? result.notchingLayers.join(' + ') : '—'}
              </Td>
            </tr>
          ))}
        </DataTable>
      </Panel>

      {a.routing.ambiguities.length > 0 && (
        <Panel
          title="Həll edilməmiş məsələlər"
          subtitle="Mənbə sənədlərdəki ziddiyyətlər — konfiqurasiya ilə idarə olunur, səssiz həll edilmir"
        >
          <ul className="space-y-1.5">
            {a.routing.ambiguities.map((amb, i) => (
              <li key={i} className="flex gap-2 text-[11.5px] leading-relaxed text-amber-200">
                <span className="mt-[6px] h-1 w-1 shrink-0 rounded-full bg-amber-400" />
                {amb}
              </li>
            ))}
          </ul>
        </Panel>
      )}

      <Panel title="Komitə qərarı" subtitle="Qərar əsaslandırması məcburidir (§61)">
        {app.committeeDecision ? (
          <>
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <Badge
                tone={
                  app.committeeDecision.decision === 'DECLINE'
                    ? 'rose'
                    : app.committeeDecision.decision === 'APPROVE'
                      ? 'emerald'
                      : 'amber'
                }
              >
                {DECISION_LABEL_AZ[app.committeeDecision.decision]}
              </Badge>
              {app.committeeDecision.approvedAmount !== undefined && (
                <span className="text-[12px] text-slate-200">
                  Təsdiq edilmiş məbləğ: {aznFull(app.committeeDecision.approvedAmount)}
                </span>
              )}
            </div>
            <KeyValue
              items={[
                { label: 'Səlahiyyət', value: app.committeeDecision.authority },
                { label: 'Qərar verən', value: app.committeeDecision.decidedBy },
                { label: 'Tarix', value: dateTimeAz(app.committeeDecision.decidedAt) },
                { label: 'Əsaslandırma', value: app.committeeDecision.rationale },
              ]}
            />
          </>
        ) : (
          <EmptyState>
            Komitə qərarı hələ qeydə alınmayıb. Sifariş {a.routing.decisionAuthority ? AUTHORITY_LABEL_AZ[a.routing.decisionAuthority] : '—'} səviyyəsində baxılmalıdır.
          </EmptyState>
        )}
      </Panel>

      <Panel title="Emal müddəti (TAT)" subtitle="Pipeline / SLA (§63)">
        <KeyValue
          items={[
            { label: 'Sifariş daxil olub', value: dateTimeAz(app.pipeline.receivedAt) },
            { label: 'Anderraytinqə təyin edilib', value: dateTimeAz(app.pipeline.assignedToUwAt) },
            { label: 'Anderraytinq tamamlanıb', value: dateTimeAz(app.pipeline.uwCompletedAt) },
            { label: 'Komitəyə çıxarılıb', value: dateTimeAz(app.pipeline.committeeAt) },
            { label: 'Qərar verilib', value: dateTimeAz(app.pipeline.decidedAt) },
            { label: 'Geri qaytarma sayı', value: app.pipeline.returnCount },
            { label: 'Gözləmə səbəbi', value: app.pipeline.waitingReason ?? '—' },
            {
              label: 'Çatışmayan sənədlər',
              value: app.pipeline.missingDocuments.join(', ') || '—',
            },
          ]}
        />
      </Panel>
    </div>
  );
}
