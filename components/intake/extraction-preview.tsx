'use client';

import { useMemo } from 'react';
import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import type { ParseResult } from '@/domain/intake/workbook-parser';
import { collapseByField } from '@/domain/intake/workbook-parser';
import type { BalanceField, CashFlowField, IncomeField } from '@/domain/intake/labels';
import { Badge, DataTable, EmptyState, Panel, Td, Th } from '@/components/ui/primitives';
import { azn } from '@/lib/format';
import { cn } from '@/lib/utils';

/**
 * Extraction preview and correction grid.
 *
 * The parser states what it found, where it found it and how sure it is, and
 * the analyst can overwrite any cell. Nothing is imported silently: a figure
 * the parser could not place shows as a gap the analyst has to fill, which is
 * the only honest way to hand machine-read financials to an underwriter.
 */

export interface Overrides {
  balance: Record<number, Partial<Record<BalanceField, number>>>;
  income: Record<number, Partial<Record<IncomeField, number>>>;
  cashFlow: Record<number, Partial<Record<CashFlowField, number>>>;
}

const BALANCE_ROWS: Array<{ field: BalanceField; label: string; group: string }> = [
  { field: 'cash', label: 'Likvid vəsaitlər', group: 'Aktivlər' },
  { field: 'receivables', label: 'Debitor borclar', group: 'Aktivlər' },
  { field: 'inventory', label: 'Mal-material ehtiyatları', group: 'Aktivlər' },
  { field: 'otherCurrentAssets', label: 'Digər dövriyyə aktivləri', group: 'Aktivlər' },
  { field: 'fixedAssets', label: 'Əsas vəsaitlər', group: 'Aktivlər' },
  { field: 'otherNonCurrentAssets', label: 'Digər uzunmüddətli aktivlər', group: 'Aktivlər' },
  { field: 'shortTermBankDebt', label: 'Qısamüddətli bank öhdəlikləri', group: 'Öhdəliklər' },
  { field: 'payables', label: 'Mal təchizatçıları', group: 'Öhdəliklər' },
  { field: 'otherCurrentLiabilities', label: 'Digər cari öhdəliklər', group: 'Öhdəliklər' },
  { field: 'longTermBankDebt', label: 'Uzunmüddətli bank öhdəlikləri', group: 'Öhdəliklər' },
  { field: 'otherLiabilities', label: 'Digər öhdəliklər', group: 'Öhdəliklər' },
  { field: 'shareCapital', label: 'Nizamnamə kapitalı', group: 'Kapital' },
  { field: 'retainedEarnings', label: 'Bölüşdürülməmiş mənfəət', group: 'Kapital' },
  { field: 'ownerContributions', label: 'Sahibkar qoyuluşu', group: 'Kapital' },
  { field: 'ownerWithdrawals', label: 'Sahibkar çıxarışı', group: 'Kapital' },
  { field: 'otherEquity', label: 'Digər kapital', group: 'Kapital' },
];

const INCOME_ROWS: Array<{ field: IncomeField; label: string }> = [
  { field: 'sales', label: 'Satış' },
  { field: 'cogs', label: 'Satışın maya dəyəri' },
  { field: 'operatingExpenses', label: 'Daimi xərclər' },
  { field: 'depreciation', label: 'Amortizasiya' },
  { field: 'interestExpense', label: 'Faiz xərcləri' },
  { field: 'otherIncome', label: 'Əlavə gəlirlər' },
  { field: 'otherExpenses', label: 'Digər xərclər' },
  { field: 'tax', label: 'Gəlir vergisi' },
];

const CASH_ROWS: Array<{ field: CashFlowField; label: string }> = [
  { field: 'openingCash', label: 'Dövrün əvvəlinə nağd' },
  { field: 'customerReceipts', label: 'Satışdan daxilolmalar' },
  { field: 'supplierPayments', label: 'Təchizatçılara ödənişlər' },
  { field: 'payroll', label: 'Əmək haqqı' },
  { field: 'rent', label: 'İcarə' },
  { field: 'taxPaid', label: 'Vergi ödənişləri' },
  { field: 'otherOperatingExpenses', label: 'Digər əməliyyat xərcləri' },
  { field: 'capex', label: 'İnvestisiya (CAPEX)' },
  { field: 'ownerInjection', label: 'Sahibkar qoyuluşu' },
  { field: 'ownerWithdrawal', label: 'Sahibkar çıxarışı' },
  { field: 'newBorrowing', label: 'Alınmış kreditlər' },
  { field: 'principalRepaid', label: 'Ödənilmiş əsas borc' },
  { field: 'interestPaid', label: 'Ödənilmiş faizlər' },
];

