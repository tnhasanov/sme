import { describe, expect, it } from 'vitest';
import {
  BALANCE_LABELS,
  CASH_FLOW_LABELS,
  INCOME_LABELS,
  detectSheetKind,
  matchField,
  normaliseLabel,
} from '@/domain/intake/labels';
import {
  collapseByField,
  detectPeriods,
  evidenceForConfidence,
  parseWorkbook,
  toNumber,
  type Grid,
  type SheetInput,
} from '@/domain/intake/workbook-parser';
import { buildApplicationFromIntake } from '@/domain/intake/build-application';
import { assessApplication } from '@/services/assessment';
import { reviewProgress } from '@/domain/review/types';
import type { Finding } from '@/types/application';
import { SAMPLE_SHEETS } from '@/lib/sample-workbook';
import { DEFAULT_CASE_FORM } from '@/domain/intake/case-defaults';

/* ------------------------------------------------------------------ */
/* Label normalisation & matching                                      */
/* ------------------------------------------------------------------ */

describe('normaliseLabel', () => {
  it('folds Azerbaijani letters so accented and plain spellings compare equal', () => {
    expect(normaliseLabel('Bölüşdürülməmiş mənfəət')).toBe('bolusdurulmemis menfeet');
    expect(normaliseLabel('MAL-MATERİAL EHTİYATLARI')).toBe('mal material ehtiyatlari');
    expect(normaliseLabel('  Satış  ')).toBe('satis');
  });

  it('collapses punctuation and digits noise into single spaces', () => {
    expect(normaliseLabel('1.2. Debitor borclar (net)')).toBe('1 2 debitor borclar net');
  });
});

describe('matchField', () => {
  it('maps balance rows to their domain fields', () => {
    expect(matchField('Likvid vəsaitlər', BALANCE_LABELS)?.field).toBe('cash');
    expect(matchField('Debitor borclar', BALANCE_LABELS)?.field).toBe('receivables');
    expect(matchField('Mal-material ehtiyatları', BALANCE_LABELS)?.field).toBe('inventory');
    expect(matchField('Qısamüddətli bank kreditləri', BALANCE_LABELS)?.field).toBe('shortTermBankDebt');
    expect(matchField('Uzunmüddətli bank kreditləri', BALANCE_LABELS)?.field).toBe('longTermBankDebt');
  });

  it('honours exclusions so a memo row does not steal a field', () => {
    // "Ehtiyatların dövretmə müddəti" is a ratio, not the inventory balance.
    expect(matchField('Ehtiyatların dövretmə müddəti', BALANCE_LABELS)).toBeNull();
    // "Satışın maya dəyəri" must not be read as sales.
    expect(matchField('Satışın maya dəyəri', INCOME_LABELS)?.field).toBe('cogs');
  });

  it('does not fold the tax line into turnover', () => {
    // "Gəlir vergisi" contains the generic `gelir` fragment that also names
    // sales; specificity has to win or turnover is overstated by the tax line.
    expect(matchField('Gəlir vergisi', INCOME_LABELS)?.field).toBe('tax');
    expect(matchField('Digər gəlirlər', INCOME_LABELS)?.field).toBe('otherIncome');
    expect(matchField('Satış', INCOME_LABELS)?.field).toBe('sales');
  });

  it('prefers the more specific rule when several patterns match', () => {
    // Both `payroll` and `operatingExpenses` know "əmək haqqı"; the cash-flow
    // rule set resolves it to the dedicated payroll line.
    expect(matchField('Əmək haqqı ödənişləri', CASH_FLOW_LABELS)?.field).toBe('payroll');
  });

  it('rejects labels too short to be meaningful', () => {
    expect(matchField('AB', BALANCE_LABELS)).toBeNull();
    expect(matchField('', INCOME_LABELS)).toBeNull();
  });
});

describe('detectSheetKind', () => {
  it('recognises the standard sheet names', () => {
    expect(detectSheetKind('Balans')).toBe('balance');
    expect(detectSheetKind('MZH')).toBe('income');
    expect(detectSheetKind('Mənfəət və Zərər')).toBe('income');
    expect(detectSheetKind('Pul axını cari')).toBe('cashFlowCurrent');
  });

  it('tests the forecast pattern before the generic cash-flow one', () => {
    // Otherwise "Pul axını proqnoz" matches "pul axini" first and the two
    // cash-flow sheets collide on the same slot.
    expect(detectSheetKind('Pul axını proqnoz')).toBe('cashFlowForecast');
  });

  it('returns null for sheets it does not know', () => {
    expect(detectSheetKind('Sheet1')).toBeNull();
  });
});

