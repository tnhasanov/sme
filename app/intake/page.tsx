'use client';

import { useCallback, useMemo, useState } from 'react';
import { AlertTriangle, ArrowLeft, ArrowRight, Download, Loader2, Play, RotateCcw } from 'lucide-react';

import { UploadZone, type UploadedFile } from '@/components/intake/upload-zone';
import { ExtractionPreview, type Overrides } from '@/components/intake/extraction-preview';
import { CaseForm, DEFAULT_CASE_FORM, type CaseFormValue } from '@/components/intake/case-form';
import { IntakeAnalysis } from '@/components/intake/intake-analysis';
import { Badge, EmptyState, Panel } from '@/components/ui/primitives';
import { parseWorkbook, type ParseResult, type SheetInput } from '@/domain/intake/workbook-parser';
import { buildApplicationFromIntake } from '@/domain/intake/build-application';
import { assessApplication, type Assessment } from '@/services/assessment';
import type { CreditApplication, CreditDocument, Customer, DocumentCategory } from '@/types/application';
import { downloadSampleWorkbook } from '@/lib/sample-workbook';
import { cn } from '@/lib/utils';

/**
 * Analyst intake wizard (§72).
 *
 * Upload → parse → verify → complete the case → run the full assessment. The
 * whole chain is client-side because every engine is a pure function: the
 * customer's financial file never leaves the browser, which is also what the
 * privacy constraint requires — no document is posted to any external service.
 *
 * The verification step is not optional decoration. A machine-read figure that
 * nobody looked at is exactly the kind of input that produces a confident,
 * wrong credit decision, so the parser's confidence and its unmapped rows are
 * shown before anything is calculated.
 */

type Step = 'UPLOAD' | 'VERIFY' | 'CASE' | 'ANALYSIS';

const STEPS: Array<{ key: Step; label: string; hint: string }> = [
  { key: 'UPLOAD', label: 'Fayl yükləmə', hint: 'Maliyyə iş kitabı və sənədlər' },
  { key: 'VERIFY', label: 'Oxunanı yoxlama', hint: 'Dövr seçimi və düzəliş' },
  { key: 'CASE', label: 'Sifariş məlumatları', hint: 'Müştəri, kredit, AKB, girov' },
  { key: 'ANALYSIS', label: 'Təhlil və rəy', hint: 'Kross-yoxlama və anderrayter rəyi' },
];

interface AnalysisState {
  application: CreditApplication;
  customer: Customer;
  assessment: Assessment;
  missingFields: string[];
}

const DOC_CATEGORY_BY_HINT: Array<{ match: RegExp; category: DocumentCategory }> = [
  { match: /akb|bureau|kredit.?tarix/i, category: 'BUREAU_REPORT' },
  { match: /vergi|tax|beyan/i, category: 'TAX' },
  { match: /girov|qiym[əe]tl[əe]ndirm|valuation/i, category: 'VALUATION' },
  { match: /sığorta|sigorta|insurance/i, category: 'INSURANCE' },
  { match: /müqavil|muqavil|contract/i, category: 'CONTRACT' },
  { match: /anbar|inventar|sayım|sayim/i, category: 'INVENTORY_LIST' },
  { match: /debitor/i, category: 'RECEIVABLE_LIST' },
  { match: /kreditor|techizat|təchizat/i, category: 'PAYABLE_LIST' },
  { match: /bank|çıxarış|cixaris|statement/i, category: 'BANK_STATEMENT' },
];

function categoriseDocument(name: string): DocumentCategory {
  return DOC_CATEGORY_BY_HINT.find((r) => r.match.test(name))?.category ?? 'OTHER';
}

