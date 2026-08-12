import type { CreditApplication, Customer } from '@/types/application';
import { bureauReport, facility, groupMember, id, purposeLine } from './builders';

/**
 * Rejected applications (§17).
 *
 * The point of this fixture is that a rejection is a *record*, not a
 * deletion. Prometeia's diagnostic found that ATB currently discards
 * pre-screen rejections entirely, which makes reject analysis, approval-rate
 * reporting and reject inference impossible. Here every rejection keeps the
 * bureau score, the exposure, the reason code and the frozen versions.
 */

interface RejectionSpec {
  reference: string;
  displayName: string;
  sector: string;
  subSector: string;
  branch: string;
  rm: string;
  amount: number;
  acbScore: number | null;
  acbGrade: string | null;
  groupExposure: number;
  stage: CreditApplication['stage'];
  reasonCode: string;
  description: string;
  rejectedAt: string;
  applicationDate: string;
}

const SPECS: RejectionSpec[] = [
  {
    reference: 'KOB-2026-07-0119',
    displayName: 'Bakı Mebel Studiyası (demo)',
    sector: 'İstehsal',
    subSector: 'Mebel istehsalı',
    branch: 'Mərkəzi filial',
    rm: 'RM-014',
    amount: 180_000,
    acbScore: 284,
    acbGrade: 'SATISFACTORY',
    groupExposure: 412_000,
    stage: 'REJECTED_PRESCREEN',
    reasonCode: 'PRESCREEN_BUREAU_SCORE',
    description: 'AKB Micro Score 284 — təklif olunan ilkin süzgəc həddindən (400) aşağıdır.',
    applicationDate: '2026-07-03',
    rejectedAt: '2026-07-03T11:24:00.000Z',
  },
  {
    reference: 'KOB-2026-07-0126',
    displayName: 'Sumqayıt Plastik (demo)',
    sector: 'İstehsal',
    subSector: 'Plastik məmulatlar',
    branch: 'Sumqayıt filialı',
    rm: 'RM-019',
    amount: 640_000,
    acbScore: 118,
    acbGrade: 'POOR',
    groupExposure: 1_240_000,
    stage: 'REJECTED_PRESCREEN',
    reasonCode: 'PRESCREEN_BUREAU_RATING_POOR',
    description: 'AKB reytinqi "Zəif" — aktiv 90+ gün gecikmə mövcuddur.',
    applicationDate: '2026-07-05',
    rejectedAt: '2026-07-05T09:10:00.000Z',
  },
  {
    reference: 'KOB-2026-07-0134',
    displayName: 'Lənkəran Aqro Ticarət (demo)',
    sector: 'Kənd təsərrüfatı',
    subSector: 'Meyvə-tərəvəz ticarəti',
    branch: 'Lənkəran filialı',
    rm: 'RM-052',
    amount: 95_000,
    acbScore: 468,
    acbGrade: 'MEDIUM',
    groupExposure: 213_000,
    stage: 'REJECTED_PRESCREEN',
    reasonCode: 'STOP_FACTOR_OWNERSHIP',
    description:
      'Biznesin sifarişçiyə aidiyyəti sənədlə təsdiqlənmədi — obyekt üçüncü şəxsin adına qeydiyyatdadır.',
    applicationDate: '2026-07-09',
    rejectedAt: '2026-07-12T16:40:00.000Z',
  },
  {
    reference: 'KOB-2026-06-0098',
    displayName: 'Xaçmaz Soyuducu Anbar (demo)',
    sector: 'Xidmət',
    subSector: 'Anbar xidmətləri',
    branch: 'Quba filialı',
    rm: 'RM-037',
    amount: 320_000,
    acbScore: 522,
    acbGrade: 'MEDIUM',
    groupExposure: 690_000,
    stage: 'DECIDED',
    reasonCode: 'INSUFFICIENT_REPAYMENT_CAPACITY',
    description:
      'Komitə qərarı: proqnoz pul axını təklif olunan ödəniş qrafikini dəstəkləmir (DSCR 0.94x).',
    applicationDate: '2026-06-11',
    rejectedAt: '2026-06-24T13:05:00.000Z',
  },
  {
    reference: 'KOB-2026-06-0104',
    displayName: 'Mingəçevir Tekstil (demo)',
    sector: 'İstehsal',
    subSector: 'Tekstil',
    branch: 'Mingəçevir filialı',
    rm: 'RM-041',
    amount: 1_100_000,
    acbScore: 640,
    acbGrade: 'MEDIUM',
    groupExposure: 1_820_000,
    stage: 'DECIDED',
    reasonCode: 'COLLATERAL_INSUFFICIENT',
    description: 'Uyğun girov örtüyü 46% — tələb olunan səviyyəyə çatmır və əlavə təminat təqdim edilmədi.',
    applicationDate: '2026-06-15',
    rejectedAt: '2026-06-30T10:20:00.000Z',
  },
  {
    reference: 'KOB-2026-05-0071',
    displayName: 'Şəki Süd Emalı (demo)',
    sector: 'İstehsal',
    subSector: 'Süd emalı',
    branch: 'Şəki filialı',
    rm: 'RM-058',
    amount: 240_000,
    acbScore: null,
    acbGrade: null,
    groupExposure: 240_000,
    stage: 'REJECTED_PRESCREEN',
    reasonCode: 'NO_CREDIT_HISTORY_ESCALATED_REJECTED',
    description:
      'Kredit tarixçəsi mövcud deyil; anderraytinq qiymətləndirməsindən sonra sənədləşmə kifayət etmədiyi üçün imtina.',
    applicationDate: '2026-05-20',
    rejectedAt: '2026-05-27T15:00:00.000Z',
  },
];

