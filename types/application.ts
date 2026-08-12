import type {
  Currency,
  EvidenceStatus,
  ISODate,
  ISODateTime,
  Severity,
  SourceType,
  UUID,
} from './core';
import type {
  BalanceSheet,
  CashFlowStatement,
  FinancialAdjustment,
  FinancialPeriod,
  IncomeStatement,
  MonthlyTurnover,
} from './financials';

/* ------------------------------------------------------------------ */
/* Customer & business (§13)                                           */
/* ------------------------------------------------------------------ */

export const CUSTOMER_TYPES = ['LEGAL_ENTITY', 'INDIVIDUAL_ENTREPRENEUR', 'PHYSICAL_PERSON'] as const;
export type CustomerType = (typeof CUSTOMER_TYPES)[number];

export const LEGAL_FORMS = ['MMC', 'ASC', 'FST', 'QSC', 'KT', 'OTHER'] as const;
export type LegalForm = (typeof LEGAL_FORMS)[number];

export interface Shareholder {
  id: UUID;
  name: string;
  ownershipPct: number;
  isUbo: boolean;
  relationship?: string;
  otherBusinesses?: string[];
}

export interface ManagementMember {
  id: UUID;
  name: string;
  role: string;
  yearsInCompany: number;
  yearsInSector: number;
  isKeyPerson: boolean;
  note?: string;
}

export interface Customer {
  id: UUID;
  legalName: string;
  displayName: string;
  customerType: CustomerType;
  legalForm: LegalForm;
  taxId: string; // anonymised VÖEN in demo data
  registrationDate: ISODate;
  activityStartDate: ISODate;
  officialActivityYears: number;
  unofficialActivityYears: number;
  address: string;
  region: string;
  sector: string;
  subSector: string;
  businessModel: string;
  products: string[];
  geography: string;
  locations: number;
  employees: number;
  keyCustomers: Array<{ name: string; sharePct: number }>;
  keySuppliers: Array<{ name: string; sharePct: number; paymentTerms: string }>;
  seasonality: string;
  seasonalityIndex: number[]; // 12 monthly weights, sum ~ 12
  shareholders: Shareholder[];
  management: ManagementMember[];
  existingAtbCustomerSince?: ISODate;
}

/* ------------------------------------------------------------------ */
/* Loan request & structure (§12)                                      */
/* ------------------------------------------------------------------ */

export const PRODUCTS = [
  'WORKING_CAPITAL_LOAN',
  'WORKING_CAPITAL_LINE',
  'INVESTMENT_LOAN',
  'OVERDRAFT',
  'AGRO_LOAN',
  'VEHICLE_LOAN',
  'GUARANTEE',
  'LC',
] as const;
export type Product = (typeof PRODUCTS)[number];

export const REPAYMENT_FREQUENCIES = ['MONTHLY', 'QUARTERLY', 'SEASONAL', 'BULLET'] as const;
export type RepaymentFrequency = (typeof REPAYMENT_FREQUENCIES)[number];

export const AMORTISATION_TYPES = ['ANNUITY', 'EQUAL_PRINCIPAL', 'BULLET', 'SEASONAL'] as const;
export type AmortisationType = (typeof AMORTISATION_TYPES)[number];

export interface LoanStructure {
  amount: number;
  currency: Currency;
  tenorMonths: number;
  gracePeriodMonths: number;
  annualRatePct: number;
  commissionPct: number;
  repaymentFrequency: RepaymentFrequency;
  amortisation: AmortisationType;
  product: Product;
}

export const PURPOSE_CATEGORIES = [
  'INVENTORY',
  'WORKING_CAPITAL',
  'CAPEX',
  'VEHICLE',
  'PROPERTY',
  'REFINANCE_ATB',
  'REFINANCE_OTHER_BANK',
  'PERSONAL_NON_BUSINESS',
  'OTHER',
] as const;
export type PurposeCategory = (typeof PURPOSE_CATEGORIES)[number];