export default function IntakePage() {
  const [step, setStep] = useState<Step>('UPLOAD');
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [parse, setParse] = useState<ParseResult | null>(null);
  const [parsing, setParsing] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);

  const [selectedColumns, setSelectedColumns] = useState<number[]>([]);
  const [primaryColumn, setPrimaryColumn] = useState<number | null>(null);
  const [overrides, setOverrides] = useState<Overrides>({ balance: {}, income: {}, cashFlow: {} });

  const [form, setForm] = useState<CaseFormValue>(DEFAULT_CASE_FORM);
  const [analysis, setAnalysis] = useState<AnalysisState | null>(null);
  const [analysisError, setAnalysisError] = useState<string | null>(null);

  const periods = parse?.balance?.periods ?? parse?.income?.periods ?? [];

  /* ---------------- Parsing ---------------- */

  const runParse = useCallback(async (uploaded: UploadedFile[]) => {
    const workbooks = uploaded.filter((f) => f.kind === 'WORKBOOK');
    if (workbooks.length === 0) {
      setParseError('Ən azı bir Excel/CSV faylı yükləyin — maliyyə hesabatları oradan oxunur.');
      return;
    }

    setParsing(true);
    setParseError(null);
    try {
      // Several workbooks are merged into one sheet list; the parser takes the
      // first sheet of each kind, so a balance in one file and an MZH in
      // another still produce a complete case.
      const XLSX = await import('xlsx');
      const sheets: SheetInput[] = [];
      for (const wbFile of workbooks) {
        const buffer = await wbFile.file.arrayBuffer();
        const wb = XLSX.read(buffer, { type: 'array', cellDates: false });
        for (const name of wb.SheetNames) {
          const ws = wb.Sheets[name];
          if (!ws) continue;
          const rows = XLSX.utils.sheet_to_json<Array<string | number | null>>(ws, {
            header: 1,
            raw: true,
            defval: null,
            blankrows: true,
          });
          sheets.push({ name, rows });
        }
      }

      const result = parseWorkbook(workbooks.map((f) => f.name).join(', '), sheets);
      setParse(result);

      const detected = result.balance?.periods ?? result.income?.periods ?? [];
      const historic = detected.filter((p) => !p.isForecast);
      setSelectedColumns(historic.map((p) => p.columnIndex));
      setPrimaryColumn(historic.at(-1)?.columnIndex ?? null);
      setOverrides({ balance: {}, income: {}, cashFlow: {} });
      setStep('VERIFY');
    } catch (e) {
      setParseError(
        `Fayl oxunmadı: ${e instanceof Error ? e.message : 'naməlum xəta'}. Faylın parolla qorunmadığını yoxlayın.`,
      );
    } finally {
      setParsing(false);
    }
  }, []);

  /* ---------------- Assessment ---------------- */

  const runAnalysis = useCallback(() => {
    if (!parse || primaryColumn === null) return;
    setAnalysisError(null);
    try {
      const built = buildApplicationFromIntake({
        parse,
        selectedPeriodColumns: selectedColumns,
        primaryPeriodColumn: primaryColumn,
        customer: form.customer,
        loan: form.loan,
        bureau: form.bureau,
        collateral: form.collateral,
        overrides,
      });

      const now = new Date().toISOString();
      const documents: CreditDocument[] = files
        .filter((f) => f.kind === 'DOCUMENT')
        .map((f, i) => ({
          id: `doc-in-${i}`,
          applicationId: built.application.id,
          category: categoriseDocument(f.name),
          name: f.name,
          sourceType: 'CUSTOMER_DOCUMENT',
          uploadedBy: form.loan.rm,
          uploadedAt: now,
          evidence: 'PARTIALLY_VERIFIED',
          relatedMetrics: [],
          mandatory: false,
          received: true,
        }));

      const application: CreditApplication = { ...built.application, documents };
      const assessment = assessApplication(application, built.customer);

      setAnalysis({
        application,
        customer: built.customer,
        assessment,
        missingFields: built.missingFields,
      });
      setStep('ANALYSIS');
    } catch (e) {
      setAnalysisError(
        `Təhlil aparıla bilmədi: ${e instanceof Error ? e.message : 'naməlum xəta'}. Oxunmuş dəyərləri yoxlayın.`,
      );
    }
  }, [parse, primaryColumn, selectedColumns, form, overrides, files]);

  const reset = () => {
    setStep('UPLOAD');
    setFiles([]);
    setParse(null);
    setParseError(null);
    setSelectedColumns([]);
    setPrimaryColumn(null);
    setOverrides({ balance: {}, income: {}, cashFlow: {} });
    setAnalysis(null);
    setAnalysisError(null);
  };

  const canContinueFromVerify = selectedColumns.length > 0 && primaryColumn !== null;
  const canRunAnalysis = canContinueFromVerify && form.customer.legalName.trim().length > 0;

  const stepIndex = useMemo(() => STEPS.findIndex((s) => s.key === step), [step]);

  return (
    <div className="mx-auto max-w-[1400px] space-y-4 px-5 py-5">
      {/* ---------------- Header ---------------- */}
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-[17px] font-semibold tracking-tight text-slate-100">Fayl yükləmə və avtomatik təhlil</h1>
          <p className="mt-0.5 max-w-[760px] text-[11.5px] leading-relaxed text-slate-400">
            KOB analitiki maliyyə faylını yükləyir, sistem hesabatları oxuyur, kross-yoxlamaları aparır və
            anderrayter üçün rəy layihəsi hazırlayır. Yekun qərar insana aiddir — sistem yalnız layihə verir.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => downloadSampleWorkbook()}
            className="flex items-center gap-1.5 rounded border border-slate-700 px-2.5 py-1.5 text-[11px] text-slate-300 transition-colors hover:border-slate-600 hover:text-slate-100"
          >
            <Download className="h-3.5 w-3.5" /> Nümunə şablonu endir
          </button>
          {(parse || analysis) && (
            <button
              onClick={reset}
              className="flex items-center gap-1.5 rounded border border-slate-800 px-2.5 py-1.5 text-[11px] text-slate-500 transition-colors hover:border-slate-700 hover:text-slate-300"
            >
              <RotateCcw className="h-3.5 w-3.5" /> Yenidən başla
            </button>
          )}
        </div>
      </header>

      {/* ---------------- Stepper ---------------- */}
      <nav className="flex flex-wrap gap-1.5">
        {STEPS.map((s, i) => {
          const reachable =
            i === 0 || (i === 1 && !!parse) || (i === 2 && !!parse) || (i === 3 && !!analysis);
          const active = s.key === step;
          return (
            <button
              key={s.key}
              disabled={!reachable}
              onClick={() => reachable && setStep(s.key)}
              className={cn(
                'flex min-w-[180px] flex-1 items-center gap-2.5 rounded border px-3 py-2 text-left transition-colors',
                active
                  ? 'border-sky-500/40 bg-sky-500/10'
                  : reachable
                    ? 'border-slate-800 hover:border-slate-700'
                    : 'cursor-not-allowed border-slate-900 opacity-50',
              )}
            >
              <span
                className={cn(
                  'flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold',
                  active
                    ? 'bg-sky-500 text-white'
                    : i < stepIndex
                      ? 'bg-emerald-500/20 text-emerald-300'
                      : 'bg-slate-800 text-slate-500',
                )}
              >
                {i + 1}
              </span>
              <span className="min-w-0">
                <span className={cn('block truncate text-[11.5px]', active ? 'text-sky-200' : 'text-slate-300')}>
                  {s.label}
                </span>
                <span className="block truncate text-[10px] text-slate-500">{s.hint}</span>
              </span>
            </button>
          );
        })}
      </nav>

      {/* ---------------- Step: upload ---------------- */}
      {step === 'UPLOAD' && (
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
          <Panel
            title="1. Fayllar"
            subtitle="Balans, MZH və pul axını vərəqləri olan iş kitabı; əlavə sənədlər sənəd reyestrinə düşür"
          >
            <UploadZone files={files} onChange={setFiles} disabled={parsing} />

            {parseError && (
              <div className="mt-3 flex items-start gap-2 rounded border border-rose-500/30 bg-rose-500/5 px-3 py-2 text-[11.5px] text-rose-200">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                {parseError}
              </div>
            )}

            <div className="mt-3 flex justify-end">
              <button
                disabled={parsing || files.every((f) => f.kind !== 'WORKBOOK')}
                onClick={() => runParse(files)}
                className={cn(
                  'flex items-center gap-1.5 rounded px-3 py-2 text-[12px] font-medium transition-colors',
                  parsing || files.every((f) => f.kind !== 'WORKBOOK')
                    ? 'cursor-not-allowed bg-slate-800 text-slate-500'
                    : 'bg-sky-600 text-white hover:bg-sky-500',
                )}
              >
                {parsing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ArrowRight className="h-3.5 w-3.5" />}
                {parsing ? 'Oxunur…' : 'Faylı oxu'}
              </button>
            </div>
          </Panel>

          <Panel title="Necə işləyir" subtitle="Prosesin dörd addımı">
            <ol className="space-y-2.5 text-[11.5px] leading-relaxed text-slate-400">
              <li>
                <strong className="text-slate-200">1. Oxuma.</strong> Vərəqlər adına, sətirlər isə etiketinə görə
                tanınır — sətir nömrəsinə görə yox. Şablonda sətir əlavə etsəniz belə oxunacaq.
              </li>
              <li>
                <strong className="text-slate-200">2. Yoxlama.</strong> Hər dəyər üçün etibarlılıq göstərilir və
                tanınmayan sətirlər ayrıca siyahıda qalır. Heç nə səssizcə atılmır.
              </li>
              <li>
                <strong className="text-slate-200">3. Tamamlama.</strong> Faylda olmayan məlumat — kimlik, kredit
                strukturu, AKB xülasəsi, girov — analitik tərəfindən daxil edilir.
              </li>
              <li>
                <strong className="text-slate-200">4. Təhlil.</strong> Əmsallar, pul axını, reytinq, siyasət və stop
                faktorlar hesablanır, kross-yoxlamalar aparılır və anderrayterə rəy layihəsi verilir.
              </li>
            </ol>
            <p className="mt-3 border-t border-slate-800 pt-2 text-[10.5px] leading-relaxed text-slate-500">
              Fayl brauzerdən çıxmır: bütün hesablamalar yerli olaraq aparılır, heç bir sənəd xarici xidmətə
              göndərilmir.
            </p>
          </Panel>
        </div>
      )}

      {/* ---------------- Step: verify ---------------- */}
      {step === 'VERIFY' && parse && (
        <div className="space-y-4">
          <Panel
            title="2. Dövrlər"
            subtitle="Təhlilə daxil ediləcək sütunları seçin; əsas dövr bütün əmsalların hesablandığı dövrdür"
          >
            {periods.length === 0 ? (
              <EmptyState>
                Dövr sütunu tanınmadı. Başlıq sətrində dövrlər il ilə göstərilməlidir (məs. «2025», «2025 6 ay»).
              </EmptyState>
            ) : (
              <div className="space-y-2">
                <div className="flex flex-wrap gap-1.5">
                  {periods.map((p) => {
                    const on = selectedColumns.includes(p.columnIndex);
                    return (
                      <button
                        key={p.columnIndex}
                        onClick={() =>
                          setSelectedColumns((cols) =>
                            on ? cols.filter((c) => c !== p.columnIndex) : [...cols, p.columnIndex].sort((a, b) => a - b),
                          )
                        }
                        className={cn(
                          'rounded px-2.5 py-1.5 text-[11px] ring-1 ring-inset transition-colors',
                          on
                            ? 'bg-sky-500/15 text-sky-200 ring-sky-500/40'
                            : 'text-slate-500 ring-slate-800 hover:text-slate-300',
                        )}
                      >
                        {p.label}
                        {p.monthsCovered !== 12 && (
                          <span className="ml-1 text-[9.5px] text-amber-300">{p.monthsCovered} ay</span>
                        )}
                        {p.isForecast && <span className="ml-1 text-[9.5px] text-violet-300">proqnoz</span>}
                      </button>
                    );
                  })}
                </div>

                <div className="flex flex-wrap items-center gap-2 border-t border-slate-800 pt-2">
                  <span className="text-[10px] uppercase tracking-wide text-slate-500">Əsas dövr</span>
                  <select
                    value={primaryColumn ?? ''}
                    onChange={(e) => setPrimaryColumn(e.target.value === '' ? null : Number(e.target.value))}
                    className="rounded border border-slate-700 bg-slate-950/60 px-2 py-1 text-[11.5px] text-slate-200 outline-none focus:border-sky-600"
                  >
                    <option value="">seçin…</option>
                    {periods
                      .filter((p) => selectedColumns.includes(p.columnIndex))
                      .map((p) => (
                        <option key={p.columnIndex} value={p.columnIndex}>
                          {p.label}
                        </option>
                      ))}
                  </select>
                  {periods.find((p) => p.columnIndex === primaryColumn)?.monthsCovered !== 12 &&
                    primaryColumn !== null && (
                      <Badge tone="amber">
                        Natamam dövr — göstəricilər illik bazaya gətiriləcək
                      </Badge>
                    )}
                </div>
              </div>
            )}
          </Panel>

          <ExtractionPreview
            parse={parse}
            selectedColumns={selectedColumns}
            overrides={overrides}
            onOverride={setOverrides}
          />

          <div className="flex items-center justify-between">
            <button
              onClick={() => setStep('UPLOAD')}
              className="flex items-center gap-1.5 rounded border border-slate-800 px-3 py-2 text-[11.5px] text-slate-400 transition-colors hover:border-slate-700 hover:text-slate-200"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Geri
            </button>
            <button
              disabled={!canContinueFromVerify}
              onClick={() => setStep('CASE')}
              className={cn(
                'flex items-center gap-1.5 rounded px-3 py-2 text-[12px] font-medium transition-colors',
                canContinueFromVerify
                  ? 'bg-sky-600 text-white hover:bg-sky-500'
                  : 'cursor-not-allowed bg-slate-800 text-slate-500',
              )}
            >
              Sifariş məlumatlarına keç <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* ---------------- Step: case ---------------- */}
      {step === 'CASE' && (
        <div className="space-y-4">
          <CaseForm value={form} onChange={setForm} />

          {analysisError && (
            <div className="flex items-start gap-2 rounded border border-rose-500/30 bg-rose-500/5 px-3 py-2 text-[11.5px] text-rose-200">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              {analysisError}
            </div>
          )}

          <div className="flex items-center justify-between">
            <button
              onClick={() => setStep('VERIFY')}
              className="flex items-center gap-1.5 rounded border border-slate-800 px-3 py-2 text-[11.5px] text-slate-400 transition-colors hover:border-slate-700 hover:text-slate-200"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Oxunanı yenidən yoxla
            </button>
            <div className="flex items-center gap-3">
              {!canRunAnalysis && (
                <span className="text-[10.5px] text-amber-300">Müştərinin hüquqi adı doldurulmalıdır.</span>
              )}
              <button
                disabled={!canRunAnalysis}
                onClick={runAnalysis}
                className={cn(
                  'flex items-center gap-1.5 rounded px-3.5 py-2 text-[12px] font-medium transition-colors',
                  canRunAnalysis
                    ? 'bg-sky-600 text-white hover:bg-sky-500'
                    : 'cursor-not-allowed bg-slate-800 text-slate-500',
                )}
              >
                <Play className="h-3.5 w-3.5" /> Təhlili işlət və rəy hazırla
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ---------------- Step: analysis ---------------- */}
      {step === 'ANALYSIS' && analysis && (
        <div className="space-y-4">
          {analysis.missingFields.length > 0 && (
            <Panel title="Diqqət tələb edən boşluqlar" subtitle="Təhlil aparılıb, lakin bu məlumatlar tam deyil">
              <ul className="space-y-1">
                {analysis.missingFields.map((m, i) => (
                  <li key={i} className="flex gap-2 text-[11.5px] leading-relaxed text-amber-200">
                    <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    {m}
                  </li>
                ))}
              </ul>
            </Panel>
          )}

          <IntakeAnalysis
            application={analysis.application}
            customer={analysis.customer}
            assessment={analysis.assessment}
          />

          <div className="flex justify-start">
            <button
              onClick={() => setStep('CASE')}
              className="flex items-center gap-1.5 rounded border border-slate-800 px-3 py-2 text-[11.5px] text-slate-400 transition-colors hover:border-slate-700 hover:text-slate-200"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Məlumatları düzəlt və yenidən hesabla
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
