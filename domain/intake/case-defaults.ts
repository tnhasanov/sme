import type {
  IntakeBureauInput,
  IntakeCollateralInput,
  IntakeCustomerInput,
  IntakeLoanInput,
} from './build-application';

/**
 * The case facts a workbook cannot carry, plus the starting values the intake
 * wizard opens with.
 *
 * These live in the domain rather than in the form component because the test
 * suite runs the shipped template through them: the defaults are part of what
 * the platform promises, not a UI detail.
 */

export interface CaseFormValue {
  customer: IntakeCustomerInput;
  loan: IntakeLoanInput;
  bureau: IntakeBureauInput;
  collateral: IntakeCollateralInput | null;
}

export const SECTORS = [
  'Ticarət',
  'Topdan ticarət',
  'Pərakəndə ticarət',
  'İstehsal',
  'Tikinti',
  'Xidmət',
  'Nəqliyyat',
  'Kənd təsərrüfatı',
] as const;

export const DEFAULT_CASE_FORM: CaseFormValue = {
  customer: {
    legalName: '',
    customerType: 'LEGAL_ENTITY',
    legalForm: 'MMC',
    taxId: '',
    sector: 'Topdan ticarət',
    subSector: 'Ərzaq distribusiyası',
    region: 'Bakı',
    employees: 20,
    officialActivityYears: 5,
    unofficialActivityYears: 7,
    businessModel: 'Topdan ticarət fəaliyyəti; alış-satış marjası əsas gəlir mənbəyidir.',
    seasonality: 'Mövsümilik zəif ifadə olunub.',
  },
  loan: {
    amount: 180_000,
    currency: 'AZN',
    tenorMonths: 36,
    gracePeriodMonths: 0,
    annualRatePct: 18,
    commissionPct: 0.5,
    repaymentFrequency: 'MONTHLY',
    amortisation: 'ANNUITY',
    product: 'WORKING_CAPITAL_LOAN',
    purposeSummary: 'Dövriyyə vəsaitinin artırılması — mal ehtiyatının maliyyələşdirilməsi',
    primaryRepaymentSource: 'Əsas fəaliyyətdən pul axını',
    secondaryRepaymentSource: 'Girovun realizasiyası',
    branch: 'Mərkəzi filial',
    rm: 'KOB analitik',
  },
  bureau: {
    acbMicroScore: 640,
    individualBureauRating: null,
    totalDebt: 164_000,
    monthlyDebtService: 5_900,
    activeFacilityCount: 3,
    maxDpd: 12,
    currentDpd: 0,
    dpd30PlusEvents: 0,
    externalGroupExposure: 164_000,
    atbExposure: 0,
    debtBeingRefinanced: 0,
    extractsObtainedForAllParties: true,
  },
  collateral: {
    marketValue: 250_000,
    forcedSaleValue: 200_000,
    type: 'REAL_ESTATE_COMMERCIAL',
    ownerIsShareholder: true,
    registered: true,
    insured: false,
  },
};

