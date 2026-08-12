'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

export const APPLICATION_TABS = [
  { slug: '', label: 'İcmal', en: 'Overview' },
  { slug: 'profil', label: 'Müştəri və biznes', en: 'Customer & Business' },
  { slug: 'senedler', label: 'Sənədlər', en: 'Documents & Evidence' },
  { slug: 'akb', label: 'AKB və ekspozisiya', en: 'Bureau & Group Exposure' },
  { slug: 'balans-mzh', label: 'Balans / MZH', en: 'Balance Sheet & P&L' },
  { slug: 'pul-axini', label: 'Pul axını', en: 'Cash Flow & Forecast' },
  { slug: 'emsallar', label: 'Maliyyə əmsalları', en: 'Financial Ratios' },
  { slug: 'muqayise', label: 'Müqayisəli təhlil', en: 'Comparative Analysis' },
  { slug: 'cross-checks', label: 'Cross-check', en: 'Reconciliation' },
  { slug: 'meqsed-girov', label: 'Məqsəd və girov', en: 'Purpose & Collateral' },
  { slug: 'reytinq', label: 'Risk reytinqi', en: 'Risk Rating' },
  { slug: 'siyaset', label: 'Siyasət', en: 'Policy & Stop Factors' },
  { slug: 'strukturlasdirma', label: 'Strukturlaşdırma', en: 'Loan Structuring' },
  { slug: 'rey', label: 'Anderraytinq rəyi', en: 'Underwriting Opinion' },
  { slug: 'qerar', label: 'Qərar marşrutu', en: 'Approval Routing' },
  { slug: 'audit', label: 'Audit izi', en: 'Audit Trail' },
];

export function ApplicationTabs({ applicationId }: { applicationId: string }) {
  const pathname = usePathname();
  const base = `/applications/${applicationId}`;

  return (
    <nav className="sticky top-0 z-20 -mx-6 border-b border-slate-800 bg-slate-950/95 px-6 backdrop-blur">
      <div className="flex gap-0.5 overflow-x-auto">
        {APPLICATION_TABS.map((tab) => {
          const href = tab.slug ? `${base}/${tab.slug}` : base;
          const active = pathname === href;
          return (
            <Link
              key={tab.slug || 'overview'}
              href={href}
              title={tab.en}
              className={cn(
                'whitespace-nowrap border-b-2 px-3 py-2 text-[11.5px] transition-colors',
                active
                  ? 'border-sky-400 font-medium text-sky-300'
                  : 'border-transparent text-slate-400 hover:border-slate-700 hover:text-slate-200',
              )}
            >
              {tab.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
