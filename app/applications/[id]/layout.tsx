import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';
import { getCase } from '@/services/application-service';
import { ApplicationTabs } from '@/components/layout/application-tabs';
import { StickyRiskPanel } from '@/components/application/sticky-risk-panel';
import { Badge } from '@/components/ui/primitives';
import { aznFull, dateAz, PRODUCT_LABEL_AZ, STAGE_LABEL_AZ } from '@/lib/format';

export default async function ApplicationLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { id: string };
}) {
  const c = await getCase(params.id);
  if (!c) notFound();

  const { application: app, customer, assessment: a } = c;

  return (
    <div className="mx-auto max-w-[1720px] px-6 py-4">
      <div className="mb-3 flex items-start justify-between gap-6">
        <div className="min-w-0">
          <Link
            href="/applications"
            className="mb-1 inline-flex items-center gap-1 text-[11px] text-slate-500 transition-colors hover:text-slate-300"
          >
            <ChevronLeft className="h-3 w-3" /> Sifarişlər
          </Link>
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-base font-semibold tracking-tight text-slate-100">{customer.displayName}</h1>
            <span className="rounded bg-slate-800 px-1.5 py-0.5 font-mono text-[10.5px] text-slate-400">
              {app.reference}
            </span>
            <Badge tone="slate">{STAGE_LABEL_AZ[app.stage] ?? app.stage}</Badge>
            {app.rejection && <Badge tone="rose">İmtina edilib</Badge>}
            {a.activeStopFactors.length > 0 && <Badge tone="rose">{a.activeStopFactors.length} stop faktor</Badge>}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-0.5 text-[11px] text-slate-500">
            <span>{customer.sector} · {customer.subSector}</span>
            <span>{PRODUCT_LABEL_AZ[app.requestedStructure.product]}</span>
            <span>{aznFull(app.requestedStructure.amount)}</span>
            <span>{app.branch} · {app.rm}</span>
            <span>Daxil olub: {dateAz(app.applicationDate)}</span>
          </div>
        </div>
      </div>

      <ApplicationTabs applicationId={app.id} />

      <div className="mt-4 flex gap-4">
        <div className="min-w-0 flex-1">{children}</div>
        <StickyRiskPanel case={c} />
      </div>
    </div>
  );
}
