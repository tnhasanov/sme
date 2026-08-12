import type { ISODate, Severity } from '@/types/core';
import { safeDiv } from '@/types/core';
import type { CreditBureauReport, CreditFacility, GroupMember } from '@/types/application';

/**
 * Credit-bureau analytics (§15) and the refinancing / loan-cycling engine
 * (§18).
 *
 * The refinancing logic follows the `AKBÇ təhlili` sheet: for each closed
 * facility, split the original principal into the part genuinely amortised
 * through monthly instalments and the part extinguished by a new loan. The
 * bank's benchmark is that more than 50% of past principal should have been
 * repaid by instalments.
 */

export interface BureauSummary {
  totalDebt: number;
  atbDebt: number;
  externalDebt: number;
  monthlyDebtService: number;
  activeFacilityCount: number;
  closedFacilityCount: number;
  currentMaxDpd: number;
  historicMaxDpd: number;
  dpd30PlusEvents: number;
  guaranteesGiven: number;
  inquiriesLast3Months: number;
  inquiriesLast12Months: number;
  unresolvedInquiries: number;
  acbMicroScore: number | null;
  restructuredCount: number;
  writtenOffCount: number;
}

export function summariseBureau(reports: CreditBureauReport[]): BureauSummary {
  const facilities = reports.flatMap((r) => r.facilities);
  const active = facilities.filter((f) => f.status === 'ACTIVE' || f.status === 'RESTRUCTURED');
  const closed = facilities.filter((f) => f.status === 'CLOSED');
  const inquiries = reports.flatMap((r) => r.inquiries);
  const guarantees = reports.flatMap((r) => r.guarantees);

  const now = latestInquiryDate(reports);
  const monthsSince = (d: ISODate) => monthsBetween(d, now);

  const applicantScore = reports.find((r) => r.acbMicroScore !== null)?.acbMicroScore ?? null;

  return {
    totalDebt: active.reduce((s, f) => s + f.outstanding, 0),
    atbDebt: active.filter((f) => f.isAtb).reduce((s, f) => s + f.outstanding, 0),
    externalDebt: active.filter((f) => !f.isAtb).reduce((s, f) => s + f.outstanding, 0),
    monthlyDebtService: active.reduce((s, f) => s + f.monthlyPayment, 0),
    activeFacilityCount: active.length,
    closedFacilityCount: closed.length,
    currentMaxDpd: active.reduce((mx, f) => Math.max(mx, f.currentDpd), 0),
    historicMaxDpd: facilities.reduce((mx, f) => Math.max(mx, f.maxDpd), 0),
    dpd30PlusEvents: facilities.reduce((s, f) => s + f.dpd30PlusEvents, 0),
    guaranteesGiven: guarantees.reduce((s, g) => s + g.outstanding, 0),
    inquiriesLast3Months: inquiries.filter((i) => monthsSince(i.date) <= 3).length,
    inquiriesLast12Months: inquiries.filter((i) => monthsSince(i.date) <= 12).length,
    unresolvedInquiries: inquiries.filter((i) => monthsSince(i.date) <= 3 && !i.resultedInLoan).length,
    acbMicroScore: applicantScore,
    restructuredCount: facilities.filter((f) => f.status === 'RESTRUCTURED').length,
    writtenOffCount: facilities.filter((f) => f.status === 'WRITTEN_OFF').length,
  };
}

function latestInquiryDate(reports: CreditBureauReport[]): ISODate {
  return reports.map((r) => r.inquiryDate).sort().at(-1) ?? new Date().toISOString().slice(0, 10);
}

export function monthsBetween(from: ISODate, to: ISODate): number {
  const a = new Date(from);
  const b = new Date(to);
  return (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth());
}

export function daysBetween(from: ISODate, to: ISODate): number {
  return Math.round((new Date(to).getTime() - new Date(from).getTime()) / 86_400_000);
}

/* ------------------------------------------------------------------ */
/* Refinancing / loan-cycling engine (§18)                             */
/* ------------------------------------------------------------------ */

export interface FacilityLifecycle {
  facility: CreditFacility;
  /** Months the facility was serviced before closure (or up to today). */
  monthsServiced: number;
  contractualMonths: number;
  /** Principal that ordinary instalments would have amortised. */
  ordinaryPrincipalRepaid: number;
  /** Residual extinguished at closure beyond ordinary amortisation. */
  earlyRepayment: number;
  /** The facility that most plausibly refinanced this one. */
  refinancedByFacilityId?: string;
  refinancedAmount: number;
  refinancingPct: number | null;
  gapDays?: number;
  cashOut: number;
}

export interface RefinancingAnalysis {
  lifecycles: FacilityLifecycle[];
  totalOriginalPrincipal: number;
  totalRepaidByInstalments: number;
  /** AKBÇ təhlili E70 — the >50% benchmark. */
  instalmentRepaymentShare: number | null;
  totalRefinanced: number;
  refinancingShare: number | null;
  totalCashOut: number;
  repeatedRefinancingCount: number;
  shortestGapDays: number | null;
  debtTrend: Array<{ date: ISODate; totalDebt: number }>;
  flags: Array<{ key: string; severity: Severity; messageAz: string }>;
}

