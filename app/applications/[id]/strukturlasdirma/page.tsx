import { notFound } from 'next/navigation';
import { getCase } from '@/services/application-service';
import { loanFromPayment, maxSustainableLoan, steadyStateMonthlyPayment } from '@/domain/calculations/amortisation';
import { Badge, DataTable, EmptyState, KeyValue, Panel, Stat, Td, Th } from '@/components/ui/primitives';
import { azn, aznFull, pct, times } from '@/lib/format';

/** Repayment capacity, structuring alternatives and stress testing (§34-§36). */
export default async function StructuringPage({ params }: { params: { id: string } }) {
  const c = await getCase(params.id);
  if (!c) notFound();
  const { application: app, assessment: a } = c;
  const rc = a.repayment;
  const structure = app.proposedStructure ?? app.requestedStructure;

  if (!rc) return <EmptyState>Ödəmə qabiliyyəti hesablanması üçün maliyyə məlumatı kifayət etmir.</EmptyState>;

  /* Alternative structures, all solved through the same engine. */
  const alternatives = [
    { label: 'Tələb olunan struktur', amount: structure.amount, tenor: structure.tenorMonths },
    { label: 'Uzadılmış müddət (+24 ay)', amount: structure.amount, tenor: structure.tenorMonths + 24 },
    { label: 'Azaldılmış məbləğ (−25%)', amount: structure.amount * 0.75, tenor: structure.tenorMonths },
    { label: 'Azaldılmış məbləğ (−40%)', amount: structure.amount * 0.6, tenor: structure.tenorMonths },
    {
      label: 'Maksimum dayanıqlı məbləğ',
      amount: a.maxLoan?.maxSustainableLoan ?? 0,
      tenor: structure.tenorMonths,
    },
    {
      label: 'Yalnız biznes məqsədi (şəxsi hissə çıxılmaqla)',
      amount: app.purposeLines
        .filter((p) => p.category !== 'PERSONAL_NON_BUSINESS')
        .reduce((s, p) => s + p.amount, 0),
      tenor: structure.tenorMonths,
    },
  ];

  const existingAfterRefinance = rc.existingDebtService - rc.debtServiceRefinanced;

  const alternativeRows = alternatives.map((alt) => {
    const payment = steadyStateMonthlyPayment({ ...structure, amount: alt.amount, tenorMonths: alt.tenor });
    const totalService = existingAfterRefinance + payment;
    const dscr = totalService > 0 ? rc.cfads / totalService : null;
    const capacity = rc.capacityAtb > 0 ? payment / rc.capacityAtb : Number.POSITIVE_INFINITY;
    return { ...alt, payment, totalService, dscr, capacity };
  });

  /* Max loan under alternative DSCR floors, to show what the constraint costs. */
  const dscrScenarios = [1.5, 1.25, 1.1].map((minDscr) => {
    const res = maxSustainableLoan({
      cfadsMonthly: rc.cfads,
      existingMonthlyDebtService: existingAfterRefinance,
      minDscr,
      annualRatePct: structure.annualRatePct,
      tenorMonths: structure.tenorMonths,
      gracePeriodMonths: structure.gracePeriodMonths,
      amortisation: structure.amortisation,
    });
    return { minDscr, ...res };
  });

  return (
    <div className="space-y-4">
      <Panel bodyClassName="py-3">
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-6">
          <Stat label="Aylıq EBITDA" value={aznFull(rc.monthlyEbitda)} />
          <Stat
            label="CFADS (borc xidmətinə hazır pul)"
            value={aznFull(rc.cfads)}
            tone={rc.cfads > 0 ? 'good' : 'bad'}
          />
          <Stat label="ATB ödəmə qabiliyyəti (MZH Q6)" value={aznFull(rc.capacityAtb)} />
          <Stat label="Post-əməliyyat borc xidməti" value={aznFull(rc.postTransactionDebtService)} />
          <Stat
            label="DSCR"
            value={times(rc.dscrAfter)}
            tone={(rc.dscrAfter ?? 0) >= 1.5 ? 'good' : (rc.dscrAfter ?? 0) >= 1 ? 'warn' : 'bad'}
          />
          <Stat
            label="Aylıq ehtiyat"
            value={aznFull(rc.headroomMonthly)}
            tone={rc.headroomMonthly > 0 ? 'good' : 'bad'}
          />
        </div>
      </Panel>

      <div className="grid gap-4 xl:grid-cols-2">
        <Panel title="Ödəmə qabiliyyətinin hesablanması" subtitle="Maliyyələşmədən əvvəl və sonra (§34)">
          <DataTable
            head={
              <tr>
                <Th>Komponent</Th>
                <Th align="right">Aylıq məbləğ</Th>
              </tr>
            }
          >
            {[
              ['Aylıq xalis mənfəət', rc.monthlyNetProfit],
              ['Aylıq EBITDA', rc.monthlyEbitda],
              ['Vergi', -rc.monthlyTax],
              ['CFADS (yekun)', rc.cfads],
              ['Mövcud borc xidməti', rc.existingDebtService],
              ['Refinans ediləcək borc xidməti', -rc.debtServiceRefinanced],
              ['Yeni kreditin ödənişi', rc.proposedDebtService],
              ['Post-əməliyyat borc xidməti', rc.postTransactionDebtService],
            ].map(([label, value], i) => (
              <tr key={i} className={i === 3 || i === 7 ? 'bg-slate-900/50 font-medium' : undefined}>
                <Td className={i === 3 || i === 7 ? 'text-slate-100' : ''}>{label as string}</Td>
                <Td align="right" className={i === 3 || i === 7 ? 'text-slate-100' : ''}>
                  {azn(value as number)}
                </Td>
              </tr>
            ))}
          </DataTable>
          <div className="mt-3 border-t border-slate-800 pt-2">
            <KeyValue
              items={[
                { label: 'DSCR — maliyyələşmədən əvvəl', value: times(rc.dscrBefore) },
                { label: 'DSCR — maliyyələşmədən sonra', value: times(rc.dscrAfter) },
                {
                  label: 'Aylıq ödəniş / proqnoz ödəmə qabiliyyəti',
                  value:
                    rc.paymentToCapacity === null
                      ? '—'
                      : Number.isFinite(rc.paymentToCapacity)
                        ? pct(rc.paymentToCapacity)
                        : 'Ödəmə qabiliyyəti yoxdur!',
                  hint: 'Norma ≤ 80%',
                },
                {
                  label: 'Bütün ödənişlərin bölüşdürülməmiş mənfəətlə örtülməsi',
                  value:
                    rc.allPaymentsToRetainedProfit === null
                      ? '—'
                      : Number.isFinite(rc.allPaymentsToRetainedProfit)
                        ? pct(rc.allPaymentsToRetainedProfit)
                        : 'Örtülmür',
                },
              ]}
            />
          </div>
        </Panel>

        <Panel
          title="Həssaslıq — hansı dəyişiklikdə qabiliyyət itir?"
          subtitle="MZH həssaslıq blokunun ekvivalenti"
        >
          {a.breakEven?.noCapacity ? (
            <div className="rounded border border-rose-500/30 bg-rose-500/10 px-3 py-2.5 text-[12px] font-medium text-rose-200">
              Ödəmə qabiliyyəti yoxdur! — mövcud pul axını təklif olunan ödənişi onsuz da örtmür.
            </div>
          ) : (
            <DataTable
              head={
                <tr>
                  <Th>Dəyişən</Th>
                  <Th align="right">Kritik həddə qədər</Th>
                </tr>
              }
            >
              <tr>
                <Td>Satışın azalması</Td>
                <Td align="right">
                  {a.breakEven?.salesDeclinePct === null || a.breakEven?.salesDeclinePct === undefined
                    ? '—'
                    : `${a.breakEven.salesDeclinePct.toFixed(1)}%`}
                </Td>
              </tr>
              <tr>
                <Td>Marjanın azalması</Td>
                <Td align="right">
                  {a.breakEven?.marginDeclinePct === null || a.breakEven?.marginDeclinePct === undefined
                    ? '—'
                    : `${a.breakEven.marginDeclinePct.toFixed(1)}%`}
                </Td>
              </tr>
              <tr>
                <Td>Biznes xərclərinin artması</Td>
                <Td align="right">
                  {a.breakEven?.costIncreasePct === null || a.breakEven?.costIncreasePct === undefined
                    ? '—'
                    : `${a.breakEven.costIncreasePct.toFixed(1)}%`}
                </Td>
              </tr>
              <tr>
                <Td>Kredit ödənişlərinin artması</Td>
                <Td align="right">
                  {a.breakEven?.debtServiceIncreasePct === null || a.breakEven?.debtServiceIncreasePct === undefined
                    ? '—'
                    : `${a.breakEven.debtServiceIncreasePct.toFixed(1)}%`}
                </Td>
              </tr>
            </DataTable>
          )}

          <div className="mt-4">
            <div className="mb-1.5 text-[10px] uppercase tracking-wide text-slate-500">
              DSCR həddindən asılı olaraq maksimum kredit
            </div>
            <DataTable
              head={
                <tr>
                  <Th>Minimum DSCR</Th>
                  <Th align="right">Maks. aylıq ödəniş</Th>
                  <Th align="right">Maks. kredit</Th>
                  <Th>Məhdudlaşdırıcı amil</Th>
                </tr>
              }
            >
              {dscrScenarios.map((s) => (
                <tr key={s.minDscr}>
                  <Td>{s.minDscr.toFixed(2)}x</Td>
                  <Td align="right">{aznFull(s.maxSustainableMonthlyPayment)}</Td>
                  <Td align="right">{aznFull(s.maxSustainableLoan)}</Td>
                  <Td className="text-[10.5px] text-slate-500">
                    {s.bindingConstraint === 'NO_CAPACITY'
                      ? 'Pul axını mövcud borcu belə örtmür'
                      : 'DSCR həddi'}
                  </Td>
                </tr>
              ))}
            </DataTable>
          </div>
        </Panel>
      </div>

      <Panel
        title="Struktur alternativləri"
        subtitle="Hər variant eyni hesablama mühərriki ilə yenidən qiymətləndirilir"
        bodyClassName="px-0 py-0"
      >
        <DataTable
          className="mx-0"
          head={
            <tr>
              <Th>Variant</Th>
              <Th align="right">Məbləğ</Th>
              <Th align="right">Müddət</Th>
              <Th align="right">Aylıq ödəniş</Th>
              <Th align="right">Cəmi borc xidməti</Th>
              <Th align="right">DSCR</Th>
              <Th align="right">Ödəniş / qabiliyyət</Th>
              <Th align="center">Nəticə</Th>
            </tr>
          }
        >
          {alternativeRows.map((alt, i) => {
            const ok = (alt.dscr ?? 0) >= 1.5 && alt.capacity <= 0.8;
            return (
              <tr key={i} className={i === 0 ? 'bg-slate-900/40' : undefined}>
                <Td className={i === 0 ? 'font-medium text-slate-100' : ''}>{alt.label}</Td>
                <Td align="right">{aznFull(alt.amount)}</Td>
                <Td align="right">{alt.tenor} ay</Td>
                <Td align="right">{aznFull(alt.payment)}</Td>
                <Td align="right">{aznFull(alt.totalService)}</Td>
                <Td
                  align="right"
                  className={(alt.dscr ?? 0) >= 1.5 ? 'text-emerald-300' : (alt.dscr ?? 0) >= 1 ? 'text-amber-300' : 'text-rose-300'}
                >
                  {times(alt.dscr)}
                </Td>
                <Td align="right" className={alt.capacity > 0.8 ? 'text-rose-300' : 'text-emerald-300'}>
                  {Number.isFinite(alt.capacity) ? pct(alt.capacity) : '∞'}
                </Td>
                <Td align="center">
                  {ok ? <Badge tone="emerald">Normalara uyğun</Badge> : <Badge tone="rose">Norma pozulur</Badge>}
                </Td>
              </tr>
            );
          })}
        </DataTable>
        <div className="border-t border-slate-800 px-4 py-2 text-[10.5px] text-slate-500">
          Maksimum dayanıqlı aylıq ödəniş {aznFull(a.maxLoan?.maxSustainableMonthlyPayment ?? 0)} —{' '}
          {structure.annualRatePct}% və {structure.tenorMonths - structure.gracePeriodMonths} ay amortizasiya ilə{' '}
          {aznFull(loanFromPayment(a.maxLoan?.maxSustainableMonthlyPayment ?? 0, structure.annualRatePct, structure.tenorMonths - structure.gracePeriodMonths))} kreditə uyğundur.
        </div>
      </Panel>

      <Panel
        title="Stress testi"
        subtitle="Baza, mənfi və kəskin mənfi ssenarilər eyni proqnoz mühərriki ilə yenidən hesablanır (§35)"
        bodyClassName="px-0 py-0"
      >
        <DataTable
          className="mx-0"
          head={
            <tr>
              <Th>Ssenari</Th>
              <Th align="right">Gəlir</Th>
              <Th align="right">Marja</Th>
              <Th align="right">Faiz</Th>
              <Th align="right">EBITDA</Th>
              <Th align="right">CFADS / ay</Th>
              <Th align="right">DSCR</Th>
              <Th align="right">Borc / EBITDA</Th>
              <Th align="right">Min. nağd</Th>
              <Th>Pozuntular</Th>
            </tr>
          }
        >
          {a.stress.map((s) => (
            <tr key={s.scenario.key} className={s.scenario.key === 'BASE' ? 'bg-slate-900/40' : undefined}>
              <Td className={s.scenario.key === 'BASE' ? 'font-medium text-slate-100' : ''}>
                {s.scenario.labelAz}
              </Td>
              <Td align="right">{pct(s.scenario.drivers.revenueChangePct)}</Td>
              <Td align="right">{pct(s.scenario.drivers.grossMarginChangePp)}</Td>
              <Td align="right">+{s.scenario.drivers.interestRateChangePp} p.p.</Td>
              <Td align="right">{aznFull(s.ebitda)}</Td>
              <Td align="right" className={s.cfadsMonthly < 0 ? 'text-rose-300' : ''}>
                {aznFull(s.cfadsMonthly)}
              </Td>
              <Td
                align="right"
                className={(s.dscr ?? 0) >= 1.5 ? 'text-emerald-300' : (s.dscr ?? 0) >= 1 ? 'text-amber-300' : 'text-rose-300'}
              >
                {times(s.dscr)}
              </Td>
              <Td align="right">{times(s.debtToEbitda)}</Td>
              <Td align="right" className={s.minimumCash < 0 ? 'text-rose-300' : ''}>
                {aznFull(s.minimumCash)}
              </Td>
              <Td className="max-w-[280px] text-[10.5px] leading-snug text-rose-300">
                {s.breaches.length === 0 ? <span className="text-emerald-300">Yoxdur</span> : s.breaches.join('; ')}
              </Td>
            </tr>
          ))}
        </DataTable>
      </Panel>
    </div>
  );
}