/* ------------------------------------------------------------------ */
/* Cell parsing                                                        */
/* ------------------------------------------------------------------ */

describe('toNumber', () => {
  it('passes through real numbers', () => {
    expect(toNumber(1234.5)).toBe(1234.5);
    expect(toNumber(0)).toBe(0);
  });

  it('handles Azerbaijani thousands and decimal separators', () => {
    expect(toNumber('1.234')).toBe(1234);
    expect(toNumber('12 500')).toBe(12500);
    expect(toNumber('1234,56')).toBe(1234.56);
  });

  it('strips currency marks', () => {
    expect(toNumber('45 000 ₼')).toBe(45000);
    expect(toNumber('45000 AZN')).toBe(45000);
  });

  it('reads accounting parentheses as negatives', () => {
    expect(toNumber('(1200)')).toBe(-1200);
  });

  it('returns null for anything that is not a number', () => {
    expect(toNumber(null)).toBeNull();
    expect(toNumber('')).toBeNull();
    expect(toNumber('Cəmi aktivlər')).toBeNull();
    expect(toNumber('n/a')).toBeNull();
    expect(toNumber(Number.NaN)).toBeNull();
  });
});

/* ------------------------------------------------------------------ */
/* Period detection                                                    */
/* ------------------------------------------------------------------ */

describe('detectPeriods', () => {
  it('finds the header row below title rows and returns one entry per period column', () => {
    const rows: Grid = [
      ['Şirkət maliyyə hesabatı', null, null, null],
      ['Bütün məbləğlər AZN ilə', null, null, null],
      ['Maddə', '2023', '2024', '2025'],
      ['Likvid vəsaitlər', 1, 2, 3],
    ];
    const { headerRowIndex, periods } = detectPeriods(rows);
    expect(headerRowIndex).toBe(2);
    expect(periods.map((p) => p.year)).toEqual([2023, 2024, 2025]);
    expect(periods.map((p) => p.columnIndex)).toEqual([1, 2, 3]);
    expect(periods.every((p) => p.monthsCovered === 12)).toBe(true);
  });

  it('reads part-year and forecast columns', () => {
    const rows: Grid = [['Maddə', '2024', '2025 6 ay', 'Proqnoz 2026']];
    const { periods } = detectPeriods(rows);
    expect(periods[1].monthsCovered).toBe(6);
    expect(periods[1].isForecast).toBe(false);
    expect(periods[2].isForecast).toBe(true);
  });

  it('returns nothing when no header row names a period', () => {
    expect(detectPeriods([['Maddə', 'a', 'b']]).periods).toHaveLength(0);
  });
});

/* ------------------------------------------------------------------ */
/* Workbook parsing                                                    */
/* ------------------------------------------------------------------ */

const balanceSheetInput: SheetInput = {
  name: 'Balans',
  rows: [
    ['Maddə', '2024', '2025'],
    ['Likvid vəsaitlər', 50_000, 40_000],
    ['Debitor borclar', 260_000, 370_000],
    ['Xammal', 100_000, 120_000],
    ['Hazır məhsul', 290_000, 350_000],
    ['Əsas vəsaitlər', 258_000, 296_000],
    ['Qısamüddətli bank kreditləri', 165_000, 245_000],
    ['Uzunmüddətli bank kreditləri', 118_000, 96_000],
    ['Mal təchizatçılarına borc', 205_000, 236_000],
    ['Nizamnamə kapitalı', 50_000, 50_000],
    ['Bölüşdürülməmiş mənfəət', 420_000, 549_000],
    ['Kredit portfelinin strukturu', 1, 2],
  ],
};

const incomeSheetInput: SheetInput = {
  name: 'MZH',
  rows: [
    ['Maddə', '2024', '2025'],
    ['Satış', 2_460_000, 3_247_000],
    ['Satışın maya dəyəri', 1_955_000, 2_612_000],
    ['Daimi xərclər', 302_000, 402_000],
    ['Amortizasiya', 36_000, 41_000],
    ['Faiz xərcləri', 46_000, 62_000],
    ['Gəlir vergisi', 22_000, 24_000],
  ],
};