/** §37 — purpose is decomposed, never free text only. */
export interface PurposeLine {
  id: UUID;
  category: PurposeCategory;
  description: string;
  amount: number;
  evidence: EvidenceStatus;
  evidenceDocument?: string;
  businessBenefit: string;
  controlMechanism: string;
  /** §38 purpose effectiveness, populated for CAPEX-type lines. */
  effectiveness?: PurposeEffectiveness;
}

export interface PurposeEffectiveness {
  investmentAmount: number;
  ownContribution: number;
  financedAmount: number;
  additionalAnnualSales: number;
  additionalAnnualEbitda: number;
  annualCashBenefit: number;
  paybackYears: number | null;
}

/* ------------------------------------------------------------------ */
/* Group exposure (§14)                                                */
/* ------------------------------------------------------------------ */

export const RELATIONSHIP_TYPES = [
  'SELF',
  'PARENT',
  'SUBSIDIARY',
  'SISTER_COMPANY',
  'SHAREHOLDER',
  'SOLE_PROPRIETOR',
  'GUARANTOR',
  'RELATED_BORROWER',
  'ECONOMICALLY_RELATED',
] as const;
export type RelationshipType = (typeof RELATIONSHIP_TYPES)[number];

export interface GroupMember {
  id: UUID;
  name: string;
  relationship: RelationshipType;
  taxId?: string;
  atbExposure: number;
  externalExposure: number;
  requestedExposure: number;
  guaranteesGiven: number;
  includeInGroup: boolean;
  note?: string;
}

export interface GroupExposureSummary {
  members: GroupMember[];
  existingAtbExposure: number;
  existingExternalExposure: number;
  existingTotalExposure: number;
  requestedAmount: number;
  postTransactionAtbExposure: number;
  postTransactionGroupExposure: number;
  guarantees: number;
}

/* ------------------------------------------------------------------ */
/* Credit bureau / AKB (§15)                                           */
/* ------------------------------------------------------------------ */

export const FACILITY_STATUSES = ['ACTIVE', 'CLOSED', 'RESTRUCTURED', 'WRITTEN_OFF'] as const;
export type FacilityStatus = (typeof FACILITY_STATUSES)[number];

export interface CreditFacility {
  id: UUID;
  subjectName: string; // group member name
  lender: string;
  isAtb: boolean;
  product: string;
  originalAmount: number;
  outstanding: number;
  currency: Currency;
  issueDate: ISODate;
  maturityDate: ISODate;
  monthlyPayment: number;
  currentDpd: number;
  maxDpd: number;
  dpd30PlusEvents: number;
  status: FacilityStatus;
  closureDate?: ISODate;
  earlyClosure?: boolean;
  collateralised?: boolean;
}

export interface BureauGuarantee {
  id: UUID;
  guarantorName: string;
  beneficiaryName: string;
  lender: string;
  amount: number;
  outstanding: number;
  currency: Currency;
  currentDpd: number;
  status: FacilityStatus;
}

export interface BureauInquiryRecord {
  id: UUID;
  date: ISODate;
  institution: string;
  purpose: string;
  resultedInLoan: boolean;
}

export interface CreditBureauReport {
  id: UUID;
  applicationId: UUID;
  subjectName: string;
  inquiryDate: ISODate;
  reportReference: string;
  acbMicroScore: number | null;
  acbMicroRating?: string;
  individualBureauRating?: string;
  facilities: CreditFacility[];
  guarantees: BureauGuarantee[];
  inquiries: BureauInquiryRecord[];
}

/* ------------------------------------------------------------------ */
/* Collateral (§39)                                                    */
/* ------------------------------------------------------------------ */

export const COLLATERAL_TYPES = [
  'REAL_ESTATE_RESIDENTIAL',
  'REAL_ESTATE_COMMERCIAL',
  'REAL_ESTATE_LAND',
  'EQUIPMENT',
  'VEHICLE',
  'CASH_DEPOSIT',
  'RECEIVABLES',
  'INVENTORY',
  'PERSONAL_GUARANTEE',
  'CORPORATE_GUARANTEE',
] as const;
export type CollateralType = (typeof COLLATERAL_TYPES)[number];

