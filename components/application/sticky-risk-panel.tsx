import Link from 'next/link';
import type { ApplicationCase } from '@/services/application-service';
import { AUTHORITY_LABEL_AZ } from '@/config/workflow';
import { GRADE_LABEL_AZ } from '@/config/rating';
import { aznFull, metricValue, pct, times } from '@/lib/format';
import { Badge, StatusBadge } from '@/components/ui/primitives';

/**
 * The sticky decision panel (§11).
 *
 * These are the fourteen numbers an underwriter needs to hold in their head
 * while reading any other tab, so they follow the reader across every screen.
 */

function Row({
  label,
  value,
  tone = 'default',
  hint,
  href,
}: {
  label: string;
  value: React.ReactNode;
  tone?: 'default' | 'good' | 'warn' | 'bad';
  hint?: string;
  href?: string;
}) {
  const toneClass =
    tone === 'good'
      ? 'text-emerald-300'
      : tone === 'warn'
        ? 'text-amber-300'
        : tone === 'bad'
          ? 'text-rose-300'
          : 'text-slate-100';
  const content = (
    <div className="flex items-baseline justify-between gap-2 py-[3px]" title={hint}>
      <span className="min-w-0 shrink truncate text-[10.5px] text-slate-500">{label}</span>
      <span className={`shrink-0 text-[11.5px] font-medium tabular-nums ${toneClass}`}>{value}</span>
    </div>
  );
  return href ? (
    <Link href={href} className="block rounded transition-colors hover:bg-slate-900/60">
      {content}
    </Link>
  ) : (
    content
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border-t border-slate-800 px-3 py-2 first:border-t-0">
      <div className="mb-1 text-[9.5px] font-semibold uppercase tracking-wider text-slate-600">{title}</div>
      {children}
    </div>
  );
}