const cashSheetInput: SheetInput = {
  name: 'Pul axını cari',
  rows: [
    ['Maddə', '2024', '2025'],
    ['Dövrün əvvəlinə nağd qalıq', 48_000, 52_000],
    ['Satışdan daxilolmalar', 2_402_000, 3_112_000],
    ['Təchizatçılara ödənişlər', 1_930_000, 2_575_000],
    ['Əmək haqqı', 174_000, 232_000],
    ['İcarə', 52_000, 66_000],
    ['Vergi ödənişləri', 22_000, 24_000],
    ['İnvestisiya', 29_000, 79_000],
    ['Sahibkar çıxarışı', 42_000, 48_000],
    ['Alınmış kreditlər', 130_000, 180_000],
    ['Ödənilmiş əsas borc', 117_000, 113_000],
    ['Ödənilmiş faizlər', 46_000, 62_000],
  ],
};

describe('parseWorkbook', () => {
  const result = parseWorkbook('test.xlsx', [balanceSheetInput, incomeSheetInput, cashSheetInput]);

  it('recognises each sheet and extracts all three statements', () => {
    expect(result.sheetsSeen.map((s) => s.kind)).toEqual(['balance', 'income', 'cashFlowCurrent']);
    expect(result.balance).toBeDefined();
    expect(result.income).toBeDefined();
    expect(result.cashFlow).toBeDefined();
    expect(result.warnings).toHaveLength(0);
  });

  it('reports rows it could not place rather than dropping them', () => {
    const labels = result.unmapped.map((u) => u.label);
    expect(labels).toContain('Kredit portfelinin strukturu');
  });

  it('never mixes values across period columns', () => {
    const y2025 = collapseByField(result.income, 2);
    expect(y2025.sales?.value).toBe(3_247_000);
    const y2024 = collapseByField(result.income, 1);
    expect(y2024.sales?.value).toBe(2_460_000);
  });

  it('sums several rows that map to the same field', () => {
    // Xammal + Hazır məhsul are both inventory lines.
    expect(collapseByField(result.balance, 2).inventory?.value).toBe(470_000);
    expect(collapseByField(result.balance, 2).inventory?.sources).toHaveLength(2);
  });

  it('warns instead of guessing when a statement is missing', () => {
    const partial = parseWorkbook('partial.xlsx', [balanceSheetInput]);
    expect(partial.income).toBeUndefined();
    expect(partial.warnings.some((w) => w.includes('MZH'))).toBe(true);
  });
});

describe('evidenceForConfidence', () => {
  it('never claims a parsed figure is verified', () => {
    expect(evidenceForConfidence(1)).not.toBe('VERIFIED');
    expect(evidenceForConfidence(0.9)).toBe('PARTIALLY_VERIFIED');
    expect(evidenceForConfidence(0.4)).toBe('ANALYST_ESTIMATE');
  });
});

/* ------------------------------------------------------------------ */
/* End-to-end: uploaded file → assessment                              */
/* ------------------------------------------------------------------ */

