'use client';

import { useCallback, useRef, useState } from 'react';
import { FileSpreadsheet, FileText, Upload, X } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface UploadedFile {
  name: string;
  size: number;
  kind: 'WORKBOOK' | 'DOCUMENT';
  file: File;
}

const WORKBOOK_EXT = ['.xlsx', '.xlsm', '.xls', '.csv'];

export function UploadZone({
  files,
  onChange,
  disabled,
}: {
  files: UploadedFile[];
  onChange: (files: UploadedFile[]) => void;
  disabled?: boolean;
}) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const add = useCallback(
    (incoming: FileList | null) => {
      if (!incoming) return;
      const mapped: UploadedFile[] = Array.from(incoming).map((file) => {
        const lower = file.name.toLowerCase();
        const isWorkbook = WORKBOOK_EXT.some((e) => lower.endsWith(e));
        return { name: file.name, size: file.size, kind: isWorkbook ? 'WORKBOOK' : 'DOCUMENT', file };
      });
      // Re-uploading the same filename replaces rather than duplicates it.
      const byName = new Map(files.map((f) => [f.name, f]));
      for (const m of mapped) byName.set(m.name, m);
      onChange([...byName.values()]);
    },
    [files, onChange],
  );

  return (
    <div>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled) setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          if (!disabled) add(e.dataTransfer.files);
        }}
        onClick={() => !disabled && inputRef.current?.click()}
        className={cn(
          'flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed px-6 py-8 text-center transition-colors',
          dragging ? 'border-sky-500 bg-sky-500/5' : 'border-slate-700 hover:border-slate-600',
          disabled && 'cursor-not-allowed opacity-50',
        )}
      >
        <Upload className="mb-2 h-6 w-6 text-slate-500" />
        <div className="text-[12.5px] font-medium text-slate-200">
          Maliyyə faylını buraya sürüşdürün və ya seçmək üçün klikləyin
        </div>
        <div className="mt-1 text-[11px] text-slate-500">
          Excel (.xlsx, .xls, .csv) — Balans, MZH, Pul axını vərəqləri avtomatik oxunur
        </div>
        <div className="mt-0.5 text-[10.5px] text-slate-600">
          PDF və digər sənədlər sənəd reyestrinə əlavə olunur
        </div>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept=".xlsx,.xlsm,.xls,.csv,.pdf,.doc,.docx,.png,.jpg,.jpeg"
          className="hidden"
          onChange={(e) => {
            add(e.target.files);
            e.target.value = '';
          }}
        />
      </div>

      {files.length > 0 && (
        <ul className="mt-3 space-y-1.5">
          {files.map((f) => (
            <li
              key={f.name}
              className="flex items-center gap-2.5 rounded border border-slate-800 bg-slate-950/40 px-2.5 py-1.5"
            >
              {f.kind === 'WORKBOOK' ? (
                <FileSpreadsheet className="h-4 w-4 shrink-0 text-emerald-400" />
              ) : (
                <FileText className="h-4 w-4 shrink-0 text-slate-500" />
              )}
              <span className="min-w-0 flex-1 truncate text-[11.5px] text-slate-200">{f.name}</span>
              <span className="shrink-0 text-[10px] text-slate-500">{(f.size / 1024).toFixed(0)} KB</span>
              <span
                className={cn(
                  'shrink-0 rounded px-1.5 py-0.5 text-[9.5px] uppercase tracking-wide ring-1 ring-inset',
                  f.kind === 'WORKBOOK'
                    ? 'bg-emerald-500/10 text-emerald-300 ring-emerald-500/30'
                    : 'bg-slate-500/10 text-slate-400 ring-slate-500/30',
                )}
              >
                {f.kind === 'WORKBOOK' ? 'təhlil ediləcək' : 'sənəd'}
              </span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onChange(files.filter((x) => x.name !== f.name));
                }}
                className="shrink-0 text-slate-600 transition-colors hover:text-rose-400"
                aria-label="Sil"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
