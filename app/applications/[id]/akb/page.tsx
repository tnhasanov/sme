import { notFound } from 'next/navigation';
import { getCase } from '@/services/application-service';
import {
  Badge,
  DataTable,
  EmptyState,
  KeyValue,
  Panel,
  SeverityBadge,
  Stat,
  Td,
  Th,
} from '@/components/ui/primitives';
import { GradeChip } from '@/components/application/shared';
import { aznFull, dateAz, pct, RELATIONSHIP_LABEL_AZ } from '@/lib/format';

/** AKB / credit bureau, refinancing engine and group exposure (§14, §15, §18). */
export default async function BureauPage({ params }: { params: { id: string } }) {
  const c = await getCase(params.id);
  if (!c) notFound();
  const { application: app, assessment: a } = c;
  const b = a.bureauSummary;
  const r = a.refinancing;

  return (
    <div className="space-y-4">
      <Panel bodyClassName="py-3">
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-7">
          <Stat label="AKB Micro Score" value={b.acbMicroScore ?? '—'} sub={a.bureauRating.bandLabel} />
          <Stat label="AKB reytinqi" value={<GradeChip grade={a.bureauRating.grade} />} sub={a.bureauRating.worstGradeSource} />
          <Stat label="Cəmi borc" value={aznFull(b.totalDebt)} sub={`ATB: ${aznFull(b.atbDebt)}`} />
          <Stat label="Aylıq borc xidməti" value={aznFull(b.monthlyDebtService)} />
          <Stat label="Aktiv / bağlanmış" value={`${b.activeFacilityCount} / ${b.closedFacilityCount}`} />
          <Stat
            label="Maks. gecikmə"
            value={`${b.historicMaxDpd} gün`}
            sub={`Cari ${b.currentMaxDpd} gün · 30+ hadisə ${b.dpd30PlusEvents}`}
            tone={b.historicMaxDpd >= 30 ? 'bad' : b.historicMaxDpd > 0 ? 'warn' : 'good'}
          />
          <Stat
            label="Son 3 ayda sorğu"
            value={b.inquiriesLast3Months}
            sub={`Nəticəsiz: ${b.unresolvedInquiries}`}
            tone={b.unresolvedInquiries >= 2 ? 'warn' : 'default'}
          />
        </div>
      </Panel>

      <Panel
        title="İlkin bürо süzgəci"
        subtitle="Prometeia təklifi — cari ATB siyasətinin bir hissəsi deyil"
        actions={
          <Badge tone={a.preScreen.outcome === 'PASS' ? 'emerald' : 'rose'}>{a.preScreen.outcome}</Badge>
        }
      >
        <p className="text-[11.5px] leading-relaxed text-slate-300">{a.preScreen.reasonAz}</p>
        <div className="mt-2 text-[10.5px] text-slate-500">
          Skala: {a.preScreen.scaleId} · Hədd:{' '}
          {a.preScreen.thresholdApplied === null ? 'tətbiq edilmir' : a.preScreen.thresholdApplied}
        </div>
      </Panel>

      <Panel
        title="Qrup ekspozisiyası"
        subtitle="Approval routing əməliyyatdan sonrakı qrup ekspozisiyasına əsaslanır (§14)"
        bodyClassName="px-0 py-0"
      >
        <DataTable
          className="mx-0"
          head={
            <tr>
              <Th>Şəxs / şirkət</Th>
              <Th>Əlaqə</Th>
              <Th align="right">ATB ekspozisiyası</Th>
              <Th align="right">Xarici ekspozisiya</Th>
              <Th align="right">Tələb olunan</Th>
              <Th align="right">Verilmiş zəmanət</Th>
            </tr>
          }
        >
          {a.groupExposure.members.map((m) => (
            <tr key={m.id}>
              <Td>
                {m.name}
                {m.note && <div className="text-[10px] text-slate-500">{m.note}</div>}
              </Td>
              <Td>
                <Badge tone={m.relationship === 'SELF' ? 'sky' : 'slate'}>
                  {RELATIONSHIP_LABEL_AZ[m.relationship]}
                </Badge>
              </Td>
              <Td align="right">{aznFull(m.atbExposure)}</Td>
              <Td align="right">{aznFull(m.externalExposure)}</Td>
              <Td align="right">{aznFull(m.requestedExposure)}</Td>
              <Td align="right">{aznFull(m.guaranteesGiven)}</Td>
            </tr>
          ))}
          <tr className="bg-slate-900/60 font-medium">
            <Td colSpan={2}>Cəmi</Td>
            <Td align="right">{aznFull(a.groupExposure.existingAtbExposure)}</Td>
            <Td align="right">{aznFull(a.groupExposure.existingExternalExposure)}</Td>
            <Td align="right">{aznFull(a.groupExposure.requestedAmount)}</Td>
            <Td align="right">{aznFull(a.groupExposure.guarantees)}</Td>
          </tr>
        </DataTable>

        <div className="grid gap-4 border-t border-slate-800 px-4 py-3 md:grid-cols-4">
          <Stat label="Mövcud qrup ekspozisiyası" value={aznFull(a.groupExposure.existingTotalExposure)} />
          <Stat label="Tələb olunan məbləğ" value={aznFull(a.groupExposure.requestedAmount)} />
          <Stat
            label="Bağlanacaq borc"
            value={aznFull(a.groupExposure.debtBeingRefinanced)}
            sub="Refinansman məqsədli hissə"
          />
          <Stat
            label="Post-əməliyyat qrup ekspozisiyası"
            value={aznFull(a.groupExposure.postTransactionGroupExposure)}
            tone="warn"
            sub={`Seqment: ${a.rating.segment === 'MEDIUM' ? 'Orta (İri)' : 'Kiçik'}`}
          />
        </div>
      </Panel>

      <Panel
        title="Refinansman və kredit dövriyyəsi mühərriki"
        subtitle="Hər əvvəlki kredit üzrə ödənişlə bağlanan və refinansmanla bağlanan hissə ayrılır (§18)"
        actions={
          <span>
            Aylıq ödənişlə bağlanma payı:{' '}
            <span
              className={
                (r.instalmentRepaymentShare ?? 0) > 0.5 ? 'text-emerald-300' : 'text-rose-300'
              }
            >
              {r.instalmentRepaymentShare === null ? '—' : pct(r.instalmentRepaymentShare)}
            </span>{' '}
            (norma &gt; 50%)
          </span>
        }
        bodyClassName="px-0 py-0"
      >
        {r.flags.length > 0 && (
          <ul className="space-y-1.5 border-b border-slate-800 px-4 py-3">
            {r.flags.map((f) => (
              <li key={f.key} className="flex items-start gap-2">
                <SeverityBadge severity={f.severity} />
                <span className="text-[11.5px] leading-relaxed text-slate-300">{f.messageAz}</span>
              </li>
            ))}
          </ul>
        )}

        <DataTable
          className="mx-0"
          head={
            <tr>
              <Th>Kredit</Th>
              <Th>Verilib / bitir</Th>
              <Th align="right">İlkin məbləğ</Th>
              <Th align="right">Adi amortizasiya</Th>
              <Th align="right">Erkən bağlanma</Th>
              <Th align="right">Refinans edilib</Th>
              <Th align="right">Cash-out</Th>
              <Th align="right">Fasilə</Th>
              <Th align="center">Status</Th>
            </tr>
          }
        >
          {r.lifecycles.map((l) => (
            <tr key={l.facility.id}>
              <Td>
                <div>{l.facility.lender}</div>
                <div className="text-[10px] text-slate-500">
                  {l.facility.product} · {l.monthsServiced}/{l.contractualMonths} ay
                </div>
              </Td>
              <Td className="text-[10.5px]">
                {dateAz(l.facility.issueDate)}
                <div className="text-slate-500">
                  {l.facility.closureDate ? dateAz(l.facility.closureDate) : dateAz(l.facility.maturityDate)}
                </div>
              </Td>
              <Td align="right">{aznFull(l.facility.originalAmount)}</Td>
              <Td align="right">{aznFull(l.ordinaryPrincipalRepaid)}</Td>
              <Td align="right">{aznFull(l.earlyRepayment)}</Td>
              <Td align="right" className={l.refinancedAmount > 0 ? 'text-amber-300' : ''}>
                {l.refinancedAmount > 0 ? aznFull(l.refinancedAmount) : '—'}
              </Td>
              <Td align="right">{l.cashOut > 0 ? aznFull(l.cashOut) : '—'}</Td>
              <Td align="right">{l.gapDays === undefined ? '—' : `${l.gapDays} gün`}</Td>
              <Td align="center">
                <Badge
                  tone={
                    l.facility.status === 'ACTIVE'
                      ? 'sky'
                      : l.facility.status === 'CLOSED'
                        ? 'slate'
                        : 'amber'
                  }
                >
                  {l.facility.status}
                </Badge>
                {l.facility.maxDpd > 0 && (
                  <div className="mt-0.5 text-[9.5px] text-amber-400">maks {l.facility.maxDpd} gün</div>
                )}
              </Td>
            </tr>
          ))}
          <tr className="bg-slate-900/60 font-medium">
            <Td colSpan={2}>Cəmi</Td>
            <Td align="right">{aznFull(r.totalOriginalPrincipal)}</Td>
            <Td align="right">{aznFull(r.totalRepaidByInstalments)}</Td>
            <Td align="right">—</Td>
            <Td align="right">{aznFull(r.totalRefinanced)}</Td>
            <Td align="right">{aznFull(r.totalCashOut)}</Td>
            <Td colSpan={2} />
          </tr>
        </DataTable>
      </Panel>

      <div className="grid gap-4 xl:grid-cols-2">
        <Panel title="Borc yükünün dinamikası" subtitle="Hadisə tarixlərinə görə qalıq borc">
          {r.debtTrend.length === 0 ? (
            <EmptyState>Kredit tarixçəsi yoxdur.</EmptyState>
          ) : (
            <div className="space-y-1">
              {r.debtTrend.map((point) => {
                const max = Math.max(...r.debtTrend.map((p) => p.totalDebt), 1);
                return (
                  <div key={point.date} className="flex items-center gap-2 text-[10.5px]">
                    <span className="w-20 shrink-0 text-slate-500">{dateAz(point.date)}</span>
                    <div className="h-2 flex-1 overflow-hidden rounded-sm bg-slate-800">
                      <div
                        className="h-full bg-sky-500/70"
                        style={{ width: `${(point.totalDebt / max) * 100}%` }}
                      />
                    </div>
                    <span className="w-24 shrink-0 text-right tabular-nums text-slate-300">
                      {aznFull(point.totalDebt)}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
          <div className="mt-3 border-t border-slate-800 pt-2">
            <KeyValue
              items={[
                {
                  label: 'Tarixi maksimum paralel aylıq ödəniş',
                  value: aznFull(a.debtBurden.historicMaxParallelPayment),
                },
                {
                  label: 'Post-əməliyyat aylıq ödəniş',
                  value: aznFull(a.postTransactionMonthlyDebtService),
                },
                {
                  label: 'Borc yükünün artımı',
                  value: a.debtBurden.increase === null ? '—' : pct(a.debtBurden.increase),
                  hint: 'Metodologiya §4.8 — 50%-dən çox artım arzuolunmazdır',
                },
              ]}
            />
          </div>
        </Panel>

        <Panel title="Bürо sorğuları və zəmanətlər">
          <div className="mb-2 text-[10px] uppercase tracking-wide text-slate-500">Sorğular</div>
          <DataTable
            head={
              <tr>
                <Th>Tarix</Th>
                <Th>Təşkilat</Th>
                <Th>Məqsəd</Th>
                <Th align="center">Nəticə</Th>
              </tr>
            }
          >
            {app.bureauReports.flatMap((rep) =>
              rep.inquiries.map((inq) => (
                <tr key={inq.id}>
                  <Td>{dateAz(inq.date)}</Td>
                  <Td>{inq.institution}</Td>
                  <Td>{inq.purpose}</Td>
                  <Td align="center">
                    {inq.resultedInLoan ? (
                      <Badge tone="slate">Kredit verilib</Badge>
                    ) : (
                      <Badge tone="amber">Nəticəsiz</Badge>
                    )}
                  </Td>
                </tr>
              )),
            )}
          </DataTable>
          {app.bureauReports.every((rep) => rep.inquiries.length === 0) && (
            <EmptyState>Sorğu qeydi yoxdur.</EmptyState>
          )}

          <div className="mb-2 mt-4 text-[10px] uppercase tracking-wide text-slate-500">
            AKB çıxarışlarının əhatəsi
          </div>
          <DataTable
            head={
              <tr>
                <Th>Subyekt</Th>
                <Th>Sorğu tarixi</Th>
                <Th align="right">Skor</Th>
                <Th align="right">Kredit sayı</Th>
              </tr>
            }
          >
            {app.bureauReports.map((rep) => (
              <tr key={rep.id}>
                <Td>{rep.subjectName}</Td>
                <Td>{dateAz(rep.inquiryDate)}</Td>
                <Td align="right">{rep.acbMicroScore ?? '—'}</Td>
                <Td align="right">{rep.facilities.length}</Td>
              </tr>
            ))}
          </DataTable>
          {a.groupExposure.members.some(
            (m) => !app.bureauReports.some((rep) => rep.subjectName === m.name),
          ) && (
            <div className="mt-2 rounded border border-rose-500/30 bg-rose-500/5 px-2.5 py-1.5 text-[10.5px] text-rose-300">
              Qrupun bəzi üzvləri üzrə AKB çıxarışı alınmayıb — bu, stop faktor ola bilər (Metodologiya §4.3).
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}
