import { notFound } from 'next/navigation';
import { getCase } from '@/services/application-service';
import { DataTable, EmptyState, Panel, Td, Th } from '@/components/ui/primitives';
import { azn, metricValue, pct } from '@/lib/format';

/** Comparative analysis against the previous period (§33). */
export default async function ComparativePage({ params }: { params: { id: string } }) {
  const c = await getCase(params.id);
  if (!c) notFound();
  const { assessment: a } = c;

  if (!a.previousIncome || !a.previousBalance || !a.income || !a.balance) {
    return <EmptyState>Müqayisə üçün əvvəlki dövr məlumatı mövcud deyil.</EmptyState>;
  }

  const MATERIAL_CHANGE = 0.15;

  const absoluteRows: Array<{ label: string; current: number; previous: number; inverse?: boolean }> = [
    { label: 'Satış', current: a.income.sales, previous: a.previousIncome.sales },
    { label: 'Ümumi mənfəət', current: a.income.grossProfit, previous: a.previousIncome.grossProfit },
    { label: 'EBITDA', current: a.income.ebitda, previous: a.previousIncome.ebitda },
    { label: 'Xalis mənfəət', current: a.income.netProfit, previous: a.previousIncome.netProfit },
    { label: 'Likvid vəsaitlər', current: a.balance.cash, previous: a.previousBalance.cash },
    { label: 'Debitor borclar', current: a.balance.receivables, previous: a.previousBalance.receivables, inverse: true },
    { label: 'Mal ehtiyatları', current: a.balance.inventory, previous: a.previousBalance.inventory, inverse: true },
    { label: 'Təchizatçı öhdəlikləri', current: a.balance.payables, previous: a.previousBalance.payables },
    { label: 'Bank öhdəlikləri', current: a.balance.totalBankDebt, previous: a.previousBalance.totalBankDebt, inverse: true },
    { label: 'Şəxsi kapital', current: a.balance.totalEquity, previous: a.previousBalance.totalEquity },
    { label: 'İşlək kapital', current: a.balance.workingCapital, previous: a.previousBalance.workingCapital },
  ];

  const ratioKeys = [
    'currentRatio',
    'quickRatio',
    'debtToEbitda',
    'debtToEquity',
    'gearing',
    'ebitdaMargin',
    'netMargin',
    'roa',
    'roe',
    'receivableDays',
    'inventoryDays',
    'creditorDays',
    'cashConversionCycle',
    'assetTurnover',
  ];

  return (
    <div className="space-y-4">
      <Panel
        title="Müqayisəli təhlil"
        subtitle={`${a.previousPeriod?.label ?? 'Əvvəlki dövr'} → ${a.primaryPeriod?.label ?? 'Cari dövr'}. ${pct(MATERIAL_CHANGE, 0)}-dən artıq dəyişiklik izah tələb edir.`}
        bodyClassName="px-0 py-0"
      >
        <DataTable
          className="mx-0"
          head={
            <tr>
              <Th>Göstərici</Th>
              <Th align="right">Əvvəlki</Th>
              <Th align="right">Cari</Th>
              <Th align="right">Dəyişiklik</Th>
              <Th align="right">%</Th>
              <Th>Şərh</Th>
            </tr>
          }
        >
          {absoluteRows.map((row) => {
            const change = row.current - row.previous;
            const changePct = row.previous !== 0 ? change / Math.abs(row.previous) : null;
            const material = changePct !== null && Math.abs(changePct) > MATERIAL_CHANGE;
            const adverse = row.inverse ? change > 0 : change < 0;
            return (
              <tr key={row.label} className={material ? 'bg-slate-900/40' : undefined}>
                <Td>{row.label}</Td>
                <Td align="right">{azn(row.previous)}</Td>
                <Td align="right">{azn(row.current)}</Td>
                <Td align="right" className={material ? (adverse ? 'text-rose-300' : 'text-emerald-300') : ''}>
                  {azn(change)}
                </Td>
                <Td align="right" className={material ? (adverse ? 'text-rose-300' : 'text-emerald-300') : ''}>
                  {changePct === null ? '—' : pct(changePct)}
                </Td>
                <Td className="text-[10.5px] text-slate-500">
                  {material
                    ? adverse
                      ? 'Material mənfi dəyişiklik — izah tələb olunur.'
                      : 'Material müsbət dəyişiklik.'
                    : 'Material dəyişiklik yoxdur.'}
                </Td>
              </tr>
            );
          })}
        </DataTable>
      </Panel>

      <Panel title="Əmsalların dinamikası" bodyClassName="px-0 py-0">
        <DataTable
          className="mx-0"
          head={
            <tr>
              <Th>Əmsal</Th>
              <Th align="right">Əvvəlki</Th>
              <Th align="right">Cari</Th>
              <Th align="right">Dəyişiklik</Th>
              <Th>Norma vəziyyəti</Th>
            </tr>
          }
        >
          {ratioKeys.map((key) => {
            const cur = a.ratios[key];
            const prev = a.previousRatios[key];
            const outcome = a.policy.outcomes.find((o) => o.metric === key);
            if (!cur) return null;
            const delta =
              cur.value !== null && prev?.value !== null && prev?.value !== undefined
                ? cur.value - prev.value
                : null;
            return (
              <tr key={key}>
                <Td>
                  <span title={cur.labelEn}>{cur.label}</span>
                </Td>
                <Td align="right" className="text-slate-500">
                  {metricValue(prev)}
                </Td>
                <Td align="right">{metricValue(cur)}</Td>
                <Td align="right" className={delta === null ? '' : delta > 0 ? 'text-sky-300' : 'text-amber-300'}>
                  {delta === null
                    ? '—'
                    : cur.unit === 'PERCENT'
                      ? pct(delta)
                      : cur.unit === 'DAYS'
                        ? `${delta.toFixed(0)} gün`
                        : delta.toFixed(2)}
                </Td>
                <Td className="text-[10.5px]">
                  {!outcome ? (
                    <span className="text-slate-600">Norma müəyyən edilməyib</span>
                  ) : outcome.passed ? (
                    <span className="text-emerald-300">Norma ödənilir</span>
                  ) : (
                    <span className="text-rose-300">{outcome.message}</span>
                  )}
                </Td>
              </tr>
            );
          })}
        </DataTable>
      </Panel>

      <Panel title="Analitik şərh" subtitle="Qayda əsaslı — LLM istifadə edilmir (§81)">
        {a.commentary.length === 0 ? (
          <EmptyState>Şərh yaradılmayıb.</EmptyState>
        ) : (
          <ul className="space-y-1.5">
            {a.commentary.map((line, i) => (
              <li key={i} className="flex gap-2 text-[12px] leading-relaxed text-slate-300">
                <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-sky-500" />
                {line}
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
