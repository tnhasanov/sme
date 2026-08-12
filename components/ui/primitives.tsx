import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import type { Severity, SourceStatus } from '@/types/core';
import { SEVERITY_CLASS, SEVERITY_LABEL_AZ } from '@/lib/format';

/**
 * Dense enterprise primitives.
 *
 * The workstation is desktop-first and data-dense on purpose: an underwriter
 * comparing twenty ratios should not have to scroll past decorative padding.
 */

export function Panel({
  title,
  subtitle,
  actions,
  children,
  className,
  bodyClassName,
  id,
}: {
  title?: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
  id?: string;
}) {
  return (
    <section
      id={id}
      className={cn('rounded-lg border border-slate-800 bg-slate-900/40 shadow-sm', className)}
    >
      {(title || actions) && (
        <header className="flex items-start justify-between gap-4 border-b border-slate-800 px-4 py-2.5">
          <div className="min-w-0">
            {title && <h2 className="text-[13px] font-semibold tracking-tight text-slate-100">{title}</h2>}
            {subtitle && <p className="mt-0.5 text-[11px] leading-snug text-slate-400">{subtitle}</p>}
          </div>
          {actions && <div className="shrink-0 text-[11px] text-slate-400">{actions}</div>}
        </header>
      )}
      <div className={cn('px-4 py-3', bodyClassName)}>{children}</div>
    </section>
  );
}