function ConfidenceDot({ confidence }: { confidence: number | null }) {
  if (confidence === null) {
    return <span title="Tapılmadı" className="inline-block h-1.5 w-1.5 rounded-full bg-rose-500" />;
  }
  const tone = confidence >= 0.85 ? 'bg-emerald-400' : confidence >= 0.7 ? 'bg-lime-400' : 'bg-amber-400';
  return (
    <span
      title={`Uyğunluq etibarlılığı: ${(confidence * 100).toFixed(0)}%`}
      className={cn('inline-block h-1.5 w-1.5 rounded-full', tone)}
    />
  );
}

export function ExtractionPreview({
  parse,
  selectedColumns,
  overrides,
  onOverride,
}: {
  parse: ParseResult;
  selectedColumns: number[];
  overrides: Overrides;
  onOverride: (next: Overrides) => void;
}) {
  const periods = parse.balance?.periods ?? parse.income?.periods ?? [];
  const shown = periods.filter((p) => selectedColumns.includes(p.columnIndex));

  const collapsed = useMemo(
    () => ({
      balance: shown.map((p) => collapseByField<BalanceField>(parse.balance, p.columnIndex)),
      income: shown.map((p) => collapseByField<IncomeField>(parse.income, p.columnIndex)),
      cashFlow: shown.map((p) => collapseByField<CashFlowField>(parse.cashFlow, p.columnIndex)),
    }),
    [parse, shown],
  );

  const setOverride = (
    statement: keyof Overrides,
    column: number,
    field: string,
    raw: string,
  ) => {
    const next: Overrides = {
      balance: { ...overrides.balance },
      income: { ...overrides.income },
      cashFlow: { ...overrides.cashFlow },
    };
    const bucket = { ...(next[statement][column] ?? {}) } as Record<string, number>;
    if (raw.trim() === '') delete bucket[field];
    else bucket[field] = Number(raw.replace(/\s/g, '').replace(',', '.')) || 0;
    next[statement][column] = bucket as never;
    onOverride(next);
  };

  const renderTable = <F extends string>(
    title: string,
    subtitle: string,
    statement: keyof Overrides,
    rows: Array<{ field: F; label: string; group?: string }>,
    data: Array<Partial<Record<F, { value: number; confidence: number; sources: string[] }>>>,
    found: boolean,
  ) => (
    <Panel
      title={title}
      subtitle={subtitle}
      actions={
        found ? (
          <span className="flex items-center gap-1 text-emerald-400">
            <CheckCircle2 className="h-3 w-3" /> vərəq tapıldı
          </span>
        ) : (
          <span className="flex items-center gap-1 text-rose-400">
            <AlertTriangle className="h-3 w-3" /> vərəq tapılmadı
          </span>
        )
      }
      bodyClassName="px-0 py-0"
    >
      {!found ? (
        <div className="px-4 py-3">
          <EmptyState>
            Bu hesabat oxunmadı. Dəyərləri aşağıdakı xanalara əl ilə daxil edə bilərsiniz.
          </EmptyState>
        </div>
      ) : null}
      <DataTable
        className="mx-0"
        head={
          <tr>
            <Th>Maddə</Th>
            {shown.map((p) => (
              <Th key={p.columnIndex} align="right">
                {p.label}
              </Th>
            ))}
          </tr>
        }
      >
        {rows.map((row, ri) => {
          const prevGroup = ri > 0 ? rows[ri - 1].group : undefined;
          const showGroup = row.group && row.group !== prevGroup;
          return (
            <tr key={row.field}>
              <Td>
                {showGroup && (
                  <div className="mb-0.5 text-[9.5px] uppercase tracking-wide text-slate-600">{row.group}</div>
                )}
                {row.label}
              </Td>
              {shown.map((p, pi) => {
                const hit = data[pi]?.[row.field];
                const override = (overrides[statement][p.columnIndex] as Record<string, number> | undefined)?.[
                  row.field
                ];
                const displayed = override !== undefined ? override : (hit?.value ?? '');
                return (
                  <Td key={p.columnIndex} align="right">
                    <div className="flex items-center justify-end gap-1.5">
                      <ConfidenceDot confidence={override !== undefined ? 1 : (hit?.confidence ?? null)} />
                      <input
                        value={displayed === '' ? '' : String(displayed)}
                        onChange={(e) => setOverride(statement, p.columnIndex, row.field, e.target.value)}
                        placeholder="—"
                        title={
                          hit
                            ? `Mənbə sətir: ${hit.sources.join(' + ')}`
                            : 'Parser bu sətri tapmadı — əl ilə daxil edin'
                        }
                        className={cn(
                          'w-28 rounded border bg-slate-950/60 px-1.5 py-1 text-right text-[11px] tabular-nums outline-none focus:border-sky-600',
                          override !== undefined
                            ? 'border-sky-700 text-sky-300'
                            : hit
                              ? 'border-slate-800 text-slate-200'
                              : 'border-rose-900/60 text-slate-400',
                        )}
                      />
                    </div>
                  </Td>
                );
              })}
            </tr>
          );
        })}
      </DataTable>
    </Panel>
  );

  return (
    <div className="space-y-4">
      <Panel title="Oxunmuş vərəqlər" subtitle="Fayldakı hər vərəq üçün tanınma nəticəsi">
        <div className="flex flex-wrap gap-1.5">
          {parse.sheetsSeen.map((s) => (
            <Badge key={s.name} tone={s.kind ? 'emerald' : 'slate'}>
              {s.name} {s.kind ? `· ${s.kind}` : '· tanınmadı'}
            </Badge>
          ))}
        </div>
        {parse.warnings.length > 0 && (
          <ul className="mt-2 space-y-0.5 border-t border-slate-800 pt-2">
            {parse.warnings.map((w, i) => (
              <li key={i} className="flex items-start gap-1.5 text-[10.5px] text-amber-300">
                <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
                {w}
              </li>
            ))}
          </ul>
        )}
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 border-t border-slate-800 pt-2 text-[10px] text-slate-500">
          <span className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> yüksək etibarlılıq
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-lime-400" /> orta
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-400" /> aşağı — yoxlayın
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-rose-500" /> tapılmadı
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-sky-400" /> əl ilə düzəldilib
          </span>
        </div>
      </Panel>

      {renderTable('Balans', 'Oxunmuş dəyərləri yoxlayın və lazım olduqda düzəldin', 'balance', BALANCE_ROWS, collapsed.balance, !!parse.balance)}
      {renderTable('Mənfəət və Zərər (MZH)', 'Satış, maya dəyəri və xərclər', 'income', INCOME_ROWS, collapsed.income, !!parse.income)}
      {renderTable('Pul axını', 'Faktiki daxilolma və çıxışlar', 'cashFlow', CASH_ROWS, collapsed.cashFlow, !!parse.cashFlow)}

      {parse.unmapped.length > 0 && (
        <Panel
          title="Uyğunlaşdırılmayan sətirlər"
          subtitle="Parser bu sətirləri heç bir maddəyə aid edə bilmədi — məlumat itirilmir, sadəcə avtomatik daxil edilmir"
          bodyClassName="px-0 py-0"
        >
          <DataTable
            className="mx-0"
            head={
              <tr>
                <Th>Vərəq</Th>
                <Th align="right">Sətir</Th>
                <Th>Etiket</Th>
                <Th align="right">Dəyərlər</Th>
              </tr>
            }
          >
            {parse.unmapped.slice(0, 40).map((u, i) => (
              <tr key={i}>
                <Td className="text-[10.5px] text-slate-400">{u.sheet}</Td>
                <Td align="right" className="text-slate-500">
                  {u.rowIndex + 1}
                </Td>
                <Td className="max-w-[420px] truncate">{u.label}</Td>
                <Td align="right" className="text-slate-400">
                  {u.values.map((v) => azn(v)).join(' · ')}
                </Td>
              </tr>
            ))}
          </DataTable>
          {parse.unmapped.length > 40 && (
            <div className="border-t border-slate-800 px-4 py-1.5 text-[10px] text-slate-500">
              Daha {parse.unmapped.length - 40} sətir göstərilmir.
            </div>
          )}
        </Panel>
      )}
    </div>
  );
}
