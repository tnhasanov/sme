import { notFound } from 'next/navigation';
import { getCase } from '@/services/application-service';
import { Badge, DataTable, EmptyState, KeyValue, Panel, Td, Th } from '@/components/ui/primitives';
import { dateTimeAz } from '@/lib/format';

const CATEGORY_LABEL_AZ: Record<string, string> = {
  FINANCIAL_ADJUSTMENT: 'Maliyyə düzəlişi',
  BUREAU_UPDATE: 'AKB yenilənməsi',
  RATING: 'Reytinq',
  NOTCHING: 'Notching',
  OVERRIDE: 'Override',
  POLICY_EXCEPTION: 'Siyasət istisnası',
  STRUCTURE: 'Struktur',
  DECISION: 'Qərar',
  WORKFLOW: 'Workflow',
  DATA_ENTRY: 'Məlumat daxiletmə',
};

/** Immutable audit trail and version governance (§53, §62). */
export default async function AuditPage({ params }: { params: { id: string } }) {
  const c = await getCase(params.id);
  if (!c) notFound();
  const { application: app, assessment: a } = c;

  const entries = [...app.auditTrail].sort((x, y) => y.timestamp.localeCompare(x.timestamp));

  return (
    <div className="space-y-4">
      <Panel
        title="Dondurulmuş versiyalar"
        subtitle="Sifariş üzrə istifadə olunan versiyalar saxlanılır — siyasət sonradan dəyişsə də tarixi nəticə dəyişmir (§4)"
      >
        <KeyValue
          items={[
            { label: 'Workflow versiyası', value: `${a.versions.workflowLabel} (${a.versions.workflow})` },
            { label: 'Skorkart versiyası', value: a.versions.scorecard },
            { label: 'Legacy skorkart (Yekun Rəy)', value: a.versions.legacyScorecard },
            { label: 'Siyasət versiyası', value: a.versions.policy },
            { label: 'AKB reytinq şkalası', value: a.versions.acbScale },
            { label: 'Notching konfiqurasiyası', value: a.versions.notching },
            { label: '"Ən zəif reytinq" tərifi', value: a.versions.worstRating },
          ]}
        />
      </Panel>

      <Panel
        title="Model icra qeydi"
        subtitle="Hər skor çıxışı üçün giriş, ilkin nəticə, notch-lar və yekun nəticə saxlanılır (§53)"
      >
        <KeyValue
          items={[
            { label: 'İcra vaxtı', value: a.rating.executedAt },
            { label: 'İlkin reytinq (AKB)', value: a.rating.initialGrade ?? '—' },
            { label: 'Biznes düzəlişi', value: `${a.rating.business.notch} pillə` },
            { label: 'Maliyyə düzəlişi', value: `${a.rating.financial.notch} pillə` },
            {
              label: 'Kumulyativ limit tətbiqi',
              value: a.rating.cappedAt === null ? 'Tətbiq edilməyib' : `${a.rating.cappedAt} pillə ilə məhdudlaşdırılıb`,
            },
            { label: 'Hesablanmış reytinq', value: a.rating.calculatedGrade ?? '—' },
            { label: 'Yekun reytinq', value: a.rating.finalGrade ?? '—' },
            { label: 'Override tətbiq edilib', value: a.rating.overrideApplied ? 'Bəli' : 'Xeyr' },
          ]}
        />
        {app.ratingOverride && (
          <div className="mt-3 rounded border border-amber-500/30 bg-amber-500/5 px-3 py-2">
            <div className="mb-1 text-[10px] uppercase tracking-wide text-slate-500">Override təfərrüatları</div>
            <KeyValue
              items={[
                { label: 'Hesablanmış', value: app.ratingOverride.calculatedGrade },
                { label: 'Override', value: app.ratingOverride.overrideGrade },
                { label: 'İstiqamət', value: app.ratingOverride.direction },
                { label: 'Səbəb', value: app.ratingOverride.reason },
                { label: 'Sorğu edən', value: app.ratingOverride.requestedBy },
                { label: 'Təsdiq edən', value: app.ratingOverride.approver },
                { label: 'Tarix', value: dateTimeAz(app.ratingOverride.approvedAt) },
              ]}
            />
          </div>
        )}
      </Panel>

      <Panel
        title="Audit izi"
        subtitle="Dəyişməz qeyd: sahə, köhnə dəyər, yeni dəyər, istifadəçi, vaxt və səbəb"
        bodyClassName="px-0 py-0"
      >
        {entries.length === 0 ? (
          <div className="px-4 py-3">
            <EmptyState>Bu sifariş üzrə audit qeydi yoxdur.</EmptyState>
          </div>
        ) : (
          <DataTable
            className="mx-0"
            head={
              <tr>
                <Th>Vaxt</Th>
                <Th>Kateqoriya</Th>
                <Th>Obyekt / sahə</Th>
                <Th align="right">Köhnə dəyər</Th>
                <Th align="right">Yeni dəyər</Th>
                <Th>İstifadəçi</Th>
                <Th>Səbəb</Th>
              </tr>
            }
          >
            {entries.map((e) => (
              <tr key={e.id}>
                <Td className="whitespace-nowrap text-[10.5px]">{dateTimeAz(e.timestamp)}</Td>
                <Td>
                  <Badge tone={e.category === 'FINANCIAL_ADJUSTMENT' ? 'sky' : 'slate'}>
                    {CATEGORY_LABEL_AZ[e.category] ?? e.category}
                  </Badge>
                </Td>
                <Td>
                  {e.entity}
                  <div className="font-mono text-[10px] text-slate-500">{e.field}</div>
                </Td>
                <Td align="right">{e.oldValue ?? '—'}</Td>
                <Td align="right" className="text-sky-300">
                  {e.newValue ?? '—'}
                </Td>
                <Td className="text-[10.5px]">
                  {e.user}
                  <div className="text-slate-500">{e.role}</div>
                </Td>
                <Td className="max-w-[280px] text-[10.5px] leading-snug text-slate-400">{e.reason ?? '—'}</Td>
              </tr>
            ))}
          </DataTable>
        )}
      </Panel>
    </div>
  );
}