export function Badge({
  children,
  tone = 'slate',
  className,
  title,
}: {
  children: ReactNode;
  tone?: 'slate' | 'emerald' | 'lime' | 'amber' | 'orange' | 'rose' | 'sky' | 'violet' | 'stone';
  className?: string;
  title?: string;
}) {
  const tones: Record<string, string> = {
    slate: 'bg-slate-500/15 text-slate-300 ring-slate-500/30',
    emerald: 'bg-emerald-500/15 text-emerald-300 ring-emerald-500/30',
    lime: 'bg-lime-500/15 text-lime-300 ring-lime-500/30',
    amber: 'bg-amber-500/15 text-amber-300 ring-amber-500/30',
    orange: 'bg-orange-500/15 text-orange-300 ring-orange-500/30',
    rose: 'bg-rose-500/15 text-rose-300 ring-rose-500/30',
    sky: 'bg-sky-500/15 text-sky-300 ring-sky-500/30',
    violet: 'bg-violet-500/15 text-violet-300 ring-violet-500/30',
    stone: 'bg-stone-500/15 text-stone-300 ring-stone-500/30',
  };
  return (
    <span
      title={title}
      className={cn(
        'inline-flex items-center gap-1 whitespace-nowrap rounded px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide ring-1 ring-inset',
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function SeverityBadge({ severity }: { severity: Severity }) {
  return (
    <span
      className={cn(
        'inline-flex items-center whitespace-nowrap rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ring-1 ring-inset',
        SEVERITY_CLASS[severity],
      )}
    >
      {SEVERITY_LABEL_AZ[severity]}
    </span>
  );
}

const STATUS_TONE: Record<SourceStatus, { tone: Parameters<typeof Badge>[0]['tone']; label: string; hint: string }> = {
  CURRENT: { tone: 'emerald', label: 'Cari', hint: 'ATB-nin qüvvədə olan qaydası' },
  PROMETEIA_PROPOSED: {
    tone: 'violet',
    label: 'Prometeia təklifi',
    hint: 'Prometeia tərəfindən təklif edilib — təsdiqlənmiş siyasət deyil',
  },
  BANK_PROPOSED: { tone: 'sky', label: 'Bank təklifi', hint: 'Bankın daxili müzakirə variantı — tətbiq edilməyib' },
  HISTORICAL: { tone: 'stone', label: 'Tarixi', hint: 'Əvvəlki versiya' },
  INFERRED: { tone: 'amber', label: 'Nəticə çıxarılıb', hint: 'Mənbədə açıq göstərilməyib, praktikadan çıxarılıb' },
  NEEDS_CONFIRMATION: { tone: 'rose', label: 'Təsdiq tələb edir', hint: 'Mənbələr arasında ziddiyyət var' },
};

export function StatusBadge({ status }: { status: SourceStatus }) {
  const cfg = STATUS_TONE[status];
  return (
    <Badge tone={cfg.tone} title={cfg.hint}>
      {cfg.label}
    </Badge>
  );
}

export function Stat({
  label,
  value,
  sub,
  tone,
  hint,
}: {
  label: ReactNode;
  value: ReactNode;
  sub?: ReactNode;
  tone?: 'default' | 'good' | 'warn' | 'bad';
  hint?: string;
}) {
  const toneClass =
    tone === 'good'
      ? 'text-emerald-300'
      : tone === 'warn'
        ? 'text-amber-300'
        : tone === 'bad'
          ? 'text-rose-300'
          : 'text-slate-100';
  return (
    <div className="min-w-0" title={hint}>
      <div className="truncate text-[10px] uppercase tracking-wide text-slate-500">{label}</div>
      <div className={cn('mt-0.5 truncate text-[15px] font-semibold tabular-nums', toneClass)}>{value}</div>
      {sub && <div className="mt-0.5 truncate text-[10px] text-slate-500">{sub}</div>}
    </div>
  );
}

export function DataTable({
  head,
  children,
  dense = true,
  className,
}: {
  head: ReactNode;
  children: ReactNode;
  dense?: boolean;
  className?: string;
}) {
  return (
    <div className={cn('-mx-4 overflow-x-auto', className)}>
      <table className={cn('w-full min-w-full border-collapse', dense ? 'text-[11.5px]' : 'text-xs')}>
        <thead className="border-y border-slate-800 bg-slate-900/60 text-[10px] uppercase tracking-wide text-slate-500">
          {head}
        </thead>
        <tbody className="divide-y divide-slate-800/70">{children}</tbody>
      </table>
    </div>
  );
}

export function Th({
  children,
  align = 'left',
  className,
  colSpan,
}: {
  children?: ReactNode;
  align?: 'left' | 'right' | 'center';
  className?: string;
  colSpan?: number;
}) {
  return (
    <th
      colSpan={colSpan}
      className={cn(
        'px-3 py-1.5 font-medium',
        align === 'right' && 'text-right',
        align === 'center' && 'text-center',
        align === 'left' && 'text-left',
        className,
      )}
    >
      {children}
    </th>
  );
}

export function Td({
  children,
  align = 'left',
  className,
  colSpan,
  title,
}: {
  children?: ReactNode;
  align?: 'left' | 'right' | 'center';
  className?: string;
  colSpan?: number;
  title?: string;
}) {
  return (
    <td
      colSpan={colSpan}
      title={title}
      className={cn(
        'px-3 py-1.5 align-top text-slate-300',
        align === 'right' && 'text-right tabular-nums',
        align === 'center' && 'text-center',
        className,
      )}
    >
      {children}
    </td>
  );
}

export function KeyValue({ items }: { items: Array<{ label: ReactNode; value: ReactNode; hint?: string }> }) {
  return (
    <dl className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] gap-x-4 gap-y-1.5 text-[11.5px]">
      {items.map((item, i) => (
        <div key={i} className="contents">
          {/* Labels wrap rather than truncate: a hidden label in a credit file
              is a fact the reader silently loses. */}
          <dt className="leading-snug text-slate-500" title={item.hint}>
            {item.label}
          </dt>
          <dd className="min-w-0 break-words text-slate-200">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function ProgressBar({
  value,
  max = 1,
  tone = 'sky',
  className,
}: {
  value: number;
  max?: number;
  tone?: 'sky' | 'emerald' | 'amber' | 'rose';
  className?: string;
}) {
  const ratio = max > 0 ? Math.min(Math.max(value / max, 0), 1) : 0;
  const tones = {
    sky: 'bg-sky-500',
    emerald: 'bg-emerald-500',
    amber: 'bg-amber-500',
    rose: 'bg-rose-500',
  };
  return (
    <div className={cn('h-1.5 w-full overflow-hidden rounded-full bg-slate-800', className)}>
      <div className={cn('h-full rounded-full transition-all', tones[tone])} style={{ width: `${ratio * 100}%` }} />
    </div>
  );
}

export function EmptyState({ children }: { children: ReactNode }) {
  return (
    <div className="rounded border border-dashed border-slate-800 px-4 py-6 text-center text-[11.5px] text-slate-500">
      {children}
    </div>
  );
}

export function SectionTitle({ children, hint }: { children: ReactNode; hint?: string }) {
  return (
    <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400" title={hint}>
      {children}
    </h3>
  );
}

/** Bilingual label: Azerbaijani primary, English term as a tooltip (§87). */
export function Term({ az, en }: { az: string; en?: string }) {
  if (!en) return <>{az}</>;
  return (
    <span title={en} className="cursor-help decoration-slate-600 decoration-dotted underline-offset-2 hover:underline">
      {az}
    </span>
  );
}