/** Window within which a new loan is treated as refinancing an old one. */
export const REFINANCE_WINDOW_DAYS = 45;
/** Share of the closing balance that a new loan must cover to count. */
export const REFINANCE_COVERAGE_MIN = 0.6;

export function analyseRefinancing(facilities: CreditFacility[]): RefinancingAnalysis {
  const sorted = [...facilities].sort((a, b) => a.issueDate.localeCompare(b.issueDate));
  const lifecycles: FacilityLifecycle[] = [];

  for (const f of sorted) {
    const contractualMonths = Math.max(monthsBetween(f.issueDate, f.maturityDate), 1);
    const endDate = f.closureDate ?? todayIso();
    const monthsServiced = Math.max(monthsBetween(f.issueDate, endDate), 0);

    // Ordinary amortisation actually delivered by the instalments paid.
    const scheduledPrincipalPerMonth = f.originalAmount / contractualMonths;
    const ordinaryPrincipalRepaid = Math.min(scheduledPrincipalPerMonth * monthsServiced, f.originalAmount);

    const extinguished = f.status === 'CLOSED' ? f.originalAmount : f.originalAmount - f.outstanding;
    const earlyRepayment = Math.max(extinguished - ordinaryPrincipalRepaid, 0);

    // Look for a facility issued around the closure date that could fund it.
    let refinancedBy: CreditFacility | undefined;
    let gapDays: number | undefined;
    if (f.status === 'CLOSED' && f.closureDate && earlyRepayment > 0) {
      const candidates = sorted.filter(
        (c) =>
          c.id !== f.id &&
          Math.abs(daysBetween(f.closureDate!, c.issueDate)) <= REFINANCE_WINDOW_DAYS &&
          c.originalAmount >= earlyRepayment * REFINANCE_COVERAGE_MIN,
      );
      refinancedBy = candidates.sort(
        (a, b) => Math.abs(daysBetween(f.closureDate!, a.issueDate)) - Math.abs(daysBetween(f.closureDate!, b.issueDate)),
      )[0];
      if (refinancedBy) gapDays = daysBetween(f.closureDate, refinancedBy.issueDate);
    }

    const refinancedAmount = refinancedBy ? earlyRepayment : 0;
    const cashOut = refinancedBy ? Math.max(refinancedBy.originalAmount - earlyRepayment, 0) : 0;

    lifecycles.push({
      facility: f,
      monthsServiced,
      contractualMonths,
      ordinaryPrincipalRepaid,
      earlyRepayment,
      refinancedByFacilityId: refinancedBy?.id,
      refinancedAmount,
      refinancingPct: safeDiv(refinancedAmount, f.originalAmount),
      gapDays,
      cashOut,
    });
  }

  const totalOriginalPrincipal = lifecycles.reduce((s, l) => s + l.facility.originalAmount, 0);
  const totalRepaidByInstalments = lifecycles.reduce((s, l) => s + l.ordinaryPrincipalRepaid, 0);
  const totalRefinanced = lifecycles.reduce((s, l) => s + l.refinancedAmount, 0);
  const totalCashOut = lifecycles.reduce((s, l) => s + l.cashOut, 0);
  const repeatedRefinancingCount = lifecycles.filter((l) => l.refinancedByFacilityId).length;
  const gaps = lifecycles.map((l) => l.gapDays).filter((g): g is number => g !== undefined);

  const instalmentRepaymentShare = safeDiv(totalRepaidByInstalments, totalOriginalPrincipal);
  const refinancingShare = safeDiv(totalRefinanced, totalOriginalPrincipal);

  const flags: RefinancingAnalysis['flags'] = [];
  if (instalmentRepaymentShare !== null && instalmentRepaymentShare <= 0.5) {
    flags.push({
      key: 'LOW_ORDINARY_AMORTISATION',
      severity: 'HIGH',
      messageAz: `Keçmiş kreditlərin yalnız ${(instalmentRepaymentShare * 100).toFixed(0)}%-i aylıq ödənişlərlə bağlanıb (norma >50%). Kreditdən-kreditə refinansman əlaməti.`,
    });
  }
  if (repeatedRefinancingCount >= 2) {
    flags.push({
      key: 'REPEATED_REFINANCING',
      severity: 'HIGH',
      messageAz: `${repeatedRefinancingCount} kredit bağlanma tarixinə yaxın verilən yeni kreditlə əvəzlənib — təkrarlanan refinansman modeli.`,
    });
  }
  if (refinancingShare !== null && refinancingShare > 0.5) {
    flags.push({
      key: 'HIGH_REFINANCING_SHARE',
      severity: 'HIGH',
      messageAz: `İlkin kredit məbləğlərinin ${(refinancingShare * 100).toFixed(0)}%-i refinansman yolu ilə bağlanıb.`,
    });
  }
  const shortestGap = gaps.length ? Math.min(...gaps.map(Math.abs)) : null;
  if (shortestGap !== null && shortestGap <= 7) {
    flags.push({
      key: 'SHORT_REFINANCE_GAP',
      severity: 'MEDIUM',
      messageAz: `Köhnə kreditin bağlanması ilə yeni kreditin verilməsi arasında cəmi ${shortestGap} gün fərq var.`,
    });
  }

  const debtTrend = buildDebtTrend(sorted);
  const first = debtTrend[0]?.totalDebt ?? 0;
  const last = debtTrend.at(-1)?.totalDebt ?? 0;
  // Growing debt is only evergreening when the growth was not accompanied by
  // genuine amortisation. A borrower who repays on schedule and borrows more
  // is expanding, not rolling a balance forward.
  const amortisingWell = instalmentRepaymentShare !== null && instalmentRepaymentShare > 0.5;
  if (last > first * 1.5 && first > 0 && !amortisingWell) {
    flags.push({
      key: 'DEBT_EVERGREENING',
      severity: 'HIGH',
      messageAz: `Ümumi borc yükü müşahidə dövründə ${((last / first - 1) * 100).toFixed(0)}% artıb — borcun daimi yenilənməsi (evergreening) əlaməti.`,
    });
  }

  return {
    lifecycles,
    totalOriginalPrincipal,
    totalRepaidByInstalments,
    instalmentRepaymentShare,
    totalRefinanced,
    refinancingShare,
    totalCashOut,
    repeatedRefinancingCount,
    shortestGapDays: shortestGap,
    debtTrend,
    flags,
  };
}