describe('buildApplicationFromIntake', () => {
  const parse = parseWorkbook('test.xlsx', [balanceSheetInput, incomeSheetInput, cashSheetInput]);

  const built = buildApplicationFromIntake({
    parse,
    selectedPeriodColumns: [1, 2],
    primaryPeriodColumn: 2,
    customer: {
      legalName: 'Test Ticarət MMC',
      customerType: 'LEGAL_ENTITY',
      legalForm: 'MMC',
      taxId: '0000000000',
      sector: 'Topdan ticarət',
      subSector: 'Ərzaq',
      region: 'Bakı',
      employees: 20,
      officialActivityYears: 5,
      unofficialActivityYears: 7,
      businessModel: 'Topdan ticarət',
      seasonality: 'Zəif',
    },
    loan: {
      amount: 300_000,
      currency: 'AZN',
      tenorMonths: 36,
      gracePeriodMonths: 0,
      annualRatePct: 18,
      commissionPct: 0.5,
      repaymentFrequency: 'MONTHLY',
      amortisation: 'ANNUITY',
      product: 'WORKING_CAPITAL_LOAN',
      purposeSummary: 'Dövriyyə vəsaiti',
      primaryRepaymentSource: 'Əməliyyat pul axını',
      secondaryRepaymentSource: 'Girov',
      branch: 'Mərkəz',
      rm: 'Analitik',
    },
    bureau: {
      acbMicroScore: 640,
      individualBureauRating: null,
      totalDebt: 341_000,
      monthlyDebtService: 12_400,
      activeFacilityCount: 3,
      maxDpd: 12,
      currentDpd: 0,
      dpd30PlusEvents: 0,
      externalGroupExposure: 341_000,
      atbExposure: 0,
      debtBeingRefinanced: 0,
      extractsObtainedForAllParties: true,
    },
    collateral: {
      marketValue: 420_000,
      forcedSaleValue: 336_000,
      type: 'REAL_ESTATE_COMMERCIAL',
      ownerIsShareholder: true,
      registered: true,
      insured: false,
    },
    now: '2026-03-01T00:00:00.000Z',
  });

  it('creates one period per selected column and marks the primary one', () => {
    expect(built.application.periods).toHaveLength(2);
    expect(built.application.periods.filter((p) => p.isPrimary)).toHaveLength(1);
    expect(built.application.periods.find((p) => p.isPrimary)?.year).toBe(2025);
  });

  it('carries the parsed figures onto the statements', () => {
    const primaryId = built.application.periods.find((p) => p.isPrimary)!.id;
    const income = built.application.incomeStatements.find((i) => i.periodId === primaryId)!;
    expect(income.sales.raw).toBe(3_247_000);
    const balance = built.application.balanceSheets.find((b) => b.periodId === primaryId)!;
    expect(balance.inventory.raw).toBe(470_000);
  });

  it('lets an analyst override win over the parsed value and marks it as such', () => {
    const withOverride = buildApplicationFromIntake({
      parse,
      selectedPeriodColumns: [2],
      primaryPeriodColumn: 2,
      customer: {
        legalName: 'Test',
        customerType: 'LEGAL_ENTITY',
        legalForm: 'MMC',
        taxId: '0',
        sector: 'Ticarət',
        subSector: '—',
        region: 'Bakı',
        employees: 5,
        officialActivityYears: 3,
        unofficialActivityYears: 3,
        businessModel: '—',
        seasonality: '—',
      },
      loan: built.application.requestedStructure as never,
      bureau: {
        acbMicroScore: 600,
        individualBureauRating: null,
        totalDebt: 0,
        monthlyDebtService: 0,
        activeFacilityCount: 0,
        maxDpd: 0,
        currentDpd: 0,
        dpd30PlusEvents: 0,
        externalGroupExposure: 0,
        atbExposure: 0,
        debtBeingRefinanced: 0,
        extractsObtainedForAllParties: true,
      },
      collateral: null,
      overrides: { income: { 2: { sales: 3_000_000 } } },
    });

    const income = withOverride.application.incomeStatements[0];
    expect(income.sales.raw).toBe(3_000_000);
    expect(income.sales.evidence).toBe('ANALYST_ESTIMATE');
  });

  it('flags incomplete bureau coverage instead of hiding it', () => {
    const risky = buildApplicationFromIntake({
      parse,
      selectedPeriodColumns: [2],
      primaryPeriodColumn: 2,
      customer: built.customer as never,
      loan: built.application.requestedStructure as never,
      bureau: {
        acbMicroScore: 600,
        individualBureauRating: null,
        totalDebt: 0,
        monthlyDebtService: 0,
        activeFacilityCount: 0,
        maxDpd: 0,
        currentDpd: 0,
        dpd30PlusEvents: 0,
        externalGroupExposure: 0,
        atbExposure: 0,
        debtBeingRefinanced: 0,
        extractsObtainedForAllParties: false,
      },
      collateral: null,
    });
    expect(risky.missingFields.join(' ')).toMatch(/AKB/);
  });

  it('produces an application the assessment engine can run end to end', () => {
    const a = assessApplication(built.application, built.customer);
    expect(a.income?.sales).toBe(3_247_000);
    expect(a.primaryPeriod?.year).toBe(2025);
    expect(a.previousPeriod?.year).toBe(2024);
    expect(a.ratios.currentRatio?.value).toBeGreaterThan(0);
    expect(a.crossChecks.length).toBeGreaterThan(0);
    expect(a.rating.finalGrade).toBeTruthy();
    // The uploaded case must reach the same artefacts a seeded case does.
    expect(Array.isArray(a.findings)).toBe(true);
    expect(a.routing.decisionAuthority).toBeTruthy();
  });
});

/* ------------------------------------------------------------------ */
/* Human-in-the-loop gate                                              */
/* ------------------------------------------------------------------ */

