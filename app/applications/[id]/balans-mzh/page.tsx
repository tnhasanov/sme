import { notFound } from 'next/navigation';
import { getCase } from '@/services/application-service';
import { balanceTotals, incomeTotals } from '@/domain/calculations/statements';
import { DataTable, EmptyState, Panel, Td, Th } from '@/components/ui/primitives';
import { TracedCell } from '@/components/application/shared';
import { azn, aznFull, dateTimeAz, pct } from '@/lib/format';
import type { BalanceSheet, IncomeStatement } from '@/types/financials';

/** Balance sheet and income statement across every spread period (§19-§21). */
export default async function BalanceIncomePage({ params }: { params: { id: string } }) {
  const c = await getCase(params.id);
  if (!c) notFound();
  const { application: app, assessment: a } = c;

  const periods = a.periods.filter((p) => p.periodType !== 'FORECAST');
  if (periods.length === 0) {
    return <EmptyState>Bu sifariş üzrə maliyyə dövrləri daxil edilməyib.</EmptyState>;
  }

  const bsByPeriod = new Map(app.balanceSheets.map((b) => [b.periodId, b]));
  const isByPeriod = new Map(app.incomeStatements.map((i) => [i.periodId, i]));

  const bsRows: Array<{ label: string; key: keyof BalanceSheet; indent?: boolean }> = [
    { label: 'Likvid vəsaitlər', key: 'cash', indent: true },
    { label: 'Debitor borclar', key: 'receivables', indent: true },
    { label: 'Mal-material ehtiyatları', key: 'inventory', indent: true },
    { label: 'Digər dövriyyə aktivləri', key: 'otherCurrentAssets', indent: true },
    { label: 'Əsas vəsaitlər', key: 'fixedAssets', indent: true },
    { label: 'Digər uzunmüddətli aktivlər', key: 'otherNonCurrentAssets', indent: true },
  ];

  const liabRows: Array<{ label: string; key: keyof BalanceSheet; indent?: boolean }> = [
    { label: 'Qısamüddətli bank öhdəlikləri', key: 'shortTermBankDebt', indent: true },
    { label: 'Mal təchizatçıları', key: 'payables', indent: true },
    { label: 'Digər cari öhdəliklər', key: 'otherCurrentLiabilities', indent: true },
    { label: 'Uzunmüddətli bank öhdəlikləri', key: 'longTermBankDebt', indent: true },
    { label: 'Digər öhdəliklər', key: 'otherLiabilities', indent: true },
  ];

  const equityRows: Array<{ label: string; key: keyof BalanceSheet; indent?: boolean }> = [
    { label: 'Nizamnamə kapitalı', key: 'shareCapital', indent: true },
    { label: 'Bölüşdürülməmiş mənfəət', key: 'retainedEarnings', indent: true },
    { label: 'Sahibkar qoyuluşu', key: 'ownerContributions', indent: true },
    { label: 'Sahibkar çıxarışı', key: 'ownerWithdrawals', indent: true },
    { label: 'Digər kapital', key: 'otherEquity', indent: true },
  ];

  const isRows: Array<{ label: string; key: keyof IncomeStatement }> = [
    { label: 'Satış', key: 'sales' },
    { label: 'Satışın maya dəyəri', key: 'cogs' },
    { label: 'Daimi xərclər', key: 'operatingExpenses' },
    { label: 'Amortizasiya', key: 'depreciation' },
    { label: 'Faiz xərcləri', key: 'interestExpense' },
    { label: 'Əlavə gəlirlər', key: 'otherIncome' },
    { label: 'Digər xərclər', key: 'otherExpenses' },
    { label: 'Gəlir vergisi', key: 'tax' },
  ];

  const head = (
    <tr>
      <Th>Maddə</Th>
      {periods.map((p) => (
        <Th key={p.id} align="right">
          {p.label}
        </Th>
      ))}
    </tr>
  );

  const totalRow = (label: string, getter: (periodId: string) => number, emphasis = false) => (
    <tr className={emphasis ? 'bg-slate-900/60 font-medium text-slate-100' : 'bg-slate-900/30'}>
      <Td className={emphasis ? 'font-medium text-slate-100' : 'text-slate-200'}>{label}</Td>
      {periods.map((p) => (
        <Td key={p.id} align="right" className={emphasis ? 'font-medium text-slate-100' : 'text-slate-200'}>
          {azn(getter(p.id))}
        </Td>
      ))}
    </tr>
  );

  const bt = (periodId: string) => {
    const bs = bsByPeriod.get(periodId);
    return bs ? balanceTotals(bs, a.lens) : null;
  };
  const it = (periodId: string) => {
    const is = isByPeriod.get(periodId);
    return is ? incomeTotals(is, a.lens) : null;
  };

  return (
    <div className="space-y-4">
      <Panel
        title="Balans"
        subtitle="Hər rəqəmin yanındakı nöqtə təsdiq səviyyəsini göstərir — üzərinə klikləyərək mənbəni açın"
        actions={<span>Görünüş: {a.lens === 'ADJUSTED' ? 'Düzəliş edilmiş' : 'Bəyan edilmiş'}</span>}
        bodyClassName="px-0 py-0"
      >
        <DataTable className="mx-0" head={head}>
          <tr className="bg-slate-900/50">
            <Td className="font-medium text-slate-300" colSpan={periods.length + 1}>
              AKTİVLƏR
            </Td>
          </tr>
          {bsRows.map((row) => (
            <tr key={row.key}>
              <Td className={row.indent ? 'pl-6' : ''}>{row.label}</Td>
              {periods.map((p) => (
                <TracedCell key={p.id} value={bsByPeriod.get(p.id)?.[row.key] as never} />
              ))}
            </tr>
          ))}
          {totalRow('Dövriyyə vəsaitləri', (id) => bt(id)?.currentAssets ?? 0)}
          {totalRow('Cəmi aktivlər', (id) => bt(id)?.totalAssets ?? 0, true)}

          <tr className="bg-slate-900/50">
            <Td className="font-medium text-slate-300" colSpan={periods.length + 1}>
              ÖHDƏLİKLƏR
            </Td>
          </tr>
          {liabRows.map((row) => (
            <tr key={row.key}>
              <Td className={row.indent ? 'pl-6' : ''}>{row.label}</Td>
              {periods.map((p) => (
                <TracedCell key={p.id} value={bsByPeriod.get(p.id)?.[row.key] as never} />
              ))}
            </tr>
          ))}
          {totalRow('Qısamüddətli öhdəliklər', (id) => bt(id)?.currentLiabilities ?? 0)}
          {totalRow('Cəmi öhdəliklər', (id) => bt(id)?.totalLiabilities ?? 0, true)}

          <tr className="bg-slate-900/50">
            <Td className="font-medium text-slate-300" colSpan={periods.length + 1}>
              KAPİTAL
            </Td>
          </tr>
          {equityRows.map((row) => (
            <tr key={row.key}>
              <Td className={row.indent ? 'pl-6' : ''}>{row.label}</Td>
              {periods.map((p) => (
                <TracedCell key={p.id} value={bsByPeriod.get(p.id)?.[row.key] as never} />
              ))}
            </tr>
          ))}
          {totalRow('Şəxsi kapital', (id) => bt(id)?.totalEquity ?? 0, true)}
          {totalRow('İşlək kapital', (id) => bt(id)?.workingCapital ?? 0)}
          {totalRow('Balans yoxlaması (A − Ö − K)', (id) => bt(id)?.balanceCheck ?? 0)}
        </DataTable>
      </Panel>

      <Panel title="Mənfəət və Zərər Hesabatı (MZH)" subtitle="Income statement" bodyClassName="px-0 py-0">
        <DataTable className="mx-0" head={head}>
          {isRows.map((row) => (
            <tr key={row.key}>
              <Td>{row.label}</Td>
              {periods.map((p) => (
                <TracedCell key={p.id} value={isByPeriod.get(p.id)?.[row.key] as never} />
              ))}
            </tr>
          ))}
          {totalRow('Ümumi mənfəət', (id) => it(id)?.grossProfit ?? 0)}
          <tr>
            <Td className="text-slate-500">Ümumi mənfəət marjası</Td>
            {periods.map((p) => (
              <Td key={p.id} align="right" className="text-slate-500">
                {pct(it(p.id)?.grossMargin ?? null)}
              </Td>
            ))}
          </tr>
          {totalRow('EBITDA', (id) => it(id)?.ebitda ?? 0, true)}
          <tr>
            <Td className="text-slate-500">EBITDA marjası</Td>
            {periods.map((p) => (
              <Td key={p.id} align="right" className="text-slate-500">
                {pct(it(p.id)?.ebitdaMargin ?? null)}
              </Td>
            ))}
          </tr>
          {totalRow('EBIT', (id) => it(id)?.ebit ?? 0)}
          {totalRow('Vergidən əvvəlki mənfəət', (id) => it(id)?.profitBeforeTax ?? 0)}
          {totalRow('Xalis mənfəət', (id) => it(id)?.netProfit ?? 0, true)}
          <tr>
            <Td className="text-slate-500">Xalis mənfəət marjası</Td>
            {periods.map((p) => (
              <Td key={p.id} align="right" className="text-slate-500">
                {pct(it(p.id)?.netMargin ?? null)}
              </Td>
            ))}
          </tr>
        </DataTable>
      </Panel>

      <Panel
        title="Maliyyə düzəlişləri"
        subtitle="Orijinal məlumat heç vaxt üzərinə yazılmır — hər düzəliş ayrıca qeyd olunur (§24)"
        bodyClassName="px-0 py-0"
      >
        {app.adjustments.length === 0 ? (
          <div className="px-4 py-3">
            <EmptyState>Bu sifariş üzrə maliyyə düzəlişi edilməyib.</EmptyState>
          </div>
        ) : (
          <DataTable
            className="mx-0"
            head={
              <tr>
                <Th>Hesabat</Th>
                <Th>Maddə</Th>
                <Th align="right">Orijinal</Th>
                <Th align="right">Düzəliş edilmiş</Th>
                <Th align="right">Fərq</Th>
                <Th>Səbəb</Th>
                <Th>Analitik</Th>
              </tr>
            }
          >
            {app.adjustments.map((adj) => (
              <tr key={adj.id}>
                <Td>{adj.target}</Td>
                <Td>{adj.field}</Td>
                <Td align="right">{aznFull(adj.originalValue)}</Td>
                <Td align="right" className="text-sky-300">
                  {aznFull(adj.adjustedValue)}
                </Td>
                <Td align="right" className={adj.difference < 0 ? 'text-rose-300' : 'text-emerald-300'}>
                  {aznFull(adj.difference)}
                </Td>
                <Td className="max-w-[320px]">
                  <div className="font-mono text-[10px] text-slate-400">{adj.reason}</div>
                  <div className="text-[10.5px] leading-snug text-slate-400">{adj.narrative}</div>
                </Td>
                <Td className="text-[10.5px]">
                  {adj.analyst}
                  <div className="text-slate-500">{dateTimeAz(adj.createdAt)}</div>
                </Td>
              </tr>
            ))}
          </DataTable>
        )}
      </Panel>
    </div>
  );
}