/** Outstanding debt at each event date, for the timeline chart. */
function buildDebtTrend(facilities: CreditFacility[]): Array<{ date: ISODate; totalDebt: number }> {
  const events = new Set<ISODate>();
  for (const f of facilities) {
    events.add(f.issueDate);
    if (f.closureDate) events.add(f.closureDate);
  }
  const dates = [...events].sort();
  return dates.map((date) => ({
    date,
    totalDebt: facilities
      .filter((f) => f.issueDate <= date && (!f.closureDate || f.closureDate > date))
      .reduce((s, f) => {
        const months = Math.max(monthsBetween(f.issueDate, f.maturityDate), 1);
        const elapsed = Math.min(Math.max(monthsBetween(f.issueDate, date), 0), months);
        return s + Math.max(f.originalAmount * (1 - elapsed / months), 0);
      }, 0),
  }));
}

function todayIso(): ISODate {
  return new Date().toISOString().slice(0, 10);
}

/* ------------------------------------------------------------------ */
/* Debt-burden increase (§4.8 of the methodology)                      */
/* ------------------------------------------------------------------ */

/**
 * Compares the post-transaction monthly payment with the highest monthly
 * payment the borrower has ever serviced in parallel — the `Aylıq ödəniş`
 * matrix in the workbook.
 */
export function debtBurdenIncrease(
  facilities: CreditFacility[],
  postTransactionMonthlyPayment: number,
  lookbackMonths = 12,
): { historicMaxParallelPayment: number; increase: number | null } {
  const today = todayIso();
  let maxParallel = 0;

  for (let back = 0; back < lookbackMonths; back += 1) {
    const d = new Date(today);
    d.setMonth(d.getMonth() - back);
    const month = d.toISOString().slice(0, 10);
    const parallel = facilities
      .filter((f) => f.issueDate <= month && (!f.closureDate || f.closureDate >= month))
      .reduce((s, f) => s + f.monthlyPayment, 0);
    maxParallel = Math.max(maxParallel, parallel);
  }

  return {
    historicMaxParallelPayment: maxParallel,
    increase: maxParallel > 0 ? postTransactionMonthlyPayment / maxParallel - 1 : null,
  };
}

/* ------------------------------------------------------------------ */
/* Group exposure (§14)                                               */
/* ------------------------------------------------------------------ */

export interface GroupExposureResult {
  members: GroupMember[];
  existingAtbExposure: number;
  existingExternalExposure: number;
  existingTotalExposure: number;
  requestedAmount: number;
  debtBeingRefinanced: number;
  postTransactionAtbExposure: number;
  postTransactionGroupExposure: number;
  guarantees: number;
}

export function computeGroupExposure(
  members: GroupMember[],
  requestedAmount: number,
  debtBeingRefinanced = 0,
): GroupExposureResult {
  const included = members.filter((m) => m.includeInGroup);
  const existingAtbExposure = included.reduce((s, m) => s + m.atbExposure, 0);
  const existingExternalExposure = included.reduce((s, m) => s + m.externalExposure, 0);

  return {
    members: included,
    existingAtbExposure,
    existingExternalExposure,
    existingTotalExposure: existingAtbExposure + existingExternalExposure,
    requestedAmount,
    debtBeingRefinanced,
    postTransactionAtbExposure: existingAtbExposure + requestedAmount - debtBeingRefinanced,
    postTransactionGroupExposure:
      existingAtbExposure + existingExternalExposure + requestedAmount - debtBeingRefinanced,
    guarantees: included.reduce((s, m) => s + m.guaranteesGiven, 0),
  };
}
