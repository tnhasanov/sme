import { notFound } from 'next/navigation';
import { getCase } from '@/services/application-service';
import { Badge, DataTable, KeyValue, Panel, Td, Th } from '@/components/ui/primitives';
import { aznFull, dateAz, PRODUCT_LABEL_AZ, pct } from '@/lib/format';

export default async function ProfilePage({ params }: { params: { id: string } }) {
  const c = await getCase(params.id);
  if (!c) notFound();
  const { application: app, customer } = c;
  const s = app.requestedStructure;
  const p = app.proposedStructure;

  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <Panel title="Hüquqi məlumat" subtitle="Legal information">
        <KeyValue
          items={[
            { label: 'Hüquqi ad', value: customer.legalName },
            { label: 'Müştəri növü', value: customer.customerType },
            { label: 'Hüquqi forma', value: customer.legalForm },
            { label: 'VÖEN (anonimləşdirilmiş)', value: customer.taxId },
            { label: 'Qeydiyyat tarixi', value: dateAz(customer.registrationDate) },
            { label: 'Fəaliyyətin başlanğıcı', value: dateAz(customer.activityStartDate) },
            { label: 'Rəsmi fəaliyyət müddəti', value: `${customer.officialActivityYears} il` },
            { label: 'Qeyri-rəsmi fəaliyyət müddəti', value: `${customer.unofficialActivityYears} il` },
            { label: 'Ünvan', value: customer.address },
            { label: 'ATB müştərisidir', value: dateAz(customer.existingAtbCustomerSince) },
          ]}
        />
      </Panel>

      <Panel title="Sifariş parametrləri" subtitle="Tələb olunan və təklif olunan struktur ayrıca saxlanılır">
        <DataTable
          head={
            <tr>
              <Th>Parametr</Th>
              <Th align="right">Sifariş</Th>
              <Th align="right">Bankın təklifi</Th>
            </tr>
          }
        >
          {[
            ['Məbləğ', aznFull(s.amount), p ? aznFull(p.amount) : '—'],
            ['Valyuta', s.currency, p?.currency ?? '—'],
            ['Müddət (ay)', s.tenorMonths, p?.tenorMonths ?? '—'],
            ['Güzəşt dövrü (ay)', s.gracePeriodMonths, p?.gracePeriodMonths ?? '—'],
            ['İllik faiz', `${s.annualRatePct}%`, p ? `${p.annualRatePct}%` : '—'],
            ['Komissiya', `${s.commissionPct}%`, p ? `${p.commissionPct}%` : '—'],
            ['Ödəniş tezliyi', s.repaymentFrequency, p?.repaymentFrequency ?? '—'],
            ['Amortizasiya', s.amortisation, p?.amortisation ?? '—'],
            ['Məhsul', PRODUCT_LABEL_AZ[s.product], p ? PRODUCT_LABEL_AZ[p.product] : '—'],
          ].map(([label, a, b], i) => (
            <tr key={i}>
              <Td>{label}</Td>
              <Td align="right">{a}</Td>
              <Td align="right" className={p ? 'text-sky-300' : ''}>
                {b}
              </Td>
            </tr>
          ))}
        </DataTable>
        <div className="mt-3 border-t border-slate-800 pt-2">
          <KeyValue
            items={[
              { label: 'Filial', value: app.branch },
              { label: 'Müştəri meneceri', value: app.rm },
              { label: 'Anderrayter', value: app.underwriter ?? '—' },
              { label: 'Kanal', value: app.channel },
              { label: 'Əsas ödəniş mənbəyi', value: app.primaryRepaymentSource },
              { label: 'Əlavə ödəniş mənbəyi', value: app.secondaryRepaymentSource },
            ]}
          />
        </div>
      </Panel>

      <Panel title="Biznes profili" subtitle="Business profile">
        <KeyValue
          items={[
            { label: 'Sektor', value: customer.sector },
            { label: 'Alt-sektor', value: customer.subSector },
            { label: 'Biznes modeli', value: customer.businessModel },
            { label: 'Məhsullar', value: customer.products.join(', ') || '—' },
            { label: 'Coğrafiya', value: customer.geography },
            { label: 'Obyekt sayı', value: customer.locations },
            { label: 'İşçi sayı', value: customer.employees },
            { label: 'Mövsümilik', value: customer.seasonality },
          ]}
        />
        <div className="mt-3 border-t border-slate-800 pt-2">
          <div className="mb-1.5 text-[10px] uppercase tracking-wide text-slate-500">Aylıq mövsümilik indeksi</div>
          <div className="flex h-14 items-end gap-1">
            {customer.seasonalityIndex.map((v, i) => (
              <div key={i} className="flex-1" title={`${i + 1}-ci ay: ${v.toFixed(2)}`}>
                <div
                  className="rounded-sm bg-sky-500/60"
                  style={{ height: `${Math.min((v / Math.max(...customer.seasonalityIndex)) * 52, 52)}px` }}
                />
              </div>
            ))}
          </div>
        </div>
      </Panel>

      <Panel title="Mülkiyyət və idarəetmə" subtitle="Ownership & management">
        <div className="mb-1.5 text-[10px] uppercase tracking-wide text-slate-500">Təsisçilər</div>
        <DataTable
          head={
            <tr>
              <Th>Ad</Th>
              <Th align="right">Pay</Th>
              <Th align="center">UBO</Th>
              <Th>Digər bizneslər</Th>
            </tr>
          }
        >
          {customer.shareholders.map((sh) => (
            <tr key={sh.id}>
              <Td>{sh.name}</Td>
              <Td align="right">{sh.ownershipPct}%</Td>
              <Td align="center">{sh.isUbo ? <Badge tone="sky">UBO</Badge> : '—'}</Td>
              <Td className="text-[10.5px] text-slate-400">{sh.otherBusinesses?.join(', ') ?? '—'}</Td>
            </tr>
          ))}
        </DataTable>

        <div className="mb-1.5 mt-4 text-[10px] uppercase tracking-wide text-slate-500">İdarəetmə</div>
        <DataTable
          head={
            <tr>
              <Th>Ad</Th>
              <Th>Vəzifə</Th>
              <Th align="right">Şirkətdə</Th>
              <Th align="right">Sektorda</Th>
              <Th align="center">Açar şəxs</Th>
            </tr>
          }
        >
          {customer.management.map((m) => (
            <tr key={m.id}>
              <Td>
                {m.name}
                {m.note && <div className="text-[10px] text-amber-400/80">{m.note}</div>}
              </Td>
              <Td>{m.role}</Td>
              <Td align="right">{m.yearsInCompany} il</Td>
              <Td align="right">{m.yearsInSector} il</Td>
              <Td align="center">{m.isKeyPerson ? <Badge tone="amber">Bəli</Badge> : '—'}</Td>
            </tr>
          ))}
        </DataTable>
      </Panel>

      <Panel title="Müştəri konsentrasiyası" subtitle="Customer concentration">
        <DataTable
          head={
            <tr>
              <Th>Müştəri</Th>
              <Th align="right">Satışda payı</Th>
              <Th>Paylanma</Th>
            </tr>
          }
        >
          {customer.keyCustomers.map((k, i) => (
            <tr key={i}>
              <Td>{k.name}</Td>
              <Td align="right">{k.sharePct}%</Td>
              <Td>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
                  <div className="h-full rounded-full bg-sky-500" style={{ width: `${k.sharePct}%` }} />
                </div>
              </Td>
            </tr>
          ))}
        </DataTable>
        <div className="mt-2 text-[10.5px] text-slate-500">
          İlk iki müştərinin payı:{' '}
          {pct(
            customer.keyCustomers
              .slice(0, 2)
              .reduce((s, k) => s + k.sharePct, 0) / 100,
          )}
        </div>
      </Panel>

      <Panel title="Təchizatçı strukturu" subtitle="Supplier structure">
        <DataTable
          head={
            <tr>
              <Th>Təchizatçı</Th>
              <Th align="right">Alışda payı</Th>
              <Th>Ödəniş şərtləri</Th>
            </tr>
          }
        >
          {customer.keySuppliers.map((k, i) => (
            <tr key={i}>
              <Td>{k.name}</Td>
              <Td align="right">{k.sharePct}%</Td>
              <Td>{k.paymentTerms}</Td>
            </tr>
          ))}
        </DataTable>
      </Panel>
    </div>
  );
}
