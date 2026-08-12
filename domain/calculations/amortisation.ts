import type { AmortisationType, LoanStructure } from '@/types/application';

/**
 * Loan amortisation and maximum-sustainable-loan solver (§36).
 *
 * The workbook computes the instalment as
 *   `IF(schedule="Sərbəst", amount*rate/12, PMT(rate/12, term-grace, -amount))`
 * — i.e. interest-only while a free schedule is chosen, otherwise a standard
 * annuity over the post-grace term. Both branches are reproduced here.
 */

export interface AmortisationRow {
  month: number;
  openingBalance: number;
  payment: number;
  interest: number;
  principal: number;
  closingBalance: number;
  isGrace: boolean;
}

export interface AmortisationSchedule {
  rows: AmortisationRow[];
  regularPayment: number;
  totalInterest: number;
  totalPaid: number;
  firstPayment: number;
  maxPayment: number;
}

export function monthlyRate(annualRatePct: number): number {
  return annualRatePct / 100 / 12;
}

/** Standard annuity payment (Excel PMT with sign flipped to positive). */
export function annuityPayment(principal: number, annualRatePct: number, months: number): number {
  if (months <= 0) return 0;
  const r = monthlyRate(annualRatePct);
  if (r === 0) return principal / months;
  return (principal * r) / (1 - Math.pow(1 + r, -months));
}

/** Loan amount that a given monthly payment can service (inverse annuity). */
export function loanFromPayment(payment: number, annualRatePct: number, months: number): number {
  if (months <= 0 || payment <= 0) return 0;
  const r = monthlyRate(annualRatePct);
  if (r === 0) return payment * months;
  return (payment * (1 - Math.pow(1 + r, -months))) / r;
}

export function buildSchedule(structure: LoanStructure): AmortisationSchedule {
  const { amount, tenorMonths, gracePeriodMonths, annualRatePct, amortisation } = structure;
  const r = monthlyRate(annualRatePct);
  const amortMonths = Math.max(tenorMonths - gracePeriodMonths, 1);
  const rows: AmortisationRow[] = [];

  let balance = amount;
  let regularPayment = 0;

  switch (amortisation) {
    case 'ANNUITY':
      regularPayment = annuityPayment(amount, annualRatePct, amortMonths);
      break;
    case 'EQUAL_PRINCIPAL':
      regularPayment = amount / amortMonths + amount * r;
      break;
    case 'BULLET':
    case 'SEASONAL':
      regularPayment = amount * r;
      break;
  }

  for (let m = 1; m <= tenorMonths; m += 1) {
    const isGrace = m <= gracePeriodMonths;
    const interest = balance * r;
    let principal = 0;
    let payment = interest;

    if (!isGrace) {
      switch (amortisation) {
        case 'ANNUITY': {
          payment = Math.min(regularPayment, balance + interest);
          principal = payment - interest;
          break;
        }
        case 'EQUAL_PRINCIPAL': {
          principal = Math.min(amount / amortMonths, balance);
          payment = principal + interest;
          break;
        }
        case 'BULLET': {
          if (m === tenorMonths) {
            principal = balance;
            payment = principal + interest;
          }
          break;
        }
        case 'SEASONAL': {
          // Principal falls due in the final month of each quarter.
          if (m % 3 === 0 || m === tenorMonths) {
            principal = Math.min(amount / Math.ceil(amortMonths / 3), balance);
            payment = principal + interest;
          }
          break;
        }
      }
    }

    const closing = Math.max(balance - principal, 0);
    rows.push({
      month: m,
      openingBalance: balance,
      payment,
      interest,
      principal,
      closingBalance: closing,
      isGrace,
    });
    balance = closing;
  }

  const totalInterest = rows.reduce((s, x) => s + x.interest, 0);
  const totalPaid = rows.reduce((s, x) => s + x.payment, 0);

  return {
    rows,
    regularPayment,
    totalInterest,
    totalPaid,
    firstPayment: rows[0]?.payment ?? 0,
    maxPayment: rows.reduce((mx, x) => Math.max(mx, x.payment), 0),
  };
}

/**
 * Representative monthly debt service used by the policy and routing
 * engines. Grace months are excluded because the binding constraint is the
 * steady-state instalment, not the interest-only period.
 */
export function steadyStateMonthlyPayment(structure: LoanStructure): number {
  const schedule = buildSchedule(structure);
  const servicing = schedule.rows.filter((r) => !r.isGrace);
  if (servicing.length === 0) return schedule.firstPayment;
  return servicing.reduce((s, r) => s + r.payment, 0) / servicing.length;
}

export interface MaxLoanInput {
  /** Cash available for debt service, per month. */
  cfadsMonthly: number;
  /** Debt service the borrower already carries and will keep. */
  existingMonthlyDebtService: number;
  minDscr: number;
  annualRatePct: number;
  tenorMonths: number;
  gracePeriodMonths: number;
  amortisation: AmortisationType;
}

export interface MaxLoanResult {
  maxSustainableMonthlyPayment: number;
  maxSustainableLoan: number;
  bindingConstraint: 'DSCR' | 'NO_CAPACITY';
  assumptions: MaxLoanInput;
}

/**
 * Maximum loan the cash flow supports at the required DSCR.
 *
 * Capacity available for the NEW facility is
 *   CFADS / minDSCR − existing debt service
 * because DSCR is defined on total debt service, not incremental.
 */
export function maxSustainableLoan(input: MaxLoanInput): MaxLoanResult {
  const capacityForTotalService = input.minDscr > 0 ? input.cfadsMonthly / input.minDscr : 0;
  const available = capacityForTotalService - input.existingMonthlyDebtService;

  if (available <= 0) {
    return {
      maxSustainableMonthlyPayment: 0,
      maxSustainableLoan: 0,
      bindingConstraint: 'NO_CAPACITY',
      assumptions: input,
    };
  }

  const amortMonths = Math.max(input.tenorMonths - input.gracePeriodMonths, 1);
  let loan: number;

  switch (input.amortisation) {
    case 'ANNUITY':
      loan = loanFromPayment(available, input.annualRatePct, amortMonths);
      break;
    case 'EQUAL_PRINCIPAL': {
      // payment_1 = P/n + P*r  ⇒  P = payment / (1/n + r)
      const r = monthlyRate(input.annualRatePct);
      loan = available / (1 / amortMonths + r);
      break;
    }
    case 'BULLET':
    case 'SEASONAL': {
      const r = monthlyRate(input.annualRatePct);
      loan = r > 0 ? available / r : available * amortMonths;
      break;
    }
  }

  return {
    maxSustainableMonthlyPayment: available,
    maxSustainableLoan: Math.max(loan, 0),
    bindingConstraint: 'DSCR',
    assumptions: input,
  };
}
