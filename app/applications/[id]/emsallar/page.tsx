import { notFound } from 'next/navigation';
import { getCase } from '@/services/application-service';
import { Badge, DataTable, Panel, StatusBadge, Td, Th } from '@/components/ui/primitives';
import { MetricExplain } from '@/components/application/shared';
import { formatValue, operatorSymbol } from '@/domain/rules/policy-engine';
import { metricValue } from '@/lib/format';

const GROUPS: Array<{ title: string; en: string; keys: string[] }> = [
  {
    title: 'Rentabellik',
    en: 'Profitability',
    keys: ['grossMargin', 'ebitdaMargin', 'netMargin', 'roa', 'roe'],
  },
  { title: 'Likvidlik', en: 'Liquidity', keys: ['currentRatio', 'quickRatio', 'cashRatio'] },
  {
    title: 'Borc yükü',
    en: 'Leverage',
    keys: [
      'debtToEquityInclNew',
      'debtToEquity',
      'leverage',
      'gearing',
      'liabilitiesToAssets',
      'equityToAssets',
      'debtToEbitda',
      'netDebtToEbitda',
    ],
  },
  {
    title: 'Borc xidməti',
    en: 'Debt service',
    keys: ['dscrCurrent', 'interestCoverage', 'ebitdaToInterest', 'cashCoverageOfBankDebt', 'minForecastClosingCash'],
  },
  {
    title: 'İşlək kapital',
    en: 'Working capital',
    keys: [
      'workingCapital',
      'workingCapitalToSales',
      'workingCapitalTurnover',
      'receivableDays',
      'inventoryDays',
      'creditorDays',
      'cashConversionCycle',
    ],
  },
  { title: 'Səmərəlilik', en: 'Efficiency', keys: ['assetTurnover', 'inventoryTurnover', 'breakevenPoint'] },
];

/** Financial ratios with per-ratio explainability and sector policy limits (§25-§27). */
export default async function RatiosPage({ params }: { params: { id: string } }) {
  const c = await getCase(params.id);
  if (!c) notFound();
  const { customer, assessment: a } = c;

  return (
    <div className="space-y-4">
      <Panel
        title="Sektor limitləri"
        subtitle={`${customer.sector} / ${customer.subSector} üzrə tətbiq edilən qaydalar. Alt-sektor qaydası baza qaydasını əvəz edir.`}
        actions={
          <span>
            {a.policy.passedCount}/{a.policy.evaluatedCount} norma ödənilir
          </span>
        }
      >
        {a.policy.notEvaluated.length > 0 && (
          <div className="rounded border border-amber-500/30 bg-amber-500/5 px-2.5 py-1.5 text-[10.5px] text-amber-300">
            {a.policy.notEvaluated.length} qayda qiymətləndirilə bilmədi — göstərici hesablanmır:{' '}
            {a.policy.notEvaluated.map((n) => n.ruleName).join(', ')}
          </div>
        )}
      </Panel>

      {GROUPS.map((group) => (
        <Panel key={group.title} title={group.title} subtitle={group.en} bodyClassName="px-0 py-0">
          <DataTable
            className="mx-0"
            head={
              <tr>
                <Th>Göstərici</Th>
                <Th align="right">Cari dövr</Th>
                <Th align="right">Əvvəlki dövr</Th>
                <Th align="right">Norma</Th>
                <Th align="center">Nəticə</Th>
                <Th>Mənbə</Th>
              </tr>
            }
          >
            {group.keys.map((key) => {
              const m = a.ratios[key];
              const prev = a.previousRatios[key];
              const outcome = a.policy.outcomes.find((o) => o.metric === key);
              if (!m) return null;
              return (
                <tr key={key}>
                  <Td>
                    <span title={m.labelEn} className="text-slate-200">
                      {m.label}
                    </span>
                    <div className="text-[10px] text-slate-500">{m.labelEn}</div>
                  </Td>
                  <Td align="right" className="w-40">
                    <MetricExplain metric={m} outcome={outcome} />
                  </Td>
                  <Td align="right" className="text-slate-500">
                    {metricValue(prev)}
                  </Td>
                  <Td align="right">
                    {outcome
                      ? `${operatorSymbol(outcome.operator)} ${formatValue(outcome.threshold, m.unit === 'SCORE' ? 'RATIO' : m.unit)}`
                      : '—'}
                  </Td>
                  <Td align="center">
                    {!outcome ? (
                      <span className="text-slate-600">—</span>
                    ) : outcome.passed ? (
                      <Badge tone="emerald">Ödənilir</Badge>
                    ) : (
                      <Badge tone={outcome.action === 'STOP' ? 'rose' : 'orange'}>
                        {outcome.action === 'STOP' ? 'STOP' : 'Pozulur'}
                      </Badge>
                    )}
                  </Td>
                  <Td className="max-w-[300px] text-[10px] leading-snug text-slate-500">
                    {outcome ? (
                      <div className="flex items-start gap-1.5">
                        <StatusBadge status={outcome.status} />
                        <span>{outcome.source}</span>
                      </div>
                    ) : (
                      m.source
                    )}
                  </Td>
                </tr>
              );
            })}
          </DataTable>
        </Panel>
      ))}
    </div>
  );
}