export interface Collateral {
  id: UUID;
  type: CollateralType;
  description: string;
  ownerName: string;
  ownerRelationship: RelationshipType;
  marketValue: number;
  forcedSaleValue: number;
  /** Overrides the configured haircut when the analyst justifies a deviation. */
  haircutOverridePct?: number;
  lienRanking: number;
  existingLienAmount: number;
  valuationDate: ISODate;
  appraiser: string;
  insured: boolean;
  insuranceExpiry?: ISODate;
  registered: boolean;
  evidence: EvidenceStatus;
  currency: Currency;
}

/* ------------------------------------------------------------------ */
/* Documents (§71)                                                     */
/* ------------------------------------------------------------------ */

export const DOCUMENT_CATEGORIES = [
  'LEGAL',
  'TAX',
  'BANK_STATEMENT',
  'FINANCIAL_STATEMENT',
  'INVENTORY_LIST',
  'RECEIVABLE_LIST',
  'PAYABLE_LIST',
  'CONTRACT',
  'INVOICE',
  'COLLATERAL',
  'VALUATION',
  'INSURANCE',
  'BUREAU_REPORT',
  'BUSINESS_PHOTO',
  'REGISTRY_LEDGER',
  'OTHER',
] as const;
export type DocumentCategory = (typeof DOCUMENT_CATEGORIES)[number];

export interface CreditDocument {
  id: UUID;
  applicationId: UUID;
  category: DocumentCategory;
  name: string;
  documentDate?: ISODate;
  sourceType: SourceType;
  uploadedBy: string;
  uploadedAt: ISODateTime;
  verifiedBy?: string;
  evidence: EvidenceStatus;
  relatedMetrics: string[];
  expiryDate?: ISODate;
  mandatory: boolean;
  received: boolean;
}

/* ------------------------------------------------------------------ */
/* Business assessment (§42)                                           */
/* ------------------------------------------------------------------ */

export interface BusinessAssessmentAnswer {
  areaKey: string;
  dimensionKey: string;
  score: 1 | 2 | 3;
  justification: string;
  supportingDocuments: string[];
}

export interface BusinessAssessment {
  applicationId: UUID;
  scorecardVersion: string;
  answers: BusinessAssessmentAnswer[];
  assessedBy: string;
  assessedAt: ISODateTime;
}

/** Legacy ATB "Yekun rəy" per-component answer (§40). */
export interface LegacyScoreAnswer {
  componentKey: string;
  /** 0..1 achievement of the component's weight. */
  achievement: number;
  optionKey?: string;
  comment?: string;
}

export interface LegacyAssessment {
  applicationId: UUID;
  scorecardVersion: string;
  answers: LegacyScoreAnswer[];
  assessedBy: string;
  assessedAt: ISODateTime;
}

/* ------------------------------------------------------------------ */
/* Findings, risks, covenants, conditions                              */
/* ------------------------------------------------------------------ */

export const FINDING_CATEGORIES = [
  'DATA_QUALITY',
  'FINANCIAL_RISK',
  'CASH_FLOW',
  'CREDIT_BEHAVIOUR',
  'PURPOSE',
  'COLLATERAL',
  'GOVERNANCE',
  'RECONCILIATION',
  'POLICY',
  'SECTOR',
] as const;
export type FindingCategory = (typeof FINDING_CATEGORIES)[number];

export interface Finding {
  id: string;
  category: FindingCategory;
  severity: Severity;
  title: string;
  description: string;
  observedValue?: string;
  expectedValue?: string;
  source: string;
  evidence?: EvidenceStatus;
  financialImpact?: number;
  mitigant?: string;
  analystComment?: string;
  resolutionStatus: 'OPEN' | 'ACKNOWLEDGED' | 'MITIGATED' | 'RESOLVED' | 'WAIVED';
  autoGenerated: boolean;
}

export const RISK_CATEGORIES = [
  'LEVERAGE',
  'LIQUIDITY',
  'CASH_FLOW',
  'REFINANCING',
  'CONCENTRATION',
  'INDUSTRY',
  'FX',
  'GOVERNANCE',
  'TRANSPARENCY',
  'COLLATERAL',
  'PURPOSE',
  'EXECUTION',
  'RELATED_PARTIES',
] as const;
export type RiskCategory = (typeof RISK_CATEGORIES)[number];

