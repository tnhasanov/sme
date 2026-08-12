import Link from 'next/link';
import { listCases, listCustomers } from '@/services/application-service';
import { DataTable, Panel, Stat, Td, Th } from '@/components/ui/primitives';
import { aznFull, dateAz } from '@/lib/format';

export default async function CustomersPage() {
  const customers = await listCustomers();
  const cases = await listCases();

  const rows = customers.map((customer) => {
    const own = cases.filter((c) => c.customer.id === customer.id);
    const live = own.filter((c) => !c.application.rejection);
    const exposure = live.reduce(
      (s, c) => s + c.assessment.groupExposure.postTransactionGroupExposure,
      0,
    );
    return { customer, applications: own, live, exposure };
  });

  const sectors = new Map<string, number>();
  for (const { customer } of rows) sectors.set(customer.sector, (sectors.get(customer.sector) ?? 0) + 1);

  return (
    <div className="mx-auto max-w-[1600px] px-6 py-5">
      <header className="mb-4">
        <h1 className="text-lg font-semibold tracking-tight text-slate-100">Müştərilər</h1>
        <p className="mt-0.5 text-[12px] text-slate-400">
          KOB müştəri bazası — bütün məlumatlar sintetikdir və real müştəri məlumatı ehtiva etmir
        </p>
      </header>

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Panel bodyClassName="py-3">
          <Stat label="Müştəri sayı" value={customers.length} />
        </Panel>
        <Panel bodyClassName="py-3">
          <Stat label="Sektor sayı" value={sectors.size} />
        </Panel>
        <Panel bodyClassName="py-3">
          <Stat
            label="Hüquqi şəxs / fərdi sahibkar"
            value={`${customers.filter((c) => c.customerType === 'LEGAL_ENTITY').length} / ${customers.filter((c) => c.customerType !== 'LEGAL_ENTITY').length}`}
          />
        </Panel>
        <Panel bodyClassName="py-3">
          <Stat label="Cəmi post-əməliyyat ekspozisiya" value={aznFull(rows.reduce((s, r) => s + r.exposure, 0))} />
        </Panel>
      </div>

      <Panel title="Müştəri reyestri" bodyClassName="px-0 py-0">
        <DataTable
          className="mx-0"
          head={
            <tr>
              <Th>Müştəri</Th>
              <Th>Növ</Th>
              <Th>Sektor / alt-sektor</Th>
              <Th>Region</Th>
              <Th align="right">Fəaliyyət</Th>
              <Th align="right">İşçi</Th>
              <Th align="right">Sifariş</Th>
              <Th align="right">Post-ekspozisiya</Th>
              <Th>ATB müştərisidir</Th>
            </tr>
          }
        >
          {rows.map(({ customer, applications, live, exposure }) => (
            <tr key={customer.id} className="transition-colors hover:bg-slate-900/50">
              <Td>
                <div className="max-w-[240px] truncate font-medium text-slate-100">{customer.displayName}</div>
                <div className="max-w-[240px] truncate text-[10px] text-slate-500">{customer.legalName}</div>
              </Td>
              <Td className="text-[10.5px]">
                {customer.customerType === 'LEGAL_ENTITY' ? 'Hüquqi şəxs' : 'Fərdi sahibkar'}
                <div className="text-slate-500">{customer.legalForm}</div>
              </Td>
              <Td className="max-w-[220px] text-[11px]">
                {customer.sector}
                <div className="truncate text-[10px] text-slate-500">{customer.subSector}</div>
              </Td>
              <Td className="text-[11px]">{customer.region}</Td>
              <Td align="right">{customer.officialActivityYears} il</Td>
              <Td align="right">{customer.employees}</Td>
              <Td align="right">
                {applications.length}
                {applications.length !== live.length && (
                  <div className="text-[10px] text-slate-500">{applications.length - live.length} imtina</div>
                )}
              </Td>
              <Td align="right">{exposure > 0 ? aznFull(exposure) : '—'}</Td>
              <Td className="text-[11px]">{dateAz(customer.existingAtbCustomerSince)}</Td>
            </tr>
          ))}
        </DataTable>
      </Panel>

      <Panel className="mt-4" title="Aktiv sifarişlər üzrə keçid" bodyClassName="px-0 py-0">
        <DataTable
          className="mx-0"
          head={
            <tr>
              <Th>Müştəri</Th>
              <Th>Sifariş</Th>
              <Th align="right">Məbləğ</Th>
              <Th>Mərhələ</Th>
            </tr>
          }
        >
          {cases.map(({ application, customer }) => (
            <tr key={application.id}>
              <Td>{customer.displayName}</Td>
              <Td>
                <Link href={`/applications/${application.id}`} className="text-sky-300 hover:underline">
                  {application.reference}
                </Link>
              </Td>
              <Td align="right">{aznFull(application.requestedStructure.amount)}</Td>
              <Td className="text-[11px] text-slate-400">{application.stage}</Td>
            </tr>
          ))}
        </DataTable>
      </Panel>
    </div>
  );
}
