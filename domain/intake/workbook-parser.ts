import type { EvidenceStatus, SourceType } from '@/types/core';
import {
  BALANCE_LABELS,
  CASH_FLOW_LABELS,
  INCOME_LABELS,
  type BalanceField,
  type CashFlowField,
  type IncomeField,
  type SheetKind,
  detectSheetKind,
  matchField,
  normaliseLabel,
} from './labels';

/**
 * Workbook ingestion (§72 OCR/parser readiness).
 *
 * Pure functions over a already-read grid of cells, so the parser is testable
 * without a file and can run in the browser or on a server unchanged.
 *
 * The design principle is that the parser never pretends to be certain. Every
 * extracted figure carries the sheet, row label and column it came from, plus a
 * confidence, and everything it could not place is returned as `unmapped` for
 * the analyst to resolve. A silent mis-mapping in a credit file is worse than
 * an honest gap.
 */

export type Cell = string | number | null | undefined;
export type Grid = Cell[][];

export interface SheetInput {
  name: string;
  rows: Grid;
}

export interface DetectedPeriod {
  columnIndex: number;
  label: string;
  year: number | null;
  isForecast: boolean;
  monthsCovered: number;
}

export interface MappedValue<F extends string> {
  field: F;
  value: number;
  /** 0..1 — how sure the parser is that this row means this field. */
  confidence: number;
  sourceSheet: string;
  sourceRowLabel: string;
  sourceRowIndex: number;
  sourceColumnIndex: number;
  matchedPattern: string;
}

export interface UnmappedRow {
  sheet: string;
  rowIndex: number;
  label: string;
  values: number[];
  /** Set when a numeric row carried no usable label. */
  reason: 'NO_LABEL_MATCH' | 'AMBIGUOUS';
}

export interface StatementExtract<F extends string> {
  sheetName: string;
  periods: DetectedPeriod[];
  /** field → per-period values, indexed by the period's position in `periods`. */
  values: Array<MappedValue<F>>;
}

export interface ParseResult {
  fileName: string;
  sheetsSeen: Array<{ name: string; kind: SheetKind | null; rows: number }>;
  balance?: StatementExtract<BalanceField>;
  income?: StatementExtract<IncomeField>;
  cashFlow?: StatementExtract<CashFlowField>;
  unmapped: UnmappedRow[];
  warnings: string[];
}

const CONFIDENCE_BY_PRIORITY = (priority: number): number => Math.min(0.55 + priority * 0.03, 0.95);

/* ------------------------------------------------------------------ */
/* Cell helpers                                                        */
/* ------------------------------------------------------------------ */

export function toNumber(cell: Cell): number | null {
  if (cell === null || cell === undefined || cell === '') return null;
  if (typeof cell === 'number') return Number.isFinite(cell) ? cell : null;

  const cleaned = String(cell)
    .replace(/ /g, ' ')
    .replace(/[₼]/g, '')
    .replace(/AZN/gi, '')
    .trim()
    // Azerbaijani sheets use "." or space as the thousands separator and "," as
    // the decimal mark; normalise both to a JS-parsable form.
    .replace(/\s/g, '')
    .replace(/\.(?=\d{3}\b)/g, '')
    .replace(/,/g, '.');

  if (!cleaned || !/^-?\(?\d*\.?\d+\)?$/.test(cleaned)) return null;
  const negative = cleaned.startsWith('(') && cleaned.endsWith(')');
  const n = Number(negative ? cleaned.slice(1, -1) : cleaned);
  if (!Number.isFinite(n)) return null;
  return negative ? -n : n;
}

function cellText(cell: Cell): string {
  if (cell === null || cell === undefined) return '';
  return String(cell).trim();
}

/* ------------------------------------------------------------------ */
/* Period detection                                                    */
/* ------------------------------------------------------------------ */

const YEAR_RE = /(20\d{2})/;

/**
 * Finds the header row that names the reporting periods and returns one entry
 * per numeric column. Scans the first 15 rows because templates carry titles
 * and metadata above the header.
 */
export function detectPeriods(rows: Grid, maxHeaderRow = 15): { headerRowIndex: number; periods: DetectedPeriod[] } {
  let best: { headerRowIndex: number; periods: DetectedPeriod[] } = { headerRowIndex: -1, periods: [] };

  for (let r = 0; r < Math.min(rows.length, maxHeaderRow); r += 1) {
    const row = rows[r] ?? [];
    const periods: DetectedPeriod[] = [];

    for (let c = 1; c < row.length; c += 1) {
      const text = cellText(row[c]);
      if (!text) continue;

      const n = normaliseLabel(text);
      const yearMatch = text.match(YEAR_RE);
      const looksLikePeriod =
        !!yearMatch ||
        n.includes('cari') ||
        n.includes('proqnoz') ||
        n.includes('evvelki') ||
        n.includes('ytd') ||
        n.includes('dovr');

      if (!looksLikePeriod) continue;

      const isForecast = n.includes('proqnoz') || n.includes('forecast');
      const isYtd = n.includes('ytd') || /\b(\d{1,2})\s*ay\b/.test(n);
      const monthsMatch = n.match(/(\d{1,2})\s*ay/);

      periods.push({
        columnIndex: c,
        label: text,
        year: yearMatch ? Number(yearMatch[1]) : null,
        isForecast,
        monthsCovered: monthsMatch ? Number(monthsMatch[1]) : isYtd ? 6 : 12,
      });
    }

    if (periods.length > best.periods.length) best = { headerRowIndex: r, periods };
  }

  return best;
}