export function StickyRiskPanel({ case: c }: { case: ApplicationCase }) {
  const { application: app, assessment: a } = c;
  const base = `/applications/${app.id}`;
  const structure = app.proposedStructure ?? app.requestedStructure;

  const dscr = a.repayment?.dscrAfter ?? null;
  const coverage = a.collateral.eligibleCoverage;
  const de = a.ratios.debtToEquityInclNew?.value ?? null;

  return (
    <aside className="sticky top-12 w-[268px] shrink-0 self-start">
      <div className="overflow-hidden rounded-lg border border-slate-800 bg-slate-900/60">
        <div className="border-b border-slate-800 bg-slate-900 px-3 py-2">
          <div className="text-[10px] uppercase tracking-wider text-slate-500">Qərar paneli</div>
          <div className="mt-0.5 truncate text-[12px] font-semibold text-slate-100">{c.customer.displayName}</div>
        </div>

        <Group title="Sifariş">
          <Row label="Tələb olunan məbləğ" value={aznFull(app.requestedStructure.amount)} />
          <Row
            label="Təklif olunan məbləğ"
            value={app.proposedStructure ? aznFull(app.proposedStructure.amount) : '— (təyin edilməyib)'}
            href={`${base}/strukturlasdirma`}
          />
          <Row label="Müddət / güzəşt" value={`${structure.tenorMonths} / ${structure.gracePeriodMonths} ay`} />
          <Row label="Aylıq ödəniş" value={aznFull(a.proposedMonthlyPayment)} />
        </Group>

        <Group title="Ekspozisiya">
          <Row
            label="Mövcud qrup ekspozisiyası"
            value={aznFull(a.groupExposure.existingTotalExposure)}
            href={`${base}/akb`}
          />
          <Row
            label="Post-əməliyyat ekspozisiya"
            value={aznFull(a.groupExposure.postTransactionGroupExposure)}
            tone="warn"
            hint="Approval routing bu göstəriciyə əsaslanır"
            href={`${base}/akb`}
          />
          <Row label="Seqment" value={a.rating.segment === 'MEDIUM' ? 'Orta (İri)' : 'Kiçik'} />
        </Group>

        <Group title="Reytinq">
          <Row
            label="AKB reytinqi"
            value={`${a.bureauRating.score ?? '—'} · ${a.bureauRating.grade ? GRADE_LABEL_AZ[a.bureauRating.grade] : '—'}`}
            href={`${base}/reytinq`}
          />
          <Row
            label="Yekun daxili reytinq"
            value={a.rating.finalGradeLabelAz}
            tone={a.rating.isWorstRating ? 'bad' : 'good'}
            href={`${base}/reytinq`}
          />
          <Row
            label="Yekun rəy (As-Is)"
            value={`${a.legacy.totalScore.toFixed(1)} / 100`}
            tone={a.legacy.globalStopTriggered ? 'bad' : 'default'}
            hint={a.legacy.bandLabelAz}
            href={`${base}/reytinq`}
          />
        </Group>

        <Group title="Ödəmə qabiliyyəti">
          <Row
            label="Ödəmə qabiliyyəti (CFADS)"
            value={`${aznFull(a.repayment?.cfads ?? null)} / ay`}
            tone={(a.repayment?.cfads ?? 0) > 0 ? 'good' : 'bad'}
            href={`${base}/strukturlasdirma`}
          />
          <Row
            label="Aylıq borc xidməti"
            value={`${aznFull(a.postTransactionMonthlyDebtService)} / ay`}
            href={`${base}/strukturlasdirma`}
          />
          <Row
            label="DSCR (əməliyyatdan sonra)"
            value={times(dscr)}
            tone={dscr === null ? 'default' : dscr < 1 ? 'bad' : dscr < 1.5 ? 'warn' : 'good'}
            href={`${base}/pul-axini`}
          />
          <Row
            label="Ödəniş / qabiliyyət"
            value={
              a.repayment?.paymentToCapacity !== null && a.repayment?.paymentToCapacity !== undefined
                ? Number.isFinite(a.repayment.paymentToCapacity)
                  ? pct(a.repayment.paymentToCapacity)
                  : 'qabiliyyət yoxdur'
                : '—'
            }
            tone={(a.repayment?.paymentToCapacity ?? 0) > 0.8 ? 'bad' : 'good'}
            hint="Norma ≤ 80% (KOB kreditlərinin verilməsi Metodologiyası)"
          />
        </Group>

        <Group title="Maliyyə vəziyyəti">
          <Row
            label="Borc / EBITDA"
            value={metricValue(a.ratios.debtToEbitda)}
            tone={(a.ratios.debtToEbitda?.value ?? 0) > 4 ? 'bad' : 'default'}
            href={`${base}/emsallar`}
          />
          <Row
            label="Kapitala nəzərən borclanma"
            value={times(de)}
            tone={de !== null && de > 1 ? 'bad' : 'good'}
            hint="Stop faktor həddi: 100%"
            href={`${base}/emsallar`}
          />
          <Row
            label="Cari likvidlik"
            value={metricValue(a.ratios.currentRatio)}
            tone={(a.ratios.currentRatio?.value ?? 0) < 1.5 ? 'warn' : 'good'}
            href={`${base}/emsallar`}
          />
          <Row label="İşlək kapital" value={aznFull(a.balance?.workingCapital ?? null)} href={`${base}/balans-mzh`} />
        </Group>

        <Group title="Təminat və keyfiyyət">
          <Row
            label="Uyğun girov örtüyü"
            value={coverage === null ? '—' : pct(coverage)}
            tone={coverage === null ? 'default' : coverage >= 1 ? 'good' : coverage >= 0.8 ? 'warn' : 'bad'}
            href={`${base}/meqsed-girov`}
          />
          <Row
            label="Məlumat keyfiyyəti"
            value={`${a.dataQuality.grade} — ${a.dataQuality.scorePct.toFixed(0)}`}
            tone={
              a.dataQuality.grade === 'A' || a.dataQuality.grade === 'B'
                ? 'good'
                : a.dataQuality.grade === 'C'
                  ? 'warn'
                  : 'bad'
            }
            href={`${base}/senedler`}
          />
          <Row
            label="Siyasət istisnaları"
            value={a.policy.exceptions.length}
            tone={a.policy.exceptions.length > 0 ? 'warn' : 'good'}
            href={`${base}/siyaset`}
          />
          <Row
            label="Stop faktorlar"
            value={a.activeStopFactors.length}
            tone={a.activeStopFactors.length > 0 ? 'bad' : 'good'}
            href={`${base}/siyaset`}
          />
        </Group>

        <div className="border-t border-slate-800 bg-slate-900/80 px-3 py-2.5">
          <div className="mb-1 text-[9.5px] font-semibold uppercase tracking-wider text-slate-600">
            Qərar səlahiyyəti
          </div>
          <Link
            href={`${base}/qerar`}
            className="block text-[11.5px] font-medium leading-snug text-sky-300 hover:text-sky-200"
          >
            {a.routing.decisionAuthority ? AUTHORITY_LABEL_AZ[a.routing.decisionAuthority] : 'Təyin edilməyib'}
          </Link>
          <div className="mt-1.5 flex flex-wrap items-center gap-1">
            <StatusBadge status={a.routing.workflowStatus} />
            {a.routing.escalated && <Badge tone="amber">Eskalasiya</Badge>}
          </div>
          <div className="mt-1 text-[10px] text-slate-500">{a.routing.workflowLabel}</div>
        </div>
      </div>
    </aside>
  );
}
