import { notFound } from 'next/navigation';
import { getCase } from '@/services/application-service';
import { cashFlowTotals, periodDscr } from '@/domain/calculations/statements';
import { buildSchedule } from '@/domain/calculations/amortisation';
import { DataTable, EmptyState, KeyValue, Panel, Stat, Td, Th } from '@/components/ui/primitives';
import { TracedCell } from '@/components/application/shared';
import { azn, aznFull, times } from '@/lib/format';
import type { CashFlowStatement } from '@/types/financials';

/** Current and forecast cash flow (§22-§23). */
export default async function CashFlowPage({ params }: { params: { id: string } }) {
  const c = await getCase(params.id);
  if (!c) notFound();
  const { application: app, assessment: a } = c;

  const cashPeriods = a.periods.filter((p) => app.cashFlows.some((cf) => cf.periodId === p.id));
  const cfByPeriod = new Map(app.cashFlows.map((cf) => [cf.periodId, cf]));

  const rows: Array<{ label: string; key: keyof CashFlowStatement; group: string }> = [
    { label: 'Dövrün əvvəlinə nağd vəsait', key: 'openingCash', group: 'Açılış' },
    { label: 'Satışdan daxilolmalar', key: 'customerReceipts', group: 'Əməliyyat' },
    { label: 'Təchizatçılara ödənişlər', key: 'supplierPayments', group: 'Əməliyyat' },
    { label: 'Əmək haqqı', key: 'payroll', group: 'Əməliyyat' },
    { label: 'İcarə', key: 'rent', group: 'Əməliyyat' },
    { label: 'Vergi ödənişləri', key: 'taxPaid', group: 'Əməliyyat' },
    { label: 'Digər əməliyyat xərcləri', key: 'otherOperatingExpenses', group: 'Əməliyyat' },
    { label: 'Ödənilmiş faizlər', key: 'interestPaid', group: 'Əməliyyat' },
    { label: 'İnvestisiya (CAPEX)', key: 'capex', group: 'İnvestisiya' },
    { label: 'Sahibkar qoyuluşu', key: 'ownerInjection', group: 'Maliyyə' },
    { label: 'Sahibkar çıxarışı', key: 'ownerWithdrawal', group: 'Maliyyə' },
    { label: 'Alınmış kreditlər', key: 'newBorrowing', group: 'Maliyyə' },
    { label: 'Ödənilmiş əsas borc', key: 'principalRepaid', group: 'Maliyyə' },
  ];

  const schedule = buildSchedule(app.proposedStructure ?? app.requestedStructure);

  return (
    <div className="space-y-4">
      <Panel title="Cari pul axını" subtitle="Faktiki daxilolma və çıxışlar — MZH ilə eyni anlayış deyil (§22)" bodyClassName="px-0 py-0">
        {cashPeriods.length === 0 ? (
          <div className="px-4 py-3">
            <EmptyState>Pul axını hesabatı daxil edilməyib.</EmptyState>
          </div>
        ) : (
          <DataTable
            className="mx-0"
            head={
              <tr>
                <Th>Maddə</Th>
                {cashPeriods.map((p) => (
                  <Th key={p.id} align="right">
                    {p.label}
                  </Th>
                ))}
              </tr>
            }
          >
            {rows.map((row) => (
              <tr key={row.key}>
                <Td>
                  <span className="text-[9.5px] uppercase tracking-wide text-slate-600">{row.group}</span>{' '}
                  {row.label}
                </Td>
                {cashPeriods.map((p) => (
                  <TracedCell key={p.id} value={cfByPeriod.get(p.id)?.[row.key] as never} />
                ))}
              </tr>
            ))}
            <tr className="bg-slate-900/60 font-medium">
              <Td className="text-slate-100">Xalis əməliyyat pul axını</Td>
              {cashPeriods.map((p) => {
                const cf = cfByPeriod.get(p.id);
                const t = cf ? cashFlowTotals(cf, a.lens) : null;
                return (
                  <Td
                    key={p.id}
                    align="right"
                    className={(t?.netOperatingCashFlow ?? 0) < 0 ? 'text-rose-300' : 'text-emerald-300'}
                  >
                    {azn(t?.netOperatingCashFlow ?? 0)}
                  </Td>
                );
              })}
            </tr>
            <tr>
              <Td>Dövrün sonuna nağd vəsait</Td>
              {cashPeriods.map((p) => {
                const cf = cfByPeriod.get(p.id);
                const t = cf ? cashFlowTotals(cf, a.lens) : null;
                return (
                  <Td key={p.id} align="right">
                    {azn(t?.endingCash ?? 0)}
                  </Td>
                );
              })}
            </tr>
            <tr>
              <Td className="text-slate-400">Borcun ödənilmə əmsalı (DSCR)</Td>
              {cashPeriods.map((p) => {
                const cf = cfByPeriod.get(p.id);
                const d = cf ? periodDscr(cf, a.lens) : null;
                return (
                  <Td
                    key={p.id}
                    align="right"
                    className={d === null ? '' : d < 1.5 ? 'text-amber-300' : 'text-emerald-300'}
                  >
                    {times(d)}
                  </Td>
                );
              })}
            </tr>
          </DataTable>
        )}
      </Panel>

      {a.forecast && (
        <>
          <Panel bodyClassName="py-3">
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
              <Stat
                label="Minimum aylıq qalıq"
                value={aznFull(a.forecast.minimumCash)}
                sub={a.forecast.minimumCashMonth}
                tone={a.forecast.minimumCash < 0 ? 'bad' : 'good'}
              />
              <Stat
                label="Mənfi aylar"
                value={a.forecast.negativeMonths}
                tone={a.forecast.negativeMonths > 0 ? 'bad' : 'good'}
              />
              <Stat label="Likvidlik boşluğu" value={aznFull(a.forecast.liquidityGap)} />
              <Stat
                label="Ən pis aylıq DSCR"
                value={times(a.forecast.worstMonthlyDscr)}
                tone={(a.forecast.worstMonthlyDscr ?? 0) < 1 ? 'bad' : 'good'}
              />
              <Stat label="Orta aylıq DSCR" value={times(a.forecast.averageMonthlyDscr)} />
            </div>
          </Panel>

          <Panel
            title="Proqnoz pul axını"
            subtitle="Kreditin müddətini əhatə edən aylıq proqnoz; mövsümilik indeksi tətbiq edilir (§23)"
            bodyClassName="px-0 py-0"
          >
            <DataTable
              className="mx-0"
              head={
                <tr>
                  <Th>Ay</Th>
                  <Th align="right">Açılış</Th>
                  <Th align="right">Daxilolma</Th>
                  <Th align="right">Təchizatçı</Th>
                  <Th align="right">Əmək haqqı</Th>
                  <Th align="right">Xərclər</Th>
                  <Th align="right">Vergi</Th>
                  <Th align="right">CAPEX</Th>
                  <Th align="right">Mövcud borc</Th>
                  <Th align="right">Yeni kredit</Th>
                  <Th align="right">Sahibkar</Th>
                  <Th align="right">Bağlanış</Th>
                </tr>
              }
            >
              {a.forecast.months.map((m) => (
                <tr key={m.index} className={m.closingCash < 0 ? 'bg-rose-500/5' : undefined}>
                  <Td>{m.label}</Td>
                  <Td align="right">{azn(m.openingCash)}</Td>
                  <Td align="right">{azn(m.salesReceipts)}</Td>
                  <Td align="right">{azn(m.supplierPayments)}</Td>
                  <Td align="right">{azn(m.payroll)}</Td>
                  <Td align="right">{azn(m.opex)}</Td>
                  <Td align="right">{azn(m.tax)}</Td>
                  <Td align="right">{azn(m.capex)}</Td>
                  <Td align="right">{azn(m.existingDebtPrincipal + m.existingDebtInterest)}</Td>
                  <Td align="right">{azn(m.newDebtPrincipal + m.newDebtInterest)}</Td>
                  <Td align="right">{azn(m.ownerWithdrawals)}</Td>
                  <Td align="right" className={m.closingCash < 0 ? 'font-medium text-rose-300' : 'text-slate-200'}>
                    {azn(m.closingCash)}
                  </Td>
                </tr>
              ))}
            </DataTable>
          </Panel>
        </>
      )}

      <Panel
        title="Təklif olunan kreditin ödəniş qrafiki"
        subtitle={`${schedule.rows.length} ay · ${(app.proposedStructure ?? app.requestedStructure).amortisation}`}
        bodyClassName="px-0 py-0"
      >
        <div className="border-b border-slate-800 px-4 py-2">
          <KeyValue
            items={[
              { label: 'Müntəzəm aylıq ödəniş', value: aznFull(schedule.regularPayment) },
              { label: 'İlk ödəniş', value: aznFull(schedule.firstPayment) },
              { label: 'Cəmi faiz', value: aznFull(schedule.totalInterest) },
              { label: 'Cəmi ödəniş', value: aznFull(schedule.totalPaid) },
            ]}
          />
        </div>
        <DataTable
          className="mx-0"
          head={
            <tr>
              <Th>Ay</Th>
              <Th align="right">Açılış qalığı</Th>
              <Th align="right">Ödəniş</Th>
              <Th align="right">Faiz</Th>
              <Th align="right">Əsas borc</Th>
              <Th align="right">Bağlanış qalığı</Th>
              <Th align="center">Güzəşt</Th>
            </tr>
          }
        >
          {schedule.rows.map((row) => (
            <tr key={row.month}>
              <Td>{row.month}</Td>
              <Td align="right">{azn(row.openingBalance)}</Td>
              <Td align="right">{azn(row.payment)}</Td>
              <Td align="right">{azn(row.interest)}</Td>
              <Td align="right">{azn(row.principal)}</Td>
              <Td align="right">{azn(row.closingBalance)}</Td>
              <Td align="center">{row.isGrace ? 'Bəli' : '—'}</Td>
            </tr>
          ))}
        </DataTable>
      </Panel>
    </div>
  );
}