export function buildRejectedApplications(existingCustomers: Customer[]): {
  customers: Customer[];
  applications: CreditApplication[];
} {
  const customers: Customer[] = [];
  const applications: CreditApplication[] = [];

  for (const spec of SPECS) {
    const customerId = id('cust');
    const applicationId = id('app');

    customers.push({
      id: customerId,
      legalName: spec.displayName,
      displayName: spec.displayName,
      customerType: 'LEGAL_ENTITY',
      legalForm: 'MMC',
      taxId: `DEMO-2${applicationId.slice(-9)}`,
      registrationDate: '2019-01-01',
      activityStartDate: '2019-01-01',
      officialActivityYears: 7,
      unofficialActivityYears: 0,
      address: 'Demo ünvan',
      region: spec.branch.replace(' filialı', ''),
      sector: spec.sector,
      subSector: spec.subSector,
      businessModel: 'Demo məlumat — imtina edilmiş müraciət qeydi.',
      products: [],
      geography: spec.branch,
      locations: 1,
      employees: 12,
      keyCustomers: [],
      keySuppliers: [],
      seasonality: '—',
      seasonalityIndex: new Array(12).fill(1),
      shareholders: [{ id: id('sh'), name: 'Təsisçi (demo)', ownershipPct: 100, isUbo: true }],
      management: [],
    });

    const facilities = spec.acbScore
      ? [
          facility({
            lender: 'Bank P (demo)',
            originalAmount: Math.round(spec.groupExposure * 0.6),
            outstanding: Math.round(spec.groupExposure * 0.45),
            issueDate: '2024-05-01',
            maturityDate: '2027-05-01',
            monthlyPayment: Math.round((spec.groupExposure * 0.45) / 30),
            maxDpd: spec.acbGrade === 'POOR' ? 96 : 12,
            dpd30PlusEvents: spec.acbGrade === 'POOR' ? 3 : 0,
            currentDpd: spec.acbGrade === 'POOR' ? 96 : 0,
          }),
        ]
      : [];

    applications.push({
      id: applicationId,
      reference: spec.reference,
      customerId,
      applicationDate: spec.applicationDate,
      branch: spec.branch,
      rm: spec.rm,
      channel: 'BRANCH',
      stage: spec.stage,
      requestedStructure: {
        amount: spec.amount,
        currency: 'AZN',
        tenorMonths: 36,
        gracePeriodMonths: 0,
        annualRatePct: 18,
        commissionPct: 0.5,
        repaymentFrequency: 'MONTHLY',
        amortisation: 'ANNUITY',
        product: 'WORKING_CAPITAL_LOAN',
      },
      purposeSummary: 'Dövriyyə vəsaiti',
      purposeLines: [
        purposeLine('WORKING_CAPITAL', 'Dövriyyə vəsaiti', spec.amount, 'PARTIALLY_VERIFIED', '—', '—'),
      ],
      primaryRepaymentSource: 'Əsas fəaliyyət',
      secondaryRepaymentSource: '—',
      groupMembers: [
        groupMember(spec.displayName, 'SELF', 0, spec.groupExposure - spec.amount, {
          requestedExposure: spec.amount,
        }),
      ],
      bureauReports:
        spec.acbScore !== null
          ? [bureauReport(applicationId, spec.displayName, spec.rejectedAt.slice(0, 10), spec.acbScore, facilities, {
              individualBureauRating: spec.acbGrade ?? undefined,
            })]
          : [],
      collateral: [],
      documents: [],
      periods: [],
      balanceSheets: [],
      incomeStatements: [],
      cashFlows: [],
      adjustments: [],
      turnover: [],
      workflowVersion: 'PROMETEIA_PROPOSED_V2',
      scorecardVersion: 'PROMETEIA_QUICK_WIN_V1',
      legacyScorecardVersion: 'ATB_YEKUN_REY_V1',
      policyVersion: 'ATB_POLICY_V1',
      policyExceptions: [],
      manualFindings: [],
      riskMitigants: [],
      covenants: [],
      conditions: [],
      rejection: {
        stage: spec.stage,
        reasonCode: spec.reasonCode,
        description: spec.description,
        acbScore: spec.acbScore,
        acbRating: spec.acbGrade,
        groupExposure: spec.groupExposure,
        requestedAmount: spec.amount,
        rm: spec.rm,
        branch: spec.branch,
        rejectedAt: spec.rejectedAt,
        policyVersion: 'ATB_POLICY_V1',
        scorecardVersion: 'PROMETEIA_QUICK_WIN_V1',
        workflowVersion: 'PROMETEIA_PROPOSED_V2',
      },
      committeeDecision:
        spec.stage === 'DECIDED'
          ? {
              decision: 'DECLINE',
              authority: 'SMALL_COMMITTEE',
              decidedBy: 'Komitə (demo)',
              decidedAt: spec.rejectedAt,
              rationale: spec.description,
            }
          : undefined,
      pipeline: {
        receivedAt: `${spec.applicationDate}T09:00:00.000Z`,
        decidedAt: spec.rejectedAt,
        returnCount: 0,
        missingDocuments: [],
      },
      auditTrail: [],
    });
  }

  // Existing customers are untouched; rejected cases carry their own records.
  void existingCustomers;

  return { customers, applications };
}
