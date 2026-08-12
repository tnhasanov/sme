import { notFound } from 'next/navigation';
import { getCase } from '@/services/application-service';
import {
  Badge,
  DataTable,
  EmptyState,
  KeyValue,
  Panel,
  Stat,
  Td,
  Th,
} from '@/components/ui/primitives';
import { COLLATERAL_HAIRCUTS_V1 } from '@/config/policy';
import {
  aznFull,
  COLLATERAL_LABEL_AZ,
  dateAz,
  EVIDENCE_LABEL_AZ,
  pct,
  PURPOSE_LABEL_AZ,
  RELATIONSHIP_LABEL_AZ,
  times,
} from '@/lib/format';

/** Loan purpose decomposition (§37-§38) and collateral (§39). */
export default async function PurposeCollateralPage({ params }: { params: { id: string } }) {
  const c = await getCase(params.id);
  if (!c) notFound();
  const { application: app, assessment: a } = c;

  const total = app.purposeLines.reduce((s, p) => s + p.amount, 0) || app.requestedStructure.amount;
  const share = (predicate: (cat: string) => boolean) =>
    app.purposeLines.filter((p) => predicate(p.category)).reduce((s, p) => s + p.amount, 0) / total;

  const businessShare = share((cat) => cat !== 'PERSONAL_NON_BUSINESS');
  const refinancingShare = share((cat) => cat === 'REFINANCE_ATB' || cat === 'REFINANCE_OTHER_BANK');
  const capexShare = share((cat) => cat === 'CAPEX' || cat === 'VEHICLE' || cat === 'PROPERTY');
  const unsupported =
    app.purposeLines
      .filter((p) => p.evidence === 'MISSING' || p.evidence === 'VERBAL')
      .reduce((s, p) => s + p.amount, 0) / total;

  const capexLines = app.purposeLines.filter((p) => p.effectiveness);

  return (
    <div className="space-y-4">
      <Panel bodyClassName="py-3">
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
          <Stat label="Biznes məqsədi" value={pct(businessShare)} tone={businessShare >= 0.9 ? 'good' : 'warn'} />
          <Stat label="Refinansman payı" value={pct(refinancingShare)} />
          <Stat label="İnvestisiya (CAPEX) payı" value={pct(capexShare)} />
          <Stat
            label="Təsdiqlənməmiş məqsəd"
            value={pct(unsupported)}
            tone={unsupported > 0.2 ? 'bad' : unsupported > 0 ? 'warn' : 'good'}
          />
          <Stat label="Cəmi məqsəd məbləği" value={aznFull(total)} />
        </div>
      </Panel>

      <Panel
        title="Kreditin məqsədi"
        subtitle="Məqsəd sərbəst mətn deyil — hər hissə üzrə sənəd, biznes faydası və nəzarət mexanizmi göstərilir"
        bodyClassName="px-0 py-0"
      >
        <DataTable
          className="mx-0"
          head={
            <tr>
              <Th>Kateqoriya</Th>
              <Th>Təsvir</Th>
              <Th align="right">Məbləğ</Th>
              <Th align="right">Pay</Th>
              <Th>Təsdiq</Th>
              <Th>Biznes faydası</Th>
              <Th>Nəzarət</Th>
            </tr>
          }
        >
          {app.purposeLines.map((line) => (
            <tr key={line.id} className={line.category === 'PERSONAL_NON_BUSINESS' ? 'bg-rose-500/5' : undefined}>
              <Td>
                <Badge tone={line.category === 'PERSONAL_NON_BUSINESS' ? 'rose' : 'slate'}>
                  {PURPOSE_LABEL_AZ[line.category]}
                </Badge>
              </Td>
              <Td className="max-w-[240px]">
                {line.description}
                {line.evidenceDocument && (
                  <div className="text-[10px] text-slate-500">{line.evidenceDocument}</div>
                )}
              </Td>
              <Td align="right">{aznFull(line.amount)}</Td>
              <Td align="right">{pct(line.amount / total)}</Td>
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
                  {EVIDENCE_LABEL_AZ[line.evidence]}
                </Badge>
              </Td>
              <Td className="max-w-[220px] text-[10.5px] leading-snug text-slate-400">{line.businessBenefit}</Td>
              <Td className="max-w-[200px] text-[10.5px] leading-snug text-slate-400">{line.controlMechanism}</Td>
            </tr>
          ))}
        </DataTable>
      </Panel>

      {capexLines.length > 0 && (
        <Panel
          title="Məqsədin iqtisadi səmərəliliyi"
          subtitle="İnvestisiya təyinatlı hissələr üzrə əlavə gəlir, pul faydası və geri qaytarılma müddəti (§38)"
          bodyClassName="px-0 py-0"
        >
          <DataTable
            className="mx-0"
            head={
              <tr>
                <Th>Layihə</Th>
                <Th align="right">İnvestisiya</Th>
                <Th align="right">Öz vəsaiti</Th>
                <Th align="right">Maliyyələşən</Th>
                <Th align="right">Əlavə illik satış</Th>
                <Th align="right">Əlavə EBITDA</Th>
                <Th align="right">İllik pul faydası</Th>
                <Th align="right">Geri qaytarılma</Th>
              </tr>
            }
          >
            {capexLines.map((line) => {
              const e = line.effectiveness!;
              return (
                <tr key={line.id}>
                  <Td className="max-w-[220px]">{line.description}</Td>
                  <Td align="right">{aznFull(e.investmentAmount)}</Td>
                  <Td align="right">{aznFull(e.ownContribution)}</Td>
                  <Td align="right">{aznFull(e.financedAmount)}</Td>
                  <Td align="right">{aznFull(e.additionalAnnualSales)}</Td>
                  <Td align="right">{aznFull(e.additionalAnnualEbitda)}</Td>
                  <Td align="right">{aznFull(e.annualCashBenefit)}</Td>
                  <Td
                    align="right"
                    className={
                      e.paybackYears === null ? '' : e.paybackYears > 5 ? 'text-amber-300' : 'text-emerald-300'
                    }
                  >
                    {e.paybackYears === null ? '—' : `${e.paybackYears.toFixed(1)} il`}
                  </Td>
                </tr>
              );
            })}
          </DataTable>
        </Panel>
      )}

      <Panel bodyClassName="py-3">
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-6">
          <Stat label="Bazar dəyəri" value={aznFull(a.collateral.totalMarketValue)} />
          <Stat label="Likvid (məcburi satış) dəyəri" value={aznFull(a.collateral.totalForcedSaleValue)} />
          <Stat label="Uyğun (diskontlu) dəyər" value={aznFull(a.collateral.totalEligibleValue)} />
          <Stat
            label="Uyğun girov örtüyü"
            value={a.collateral.eligibleCoverage === null ? '—' : pct(a.collateral.eligibleCoverage)}
            tone={(a.collateral.eligibleCoverage ?? 0) >= 1 ? 'good' : 'warn'}
            sub={`Ekspozisiya: ${aznFull(a.collateral.exposure)}`}
          />
          <Stat label="Təminatlı hissə" value={aznFull(a.collateral.securedExposure)} />
          <Stat
            label="Təminatsız hissə"
            value={aznFull(a.collateral.unsecuredExposure)}
            tone={a.collateral.unsecuredExposure > 0 ? 'warn' : 'good'}
          />
        </div>
      </Panel>

      <Panel
        title="Girov reyestri"
        subtitle="Uyğun dəyər: likvid dəyər − diskont − əvvəlki ipoteka. Zəmanətlər uyğun örtüyə daxil edilmir."
        bodyClassName="px-0 py-0"
      >
        {a.collateral.items.length === 0 ? (
          <div className="px-4 py-3">
            <EmptyState>Girov qeydə alınmayıb.</EmptyState>
          </div>
        ) : (
          <DataTable
            className="mx-0"
            head={
              <tr>
                <Th>Növ</Th>
                <Th>Təsvir</Th>
                <Th>Sahibi</Th>
                <Th align="right">Bazar dəyəri</Th>
                <Th align="right">Likvid dəyər</Th>
                <Th align="right">Diskont</Th>
                <Th align="right">Əvvəlki ipoteka</Th>
                <Th align="right">Uyğun dəyər</Th>
                <Th align="right">LTV</Th>
                <Th align="center">Status</Th>
              </tr>
            }
          >
            {a.collateral.items.map((item) => (
              <tr key={item.collateral.id} className={item.eligible ? undefined : 'bg-slate-900/40'}>
                <Td className="text-[10.5px]">{COLLATERAL_LABEL_AZ[item.collateral.type]}</Td>
                <Td className="max-w-[220px]">
                  {item.collateral.description}
                  <div className="text-[10px] text-slate-500">
                    Qiymətləndirmə: {dateAz(item.collateral.valuationDate)} · {item.collateral.appraiser}
                  </div>
                </Td>
                <Td className="text-[10.5px]">
                  {item.collateral.ownerName}
                  <div className="text-slate-500">{RELATIONSHIP_LABEL_AZ[item.collateral.ownerRelationship]}</div>
                </Td>
                <Td align="right">{aznFull(item.marketValue)}</Td>
                <Td align="right">{aznFull(item.forcedSaleValue)}</Td>
                <Td align="right">
                  {item.haircutPct}%
                  {item.haircutSource === 'ANALYST_OVERRIDE' && (
                    <div className="text-[9.5px] text-amber-400">override</div>
                  )}
                </Td>
                <Td align="right">{aznFull(item.priorLien)}</Td>
                <Td align="right" className={item.eligible ? 'text-slate-100' : 'text-slate-600'}>
                  {aznFull(item.eligibleValue)}
                </Td>
                <Td align="right">{times(item.ltv)}</Td>
                <Td align="center">
                  {item.eligible ? (
                    <Badge tone="emerald">Uyğun</Badge>
                  ) : (
                    <Badge tone="slate" title={item.ineligibilityReason}>
                      Uyğun deyil
                    </Badge>
                  )}
                  {!item.collateral.insured && <div className="mt-0.5 text-[9.5px] text-amber-400">sığortasız</div>}
                  {!item.collateral.registered && (
                    <div className="mt-0.5 text-[9.5px] text-rose-400">qeydiyyatsız</div>
                  )}
                </Td>
              </tr>
            ))}
          </DataTable>
        )}
        <div className="border-t border-slate-800 px-4 py-2 text-[10.5px] text-slate-500">
          Diskont cədvəli: {COLLATERAL_HAIRCUTS_V1.label} · {COLLATERAL_HAIRCUTS_V1.sourceRef}
        </div>
      </Panel>

      {a.collateral.items.some((i) => !i.eligible) && (
        <Panel title="Uyğun sayılmayan təminat">
          <KeyValue
            items={a.collateral.items
              .filter((i) => !i.eligible)
              .map((i) => ({
                label: i.collateral.description,
                value: i.ineligibilityReason ?? '—',
              }))}
          />
        </Panel>
      )}
    </div>
  );
}