/* ------------------------------------------------------------------ */
/* Statement extraction                                                */
/* ------------------------------------------------------------------ */

function extractStatement<F extends string>(
  sheet: SheetInput,
  rules: Parameters<typeof matchField<F>>[1],
  unmapped: UnmappedRow[],
): StatementExtract<F> {
  const { headerRowIndex, periods } = detectPeriods(sheet.rows);
  const values: Array<MappedValue<F>> = [];

  // Take the first non-empty cell of the row as its label; templates put the
  // label in column A or B depending on indentation level.
  const labelOf = (row: Cell[]): { text: string; index: number } => {
    for (let c = 0; c < Math.min(row.length, 4); c += 1) {
      const t = cellText(row[c]);
      if (t && toNumber(row[c]) === null) return { text: t, index: c };
    }
    return { text: '', index: 0 };
  };

  const startRow = headerRowIndex >= 0 ? headerRowIndex + 1 : 0;

  for (let r = startRow; r < sheet.rows.length; r += 1) {
    const row = sheet.rows[r] ?? [];
    const { text: label } = labelOf(row);
    if (!label) continue;

    const numericCells = periods
      .map((p) => ({ period: p, value: toNumber(row[p.columnIndex]) }))
      .filter((x): x is { period: DetectedPeriod; value: number } => x.value !== null);

    if (numericCells.length === 0) continue;

    const match = matchField<F>(label, rules);
    if (!match) {
      unmapped.push({
        sheet: sheet.name,
        rowIndex: r,
        label,
        values: numericCells.map((x) => x.value),
        reason: 'NO_LABEL_MATCH',
      });
      continue;
    }

    for (const { period, value } of numericCells) {
      values.push({
        field: match.field,
        value,
        confidence: CONFIDENCE_BY_PRIORITY(match.priority),
        sourceSheet: sheet.name,
        sourceRowLabel: label,
        sourceRowIndex: r,
        sourceColumnIndex: period.columnIndex,
        matchedPattern: match.matchedPattern,
      });
    }
  }

  return { sheetName: sheet.name, periods, values };
}

/**
 * When several rows map to the same field in the same period the parser sums
 * them, which is what the source templates expect: `Ehtiyatlar` is the total of
 * raw materials, work in progress and finished goods on separate rows.
 */
export function collapseByField<F extends string>(
  extract: StatementExtract<F> | undefined,
  periodColumnIndex: number,
): Partial<Record<F, { value: number; confidence: number; sources: string[] }>> {
  const out: Partial<Record<F, { value: number; confidence: number; sources: string[] }>> = {};
  if (!extract) return out;

  for (const v of extract.values) {
    if (v.sourceColumnIndex !== periodColumnIndex) continue;
    const existing = out[v.field];
    if (existing) {
      existing.value += v.value;
      existing.confidence = Math.min(existing.confidence, v.confidence);
      existing.sources.push(v.sourceRowLabel);
    } else {
      out[v.field] = { value: v.value, confidence: v.confidence, sources: [v.sourceRowLabel] };
    }
  }

  return out;
}

/* ------------------------------------------------------------------ */
/* Entry point                                                         */
/* ------------------------------------------------------------------ */

export function parseWorkbook(fileName: string, sheets: SheetInput[]): ParseResult {
  const unmapped: UnmappedRow[] = [];
  const warnings: string[] = [];
  const result: ParseResult = {
    fileName,
    sheetsSeen: sheets.map((s) => ({ name: s.name, kind: detectSheetKind(s.name), rows: s.rows.length })),
    unmapped,
    warnings,
  };

  for (const sheet of sheets) {
    const kind = detectSheetKind(sheet.name);
    if (kind === 'balance' && !result.balance) {
      result.balance = extractStatement<BalanceField>(sheet, BALANCE_LABELS, unmapped);
    } else if (kind === 'income' && !result.income) {
      result.income = extractStatement<IncomeField>(sheet, INCOME_LABELS, unmapped);
    } else if (kind === 'cashFlowCurrent' && !result.cashFlow) {
      result.cashFlow = extractStatement<CashFlowField>(sheet, CASH_FLOW_LABELS, unmapped);
    }
  }

  if (!result.balance) warnings.push('Balans vərəqi tapılmadı — vərəq adında "Balans" sözü axtarılır.');
  if (!result.income) warnings.push('MZH vərəqi tapılmadı — vərəq adında "MZH" və ya "Mənfəət və Zərər" axtarılır.');
  if (!result.cashFlow) warnings.push('Pul axını vərəqi tapılmadı — vərəq adında "Pul axını" axtarılır.');

  const periodCount = result.balance?.periods.length ?? 0;
  if (periodCount === 0) {
    warnings.push('Dövr sütunları müəyyən edilmədi — başlıq sətrində il (məs. 2025) göstərilməlidir.');
  }

  return result;
}

/* ------------------------------------------------------------------ */
/* Evidence inference                                                  */
/* ------------------------------------------------------------------ */

/**
 * A parsed figure is only as trustworthy as the confidence of its mapping. The
 * analyst can raise it after verifying against a document, but the parser
 * never claims VERIFIED on its own.
 */
export function evidenceForConfidence(confidence: number): EvidenceStatus {
  if (confidence >= 0.85) return 'PARTIALLY_VERIFIED';
  if (confidence >= 0.7) return 'PARTIALLY_VERIFIED';
  return 'ANALYST_ESTIMATE';
}

export const PARSED_SOURCE_TYPE: SourceType = 'CUSTOMER_DOCUMENT';