describe('reviewProgress', () => {
  const finding = (id: string, severity: Finding['severity']): Finding => ({
    id,
    severity,
    category: 'FINANCIAL_RISK',
    title: id,
    description: id,
    source: 'test',
    resolutionStatus: 'OPEN',
    autoGenerated: true,
  });

  const base = {
    applicationId: 'app-1',
    findings: {},
    sectionNotes: {},
    overallNote: '',
    underwriterName: '',
    updatedAt: '2026-03-01T00:00:00.000Z',
  };

  it('blocks sign-off while a critical finding is undispositioned', () => {
    const p = reviewProgress([finding('f1', 'CRITICAL')], base);
    expect(p.canSignOff).toBe(false);
    expect(p.blockingReasonAz).toBeTruthy();
  });

  it('still blocks sign-off when every finding is dispositioned but nobody is named', () => {
    const p = reviewProgress([finding('f1', 'HIGH')], {
      ...base,
      findings: { f1: { findingId: 'f1', disposition: 'ACKNOWLEDGED', note: '', mitigant: '', updatedAt: '' } },
    });
    expect(p.canSignOff).toBe(false);
  });

  it('allows sign-off once the priority findings are judged and the reviewer is named', () => {
    const p = reviewProgress([finding('f1', 'HIGH'), finding('f2', 'LOW')], {
      ...base,
      underwriterName: 'Anderrayter',
      findings: { f1: { findingId: 'f1', disposition: 'MITIGATED', note: '', mitigant: '', updatedAt: '' } },
    });
    expect(p.canSignOff).toBe(true);
  });
});

/* ------------------------------------------------------------------ */
/* The shipped template                                                */
/* ------------------------------------------------------------------ */

describe('sample workbook template', () => {
  const parse = parseWorkbook(
    'KOB-maliyye-sablonu.xlsx',
    SAMPLE_SHEETS.map((s) => ({ name: s.name, rows: s.rows as never })),
  );

  it('parses with no warnings and no unmapped rows', () => {
    // The template is the one file the bank hands to branches; if the label
    // vocabulary drifts away from it, that has to fail here rather than in a
    // branch office.
    expect(parse.warnings).toEqual([]);
    expect(parse.unmapped).toEqual([]);
    expect(parse.balance?.periods.map((p) => p.year)).toEqual([2023, 2024, 2025]);
  });

  it('is fully articulated — every reconciliation the platform runs passes', () => {
    const built = buildApplicationFromIntake({
      parse,
      selectedPeriodColumns: parse.balance!.periods.map((p) => p.columnIndex),
      primaryPeriodColumn: parse.balance!.periods.at(-1)!.columnIndex,
      customer: { ...DEFAULT_CASE_FORM.customer, legalName: 'Nümunə Ticarət MMC' },
      loan: DEFAULT_CASE_FORM.loan,
      bureau: DEFAULT_CASE_FORM.bureau,
      collateral: DEFAULT_CASE_FORM.collateral,
      now: '2026-03-01T00:00:00.000Z',
    });
    const a = assessApplication(built.application, built.customer);

    const failed = a.crossChecks.filter((c) => !c.passed).map((c) => c.labelAz);
    expect(failed).toEqual([]);
    expect(a.activeStopFactors).toHaveLength(0);
  });

  it('produces a case that exercises structuring rather than a clean approval', () => {
    const built = buildApplicationFromIntake({
      parse,
      selectedPeriodColumns: parse.balance!.periods.map((p) => p.columnIndex),
      primaryPeriodColumn: parse.balance!.periods.at(-1)!.columnIndex,
      customer: { ...DEFAULT_CASE_FORM.customer, legalName: 'Nümunə Ticarət MMC' },
      loan: DEFAULT_CASE_FORM.loan,
      bureau: DEFAULT_CASE_FORM.bureau,
      collateral: DEFAULT_CASE_FORM.collateral,
      now: '2026-03-01T00:00:00.000Z',
    });
    const a = assessApplication(built.application, built.customer);

    // Sales grow far faster than collections, so the requested amount is not
    // fully supported and the opinion has to recommend a smaller one.
    expect(a.repayment!.dscrAfter!).toBeLessThan(1.5);
    expect(a.maxLoan!.maxSustainableLoan).toBeGreaterThan(0);
    expect(a.maxLoan!.maxSustainableLoan).toBeLessThan(DEFAULT_CASE_FORM.loan.amount);
    expect(a.findings.some((f) => f.severity === 'CRITICAL' || f.severity === 'HIGH')).toBe(true);
  });
});
