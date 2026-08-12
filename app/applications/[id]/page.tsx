import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getCase } from '@/services/application-service';
import {
  Badge,
  DataTable,
  EmptyState,
  KeyValue,
  Panel,
  SectionTitle,
  SeverityBadge,
  Stat,
  StatusBadge,
  Td,
  Th,
} from '@/components/ui/primitives';
import { GradeChip, RatingWaterfall } from '@/components/application/shared';
import { AUTHORITY_LABEL_AZ } from '@/config/workflow';
import {
  aznFull,
  dateAz,
  FINDING_CATEGORY_LABEL_AZ,
  metricValue,
  pct,
  PURPOSE_LABEL_AZ,
  times,
} from '@/lib/format';

/**
 * The underwriting cockpit (§11, §90-§91).
 *
 * Laid out so the fifteen acceptance questions are answerable without
 * leaving the screen: who, how much, what for, what they already owe, can
 * they pay, how trustworthy the numbers are, what breaks, and who decides.
 */
export default async function OverviewPage({ params }: { params: { id: string } }) {
  const c = await getCase(params.id);
  if (!c) notFound();
  const { application: app, customer, assessment: a } = c;
  const base = `/applications/${app.id}`;

  if (app.rejection) {
    return (
      <div className="space-y-4">
        <Panel title="İmtina qeydi" subtitle="Müraciət bazadan silinmir — reject analizi üçün tam saxlanılır">
          <KeyValue
            items={[
              { label: 'İmtina mərhələsi', value: app.rejection.stage },
              { label: 'Səbəb kodu', value: <Badge tone="rose">{app.rejection.reasonCode}</Badge> },
              { label: 'İzah', value: app.rejection.description },
              { label: 'AKB skoru', value: app.rejection.acbScore ?? 'Mövcud deyil' },
              { label: 'AKB reytinqi', value: <GradeChip grade={app.rejection.acbRating} /> },
              { label: 'Qrup ekspozisiyası', value: aznFull(app.rejection.groupExposure) },
              { label: 'Tələb olunan məbləğ', value: aznFull(app.rejection.requestedAmount) },
              { label: 'Filial / RM', value: `${app.rejection.branch} · ${app.rejection.rm}` },
              { label: 'Tarix', value: dateAz(app.rejection.rejectedAt) },
              { label: 'Siyasət versiyası', value: app.rejection.policyVersion },
              { label: 'Skorkart versiyası', value: app.rejection.scorecardVersion },
              { label: 'Workflow versiyası', value: app.rejection.workflowVersion },
            ]}
          />
        </Panel>
      </div>
    );
  }

  const purposeTotal = app.purposeLines.reduce((s, p) => s + p.amount, 0);
  const businessPurpose = app.purposeLines
    .filter((p) => p.category !== 'PERSONAL_NON_BUSINESS')
    .reduce((s, p) => s + p.amount, 0);
  const refinancing = app.purposeLines
    .filter((p) => p.category === 'REFINANCE_ATB' || p.category === 'REFINANCE_OTHER_BANK')
    .reduce((s, p) => s + p.amount, 0);

  const failedChecks = a.crossChecks.filter((ck) => !ck.passed);
  const topFindings = a.findings.filter((f) => f.severity === 'CRITICAL' || f.severity === 'HIGH');

  return (
    <div className="space-y-4">
      {/* ---- The five questions that decide whether to keep reading ---- */}
      <div className="grid gap-3 lg:grid-cols-4">
        <Panel title="Müştəri kimdir?" bodyClassName="py-2.5">
          <KeyValue
            items={[
              { label: 'Hüquqi ad', value: customer.legalName },
              { label: 'Növ', value: customer.customerType === 'LEGAL_ENTITY' ? 'Hüquqi şəxs' : 'Fərdi sahibkar' },
              { label: 'Fəaliyyət', value: `${customer.officialActivityYears} il rəsmi` },
              { label: 'İşçi sayı', value: customer.employees },
              { label: 'Sektor', value: `${customer.sector} / ${customer.subSector}` },
            ]}
          />
        </Panel>

        <Panel title="Nə istəyir və nə üçün?" bodyClassName="py-2.5">
          <KeyValue
            items={[
              { label: 'Məbləğ', value: aznFull(app.requestedStructure.amount) },
              {
                label: 'Struktur',
                value: `${app.requestedStructure.tenorMonths} ay, ${app.requestedStructure.gracePeriodMonths} ay güzəşt, ${app.requestedStructure.annualRatePct}%`,
              },
              { label: 'Biznes məqsədi', value: pct(businessPurpose / (purposeTotal || 1)) },
              { label: 'Refinansman payı', value: pct(refinancing / (purposeTotal || 1)) },
              { label: 'Əsas ödəniş mənbəyi', value: app.primaryRepaymentSource },
            ]}
          />
        </Panel>

        <Panel title="Hazırda nə qədər borcu var?" bodyClassName="py-2.5">
          <KeyValue
            items={[
              { label: 'AKB üzrə cəmi borc', value: aznFull(a.bureauSummary.totalDebt) },
              { label: 'ATB-də', value: aznFull(a.bureauSummary.atbDebt) },
              { label: 'Aylıq borc xidməti', value: aznFull(a.bureauSummary.monthlyDebtService) },
              { label: 'Aktiv kredit sayı', value: a.bureauSummary.activeFacilityCount },
              {
                label: 'Maksimum gecikmə',
                value: `${a.bureauSummary.historicMaxDpd} gün (cari ${a.bureauSummary.currentMaxDpd})`,
              },
            ]}
          />
        </Panel>

        <Panel title="Biznes krediti ödəyə bilərmi?" bodyClassName="py-2.5">
          <KeyValue
            items={[
              { label: 'Aylıq CFADS', value: aznFull(a.repayment?.cfads ?? null) },
              { label: 'Post-əməliyyat ödəniş', value: aznFull(a.postTransactionMonthlyDebtService) },
              { label: 'DSCR', value: times(a.repayment?.dscrAfter) },
              { label: 'Aylıq ehtiyat', value: aznFull(a.repayment?.headroomMonthly ?? null) },
              {
                label: 'Maks. dayanıqlı kredit',
                value: aznFull(a.maxLoan?.maxSustainableLoan ?? null),
              },
            ]}
          />
        </Panel>
      </div>

      {/* ---- Verdict strip ---- */}
      <Panel bodyClassName="py-3">
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-7">
          <Stat
            label="Post-əməliyyat ekspozisiya"
            value={aznFull(a.groupExposure.postTransactionGroupExposure)}
            sub={`Seqment: ${a.rating.segment === 'MEDIUM' ? 'Orta (İri)' : 'Kiçik'}`}
          />
          <Stat
            label="AKB reytinqi"
            value={<GradeChip grade={a.bureauRating.grade} />}
            sub={`Skor ${a.bureauRating.score ?? '—'}`}
          />
          <Stat
            label="Yekun daxili reytinq"
            value={<GradeChip grade={a.rating.finalGrade} worst={a.rating.isWorstRating} />}
            sub={`Düzəliş ${a.rating.totalNotch} pillə`}
          />
          <Stat
            label="Yekun rəy (As-Is)"
            value={`${a.legacy.totalScore.toFixed(1)}`}
            sub={a.legacy.bandLabelAz}
            tone={a.legacy.globalStopTriggered ? 'bad' : 'default'}
          />
          <Stat
            label="Məlumat keyfiyyəti"
            value={a.dataQuality.grade}
            sub={a.dataQuality.gradeLabelAz}
            tone={['A', 'B'].includes(a.dataQuality.grade) ? 'good' : a.dataQuality.grade === 'C' ? 'warn' : 'bad'}
          />
          <Stat
            label="Girov örtüyü"
            value={a.collateral.eligibleCoverage === null ? '—' : pct(a.collateral.eligibleCoverage)}
            sub={`Uyğun dəyər ${aznFull(a.collateral.totalEligibleValue)}`}
            tone={(a.collateral.eligibleCoverage ?? 0) >= 1 ? 'good' : 'warn'}
          />
          <Stat
            label="Stop faktor / istisna"
            value={`${a.activeStopFactors.length} / ${a.policy.exceptions.length}`}
            tone={a.activeStopFactors.length > 0 ? 'bad' : a.policy.exceptions.length > 0 ? 'warn' : 'good'}
          />
        </div>
      </Panel>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
        <div className="space-y-4">
          <Panel
            title="Analitik şərh"
            subtitle="Hesablama nəticələrindən deterministik qaydalarla yaradılıb — LLM istifadə edilmir"
          >
            {a.commentary.length === 0 ? (
              <EmptyState>Şərh yaradılması üçün kifayət qədər müqayisə məlumatı yoxdur.</EmptyState>
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

          <Panel
            title="Əsas tapıntılar"
            subtitle={`${a.findings.length} tapıntı — ${topFindings.length} kritik və yüksək`}
            actions={
              <Link href={`${base}/cross-checks`} className="hover:text-slate-200">
                Hamısı →
              </Link>
            }
            bodyClassName="px-0 py-0"
          >
            {topFindings.length === 0 ? (
              <div className="px-4 py-3">
                <EmptyState>Kritik və ya yüksək səviyyəli tapıntı yoxdur.</EmptyState>
              </div>
            ) : (
              <ul className="divide-y divide-slate-800/70">
                {topFindings.slice(0, 9).map((f) => (
                  <li key={f.id} className="px-4 py-2">
                    <div className="flex items-start gap-2">
                      <SeverityBadge severity={f.severity} />
                      <div className="min-w-0 flex-1">
                        <div className="text-[12px] font-medium text-slate-100">{f.title}</div>
                        <p className="mt-0.5 text-[11px] leading-relaxed text-slate-400">{f.description}</p>
                        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[10px] text-slate-500">
                          <span>{FINDING_CATEGORY_LABEL_AZ[f.category]}</span>
                          {f.observedValue && <span>Müşahidə: {f.observedValue}</span>}
                          {f.expectedValue && <span>Gözlənilən: {f.expectedValue}</span>}
                        </div>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel
            title="Uzlaşma yoxlamaları"
            subtitle={`${failedChecks.length} / ${a.crossChecks.length} yoxlama uğursuzdur`}
            actions={
              <Link href={`${base}/cross-checks`} className="hover:text-slate-200">
                Ətraflı →
              </Link>
            }
            bodyClassName="px-0 py-0"
          >
            <DataTable
              className="mx-0"
              head={
                <tr>
                  <Th>Yoxlama</Th>
                  <Th align="right">Gözlənilən</Th>
                  <Th align="right">Faktiki</Th>
                  <Th align="right">Fərq</Th>
                  <Th align="center">Nəticə</Th>
                </tr>
              }
            >
              {a.crossChecks.map((ck) => (
                <tr key={ck.key}>
                  <Td>{ck.labelAz}</Td>
                  <Td align="right">{aznFull(ck.expected)}</Td>
                  <Td align="right">{aznFull(ck.actual)}</Td>
                  <Td align="right" className={ck.passed ? '' : 'text-rose-300'}>
                    {aznFull(ck.difference)}
                    {ck.differencePct !== null && (
                      <div className="text-[9.5px] text-slate-500">{pct(ck.differencePct)}</div>
                    )}
                  </Td>
                  <Td align="center">
                    {ck.passed ? <Badge tone="emerald">Uzlaşır</Badge> : <SeverityBadge severity={ck.severity} />}
                  </Td>
                </tr>
              ))}
            </DataTable>
          </Panel>
        </div>

        <div className="space-y-4">
          <Panel
            title="Reytinq şəlaləsi"
            subtitle="AKB reytinqindən yekun daxili reytinqə — hər addım izah olunur"
            actions={<StatusBadge status="PROMETEIA_PROPOSED" />}
          >
            <RatingWaterfall rating={a.rating} />
          </Panel>

          <Panel title="Ödəmə qabiliyyəti — əvvəl və sonra" subtitle="§34 Repayment capacity">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded border border-slate-800 bg-slate-950/40 p-2.5">
                <SectionTitle>Maliyyələşmədən əvvəl</SectionTitle>
                <KeyValue
                  items={[
                    { label: 'Aylıq CFADS', value: aznFull(a.repayment?.cfads ?? null) },
                    { label: 'Borc xidməti', value: aznFull(a.repayment?.existingDebtService ?? null) },
                    { label: 'DSCR', value: times(a.repayment?.dscrBefore) },
                  ]}
                />
              </div>
              <div className="rounded border border-slate-800 bg-slate-950/40 p-2.5">
                <SectionTitle>Maliyyələşmədən sonra</SectionTitle>
                <KeyValue
                  items={[
                    { label: 'Aylıq CFADS', value: aznFull(a.repayment?.cfads ?? null) },
                    { label: 'Borc xidməti', value: aznFull(a.repayment?.postTransactionDebtService ?? null) },
                    { label: 'DSCR', value: times(a.repayment?.dscrAfter) },
                  ]}
                />
              </div>
            </div>
            <div className="mt-3 border-t border-slate-800 pt-2">
              <KeyValue
                items={[
                  {
                    label: 'Refinans edilən borc xidməti',
                    value: aznFull(a.repayment?.debtServiceRefinanced ?? null),
                  },
                  { label: 'Yeni kreditin aylıq ödənişi', value: aznFull(a.proposedMonthlyPayment) },
                  {
                    label: 'Maksimum dayanıqlı aylıq ödəniş',
                    value: aznFull(a.maxLoan?.maxSustainableMonthlyPayment ?? null),
                  },
                  {
                    label: 'Maksimum dayanıqlı kredit',
                    value: aznFull(a.maxLoan?.maxSustainableLoan ?? null),
                  },
                ]}
              />
            </div>
          </Panel>

          <Panel title="Kreditin məqsədi" subtitle="Məqsəd sərbəst mətn kimi deyil, bölgü kimi saxlanılır">
            <DataTable
              head={
                <tr>
                  <Th>Kateqoriya</Th>
                  <Th align="right">Məbləğ</Th>
                  <Th align="right">Pay</Th>
                  <Th>Təsdiq</Th>
                </tr>
              }
            >
              {app.purposeLines.map((line) => (
                <tr key={line.id}>
                  <Td>
                    <div className="text-slate-200">{PURPOSE_LABEL_AZ[line.category]}</div>
                    <div className="text-[10px] text-slate-500">{line.description}</div>
                  </Td>
                  <Td align="right">{aznFull(line.amount)}</Td>
                  <Td align="right">{pct(line.amount / (purposeTotal || 1))}</Td>
                  <Td>
                    <Badge
                      tone={
                        line.evidence === 'VERIFIED'
                          ? 'emerald'
                          : line.evidence === 'PARTIALLY_VERIFIED'
                            ? 'lime'
                            : line.evidence === 'MISSING'
                              ? 'rose'
                              : 'amber'
                      }
                    >
                      {line.evidence}
                    </Badge>
                  </Td>
                </tr>
              ))}
            </DataTable>
          </Panel>

          <Panel title="Niyə bu səlahiyyət?" subtitle="Risk həssas marşrutlaşdırma (§52)">
            <div className="mb-2 rounded border border-sky-500/20 bg-sky-500/5 px-3 py-2">
              <div className="text-[10px] uppercase tracking-wide text-slate-500">Qərar səlahiyyəti</div>
              <div className="mt-0.5 text-[13px] font-semibold text-sky-300">
                {a.routing.decisionAuthority ? AUTHORITY_LABEL_AZ[a.routing.decisionAuthority] : '—'}
              </div>
            </div>
            <ul className="space-y-1">
              {a.routing.reasons.map((r, i) => (
                <li key={i} className="flex gap-2 text-[11px] leading-relaxed text-slate-400">
                  <span className="mt-[6px] h-1 w-1 shrink-0 rounded-full bg-slate-600" />
                  {r}
                </li>
              ))}
            </ul>
            <div className="mt-2 flex flex-wrap items-center gap-1.5 border-t border-slate-800 pt-2">
              <StatusBadge status={a.routing.workflowStatus} />
              <span className="text-[10px] text-slate-500">{a.routing.workflowLabel}</span>
            </div>
          </Panel>

          <Panel title="Əsas maliyyə göstəriciləri">
            <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-[11.5px]">
              {[
                'currentRatio',
                'quickRatio',
                'debtToEquityInclNew',
                'debtToEbitda',
                'ebitdaMargin',
                'netMargin',
                'receivableDays',
                'inventoryDays',
                'creditorDays',
                'cashConversionCycle',
              ].map((key) => {
                const m = a.ratios[key];
                const outcome = a.policy.outcomes.find((o) => o.metric === key);
                return (
                  <div key={key} className="flex items-baseline justify-between gap-2">
                    <span className="min-w-0 truncate text-slate-500" title={m?.labelEn}>
                      {m?.label ?? key}
                    </span>
                    <span
                      className={`shrink-0 tabular-nums ${
                        outcome && !outcome.passed ? 'text-rose-300' : 'text-slate-200'
                      }`}
                    >
                      {metricValue(m)}
                    </span>
                  </div>
                );
              })}
            </div>
            <Link
              href={`${base}/emsallar`}
              className="mt-2 inline-block border-t border-slate-800 pt-2 text-[10.5px] text-sky-400 hover:text-sky-300"
            >
              Bütün əmsallar və izahlar →
            </Link>
          </Panel>
        </div>
      </div>
    </div>
  );
}
