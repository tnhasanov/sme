import type { Metadata } from 'next';
import './globals.css';
import { AppShell } from '@/components/layout/app-shell';

export const metadata: Metadata = {
  title: 'ATB KOB Anderraytinq Platforması',
  description:
    'Kiçik və Orta Biznes kredit təhlili, risk qiymətləndirilməsi və anderraytinq iş stansiyası',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="az" className="dark">
      <body className="min-h-screen bg-slate-950 text-slate-200 antialiased">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