export interface RiskMitigant {
  id: string;
  category: RiskCategory;
  severity: Severity;
  description: string;
  mitigant: string;
  residualRisk: Severity;
}

export interface Covenant {
  id: string;
  templateKey: string;
  label: string;
  metric: string;
  operator: 'GTE' | 'LTE';
  threshold: number;
  testFrequency: 'MONTHLY' | 'QUARTERLY' | 'SEMI_ANNUAL' | 'ANNUAL';
  source: string;
  breachAction: string;
  active: boolean;
}

export interface CreditCondition {
  id: string;
  kind: 'PRECEDENT' | 'SUBSEQUENT';
  label: string;
  description: string;
  responsible: string;
  dueBy?: ISODate;
  status: 'PENDING' | 'SATISFIED' | 'WAIVED';
}

/* ------------------------------------------------------------------ */
/* Workflow / decision                                                 */
/* ------------------------------------------------------------------ */

export const APPLICATION_STAGES = [
  'DRAFT',
  'PRE_SCREENING',
  'RM_SUBMITTED',
  'SME_CENTER_ANALYSIS',
  'UNDERWRITING',
  'RISK_REVIEW',
  'COMMITTEE',
  'DECIDED',
  'REJECTED_PRESCREEN',
  'RETURNED',
  'CANCELLED',
] as const;
export type ApplicationStage = (typeof APPLICATION_STAGES)[number];

export const DECISIONS = [
  'APPROVE',
  'APPROVE_WITH_CONDITIONS',
  'DECLINE',
  'RETURN_FOR_INFORMATION',
  'ESCALATE',
] as const;
export type Decision = (typeof DECISIONS)[number];

export interface DecisionRecord {
  decision: Decision;
  authority: string;
  decidedBy: string;
  decidedAt: ISODateTime;
  approvedAmount?: number;
  rationale: string;
}

export interface RejectionRecord {
  stage: ApplicationStage;
  reasonCode: string;
  description: string;
  acbScore: number | null;
  acbRating: string | null;
  groupExposure: number;
  requestedAmount: number;
  rm: string;
  branch: string;
  rejectedAt: ISODateTime;
  policyVersion: string;
  scorecardVersion: string;
  workflowVersion: string;
}

export interface AuditEntry {
  id: string;
  applicationId: UUID;
  entity: string;
  field: string;
  oldValue: string | null;
  newValue: string | null;
  user: string;
  role: string;
  reason?: string;
  timestamp: ISODateTime;
  category:
    | 'FINANCIAL_ADJUSTMENT'
    | 'BUREAU_UPDATE'
    | 'RATING'
    | 'NOTCHING'
    | 'OVERRIDE'
    | 'POLICY_EXCEPTION'
    | 'STRUCTURE'
    | 'DECISION'
    | 'WORKFLOW'
    | 'DATA_ENTRY';
}

/* ------------------------------------------------------------------ */
/* Sector plugin payloads (§67-§70)                                    */
/* ------------------------------------------------------------------ */

export interface AgricultureData {
  subType: 'CROP' | 'LIVESTOCK' | 'DAIRY' | 'POULTRY' | 'HORTICULTURE' | 'BEEKEEPING';
  landHectares?: number;
  crops?: Array<{
    crop: string;
    hectares: number;
    yieldPerHectare: number;
    normYieldPerHectare: number;
    pricePerUnit: number;
    unit: string;
    costPerHectare: number;
  }>;
  livestock?: {
    opening: number;
    births: number;
    purchases: number;
    sales: number;
    mortality: number;
    closing: number;
    avgUnitValue: number;
  };
  feed?: {
    opening: number;
    produced: number;
    purchased: number;
    consumed: number;
    closing: number;
    unit: string;
  };
}

