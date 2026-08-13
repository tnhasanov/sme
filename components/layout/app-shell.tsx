'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import {
  Activity,
  Building2,
  FileStack,
  LayoutDashboard,
  PieChart,
  Settings2,
  ShieldCheck,
  UploadCloud,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const NAV = [
  { href: '/', label: 'İdarə paneli', en: 'Dashboard', icon: LayoutDashboard },
  { href: '/intake', label: 'Fayl yüklə və təhlil', en: 'Upload & Analyse', icon: UploadCloud },
  { href: '/applications', label: 'Sifarişlər', en: 'Applications', icon: FileStack },
  { href: '/customers', label: 'Müştərilər', en: 'Customers', icon: Building2 },
  { href: '/portfolio', label: 'Portfel', en: 'Portfolio', icon: PieChart },
  { href: '/model-monitoring', label: 'Model monitorinqi', en: 'Model Monitoring', icon: Activity },
  { href: '/configuration', label: 'Konfiqurasiya', en: 'Configuration', icon: Settings2 },
];

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="flex min-h-screen">
      <aside className="sticky top-0 flex h-screen w-[212px] shrink-0 flex-col border-r border-slate-800 bg-slate-950">
        <div className="flex items-center gap-2 border-b border-slate-800 px-4 py-3">
          <ShieldCheck className="h-5 w-5 text-sky-400" aria-hidden />
          <div className="min-w-0">
            <div className="truncate text-[12px] font-semibold tracking-tight text-slate-100">ATB Anderraytinq</div>
            <div className="truncate text-[10px] text-slate-500">KOB kredit iş stansiyası</div>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto p-2">
          {NAV.map((item) => {
            const active = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                title={item.en}
                className={cn(
                  'mb-0.5 flex items-center gap-2.5 rounded px-2.5 py-1.5 text-[12px] transition-colors',
                  active
                    ? 'bg-sky-500/10 font-medium text-sky-300 ring-1 ring-inset ring-sky-500/20'
                    : 'text-slate-400 hover:bg-slate-900 hover:text-slate-200',
                )}
              >
                <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden />
                <span className="truncate">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-slate-800 px-4 py-2.5 text-[10px] leading-relaxed text-slate-600">
          <div className="text-slate-500">Demo mühiti</div>
          <div>Bütün məlumatlar sintetikdir</div>
        </div>
      </aside>

      <main className="min-w-0 flex-1">{children}</main>
    </div>
  );
}