export interface TransportVehicle {
  id: string;
  ownership: 'OWNED' | 'LEASED' | 'RENTED';
  model: string;
  year: number;
  acquisitionCost: number;
  currentValue: number;
  mileageKm: number;
  route: string;
  tripsPerMonth: number;
  tariffPerTrip: number;
  fuelCostPerTrip: number;
  driverCostPerMonth: number;
  maintenancePerMonth: number;
  insurancePerYear: number;
  isCollateral: boolean;
}

export interface InstallmentSalesData {
  aging: {
    current: number;
    d0_30: number;
    d31_90: number;
    d91_360: number;
    d360Plus: number;
  };
  writtenOff: number;
  monthlyBilled: number;
  monthlyCollected: number;
  provisionRatePct: Record<string, number>;
}

export interface BarterData {
  ownGoodsSales: number;
  barterOutValue: number;
  barterInValue: number;
  barterResaleValue: number;
  barterMarginPct: number;
}

export interface SectorData {
  agriculture?: AgricultureData;
  transport?: { vehicles: TransportVehicle[] };
  installmentSales?: InstallmentSalesData;
  barter?: BarterData;
}

/* ------------------------------------------------------------------ */
/* The application aggregate                                           */
/* ------------------------------------------------------------------ */

export interface PipelineTimestamps {
  receivedAt: ISODateTime;
  assignedToUwAt?: ISODateTime;
  uwCompletedAt?: ISODateTime;
  committeeAt?: ISODateTime;
  decidedAt?: ISODateTime;
  returnCount: number;
  waitingReason?: string;
  missingDocuments: string[];
}

export interface RatingOverride {
  calculatedGrade: string;
  overrideGrade: string;
  direction: 'UPGRADE' | 'DOWNGRADE';
  reason: string;
  requestedBy: string;
  approver: string;
  approvedAt: ISODateTime;
}

export interface PolicyExceptionRecord {
  id: string;
  ruleId: string;
  ruleName: string;
  threshold: number;
  actual: number | null;
  requestedWaiver: string;
  justification: string;
  mitigant: string;
  approver: string;
  status: 'REQUESTED' | 'APPROVED' | 'REJECTED';
}

export interface CreditApplication {
  id: UUID;
  reference: string;
  customerId: UUID;
  applicationDate: ISODate;
  branch: string;
  rm: string;
  underwriter?: string;
  channel: 'BRANCH' | 'DIGITAL' | 'PARTNER' | 'AGENT';
  stage: ApplicationStage;

  requestedStructure: LoanStructure;
  proposedStructure?: LoanStructure;

  purposeSummary: string;
  purposeLines: PurposeLine[];
  primaryRepaymentSource: string;
  secondaryRepaymentSource: string;

  groupMembers: GroupMember[];
  bureauReports: CreditBureauReport[];
  collateral: Collateral[];
  documents: CreditDocument[];

  periods: FinancialPeriod[];
  balanceSheets: BalanceSheet[];
  incomeStatements: IncomeStatement[];
  cashFlows: CashFlowStatement[];
  adjustments: FinancialAdjustment[];
  turnover: MonthlyTurnover[];

  businessAssessment?: BusinessAssessment;
  legacyAssessment?: LegacyAssessment;

  sectorData?: SectorData;

  /** Versions frozen at submission so the case stays reproducible (§4). */
  workflowVersion: string;
  scorecardVersion: string;
  legacyScorecardVersion: string;
  policyVersion: string;

  ratingOverride?: RatingOverride;
  policyExceptions: PolicyExceptionRecord[];
  manualFindings: Finding[];
  riskMitigants: RiskMitigant[];
  covenants: Covenant[];
  conditions: CreditCondition[];

  underwriterRecommendation?: {
    decision: Decision;
    recommendedAmount: number;
    narrative: string;
    preparedBy: string;
    preparedAt: ISODateTime;
  };

  committeeDecision?: DecisionRecord;
  rejection?: RejectionRecord;

  pipeline: PipelineTimestamps;
  auditTrail: AuditEntry[];

  /** Comparison anchor — a previous assessment of the same customer (§33). */
  previousApplicationId?: UUID;
}
