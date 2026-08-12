import type { CreditApplication, Customer } from '@/types/application';
import {
  balance,
  bureauReport,
  cashFlow,
  collateralItem,
  document,
  facility,
  groupMember,
  id,
  income,
  monthlyTurnover,
  monthsOfYear,
  period,
  purposeLine,
} from './builders';

/**
 * Demo cases 2-5. All identifiers synthetic.
 *
 *  2. Zaqatala Ticarət Evi (§79) — serial refinancing / loan cycling.
 *  3. Gəncə Metal Emalı (§80) — strong borrower, verified data.
 *  4. Abşeron İnşaat Servis    — construction, contract-driven, lumpy cash.
 *  5. Mil-Muğan Aqro          — agriculture, seasonal, sector-plugin data.
 */

/* ================================================================== */
/* 2. Refinancing / loan cycling                                       */
/* ================================================================== */

export function buildRefinancingCase(): { customer: Customer; application: CreditApplication } {
  const customerId = id('cust');
  const applicationId = id('app');

  const customer: Customer = {
    id: customerId,
    legalName: 'Fərdi sahibkar "Zaqatala Ticarət Evi" (demo)',
    displayName: 'Zaqatala Ticarət Evi',
    customerType: 'INDIVIDUAL_ENTREPRENEUR',
    legalForm: 'FST',
    taxId: 'DEMO-1000000002',
    registrationDate: '2018-06-02',
    activityStartDate: '2015-04-01',
    officialActivityYears: 8,
    unofficialActivityYears: 11,
    address: 'Zaqatala şəhəri (demo ünvan)',
    region: 'Şəki-Zaqatala',
    sector: 'Pərakəndə ticarət',
    subSector: 'Qarışıq mal ticarəti (market)',
    businessModel: 'Şəhər mərkəzində iki ticarət obyekti; nağd və nisyə pərakəndə satış.',
    products: ['Ərzaq', 'Məişət malları', 'Geyim'],
    geography: 'Zaqatala, Balakən',
    locations: 2,
    employees: 18,
    keyCustomers: [{ name: 'Pərakəndə alıcılar', sharePct: 100 }],
    keySuppliers: [
      { name: 'Topdan təchizatçı M', sharePct: 44, paymentTerms: '14 gün' },
      { name: 'Topdan təchizatçı N', sharePct: 26, paymentTerms: 'Nağd' },
    ],
    seasonality: 'Bayram aylarında (mart, dekabr) satış artımı.',
    seasonalityIndex: [0.95, 0.95, 1.2, 1.0, 1.0, 0.95, 0.9, 0.95, 1.05, 1.0, 1.0, 1.15],
    shareholders: [{ id: id('sh'), name: 'Sahibkar (demo)', ownershipPct: 100, isUbo: true }],
    management: [
      {
        id: id('mg'),
        name: 'Sahibkar (demo)',
        role: 'Sahibkar / rəhbər',
        yearsInCompany: 11,
        yearsInSector: 11,
        isKeyPerson: true,
        note: 'Bütün əməliyyatlar bir şəxsə bağlıdır; əvəzedici idarəetmə yoxdur.',
      },
    ],
    existingAtbCustomerSince: '2020-02-11',
  };

  const p2024 = period(applicationId, '2024', 2024, 'HISTORICAL', '2024-01-01', '2024-12-31', 12);
  const p2025 = period(applicationId, '2025', 2025, 'HISTORICAL', '2025-01-01', '2025-12-31', 12, true);
  const p2026 = period(applicationId, '2026 YTD (6 ay)', 2026, 'YTD', '2026-01-01', '2026-06-30', 6);

  const bs2024 = balance(p2024.id, {
    cash: 42_000,
    receivables: 186_000,
    inventory: 640_000,
    fixedAssets: 310_000,
    shortTermBankDebt: 520_000,
    payables: 268_000,
    shareCapital: 50_000,
  });

  const bs2025 = balance(p2025.id, {
    cash: 31_000,
    receivables: 214_000,
    inventory: 705_000,
    fixedAssets: 296_000,
    shortTermBankDebt: 690_000,
    payables: 301_000,
    shareCapital: 50_000,
    evidence: {
      inventory: ['CUSTOMER_VERBAL', 'VERBAL'],
      receivables: ['CUSTOMER_VERBAL', 'VERBAL'],
      payables: ['CUSTOMER_VERBAL', 'VERBAL'],
    },
  });

  const bs2026 = balance(p2026.id, {
    cash: 26_000,
    receivables: 232_000,
    inventory: 728_000,
    fixedAssets: 288_000,
    shortTermBankDebt: 742_000,
    payables: 318_000,
    shareCapital: 50_000,
  });

  const is2024 = income(p2024.id, {
    sales: 2_180_000,
    cogs: 1_744_000,
    operatingExpenses: 302_000,
    depreciation: 28_000,
    interestExpense: 106_000,
    tax: 12_000,
  });
  const is2025 = income(p2025.id, {
    sales: 2_240_000,
    cogs: 1_814_000,
    operatingExpenses: 328_000,
    depreciation: 27_000,
    interestExpense: 148_000,
    tax: 11_000,
    evidence: {
      sales: ['CUSTOMER_VERBAL', 'VERBAL'],
      cogs: ['ANALYST_CALCULATION', 'ANALYST_ESTIMATE'],
      operatingExpenses: ['CUSTOMER_VERBAL', 'VERBAL'],
    },
  });
  const is2026 = income(p2026.id, {
    sales: 1_090_000,
    cogs: 892_000,
    operatingExpenses: 168_000,
    depreciation: 13_000,
    interestExpense: 82_000,
    tax: 5_000,
  });

  const cf2025 = cashFlow(p2025.id, {
    openingCash: 42_000,
    customerReceipts: 2_212_000,
    supplierPayments: 1_879_000,
    payroll: 168_000,
    rent: 84_000,
    taxPaid: 11_000,
    otherOperatingExpenses: 76_000,
    capex: 13_000,
    ownerWithdrawal: 96_000,
    newBorrowing: 620_000,
    principalRepaid: 458_000,
    interestPaid: 148_000,
  });

  /* Serial refinancing: each closure is followed within days by a bigger loan. */
  const facilities = [
    facility({
      lender: 'Bank G (demo)',
      originalAmount: 180_000,
      outstanding: 0,
      issueDate: '2022-03-10',
      maturityDate: '2025-03-10',
      closureDate: '2023-05-18',
      status: 'CLOSED',
      earlyClosure: true,
      maxDpd: 24,
    }),
    facility({
      lender: 'Bank G (demo)',
      originalAmount: 280_000,
      outstanding: 0,
      issueDate: '2023-05-22',
      maturityDate: '2026-05-22',
      closureDate: '2024-07-04',
      status: 'CLOSED',
      earlyClosure: true,
      maxDpd: 31,
      dpd30PlusEvents: 1,
    }),
    facility({
      lender: 'Bank H (demo)',
      originalAmount: 420_000,
      outstanding: 0,
      issueDate: '2024-07-09',
      maturityDate: '2027-07-09',
      closureDate: '2025-08-14',
      status: 'CLOSED',
      earlyClosure: true,
      maxDpd: 18,
    }),
    facility({
      lender: 'Bank H (demo)',
      originalAmount: 560_000,
      outstanding: 468_000,
      issueDate: '2025-08-19',
      maturityDate: '2028-08-19',
      monthlyPayment: 21_400,
      maxDpd: 12,
    }),
    facility({
      lender: 'Azər-Türk Bank',
      originalAmount: 300_000,
      outstanding: 274_000,
      issueDate: '2025-11-03',
      maturityDate: '2028-11-03',
      monthlyPayment: 11_600,
      maxDpd: 8,
      collateralised: true,
    }),
  ];

  const report = bureauReport(applicationId, 'Zaqatala Ticarət Evi', '2026-07-15', 372, facilities, {
    individualBureauRating: 'SATISFACTORY',
    inquiries: [
      { id: id('inq'), date: '2026-07-02', institution: 'Bank I (demo)', purpose: 'Biznes krediti', resultedInLoan: false },
      { id: id('inq'), date: '2026-06-24', institution: 'Bank J (demo)', purpose: 'Biznes krediti', resultedInLoan: false },
      { id: id('inq'), date: '2026-06-11', institution: 'Bank K (demo)', purpose: 'İstehlak krediti', resultedInLoan: false },
    ],
  });

  const application: CreditApplication = {
    id: applicationId,
    reference: 'KOB-2026-07-0157',
    customerId,
    applicationDate: '2026-07-16',
    branch: 'Zaqatala filialı',
    rm: 'RM-022',
    underwriter: 'UW-001',
    channel: 'BRANCH',
    stage: 'UNDERWRITING',
    requestedStructure: {
      amount: 750_000,
      currency: 'AZN',
      tenorMonths: 48,
      gracePeriodMonths: 6,
      annualRatePct: 19,
      commissionPct: 0.5,
      repaymentFrequency: 'MONTHLY',
      amortisation: 'ANNUITY',
      product: 'WORKING_CAPITAL_LOAN',
    },
    purposeSummary: 'Mövcud bank borclarının konsolidasiyası və dövriyyə vəsaitinin artırılması.',
    purposeLines: [
      purposeLine('REFINANCE_OTHER_BANK', 'Bank H (demo) kreditinin bağlanması', 468_000, 'VERIFIED', 'Faiz yükünün azaldılması', 'Birbaşa köçürmə ilə bağlanır'),
      purposeLine('INVENTORY', 'Mal ehtiyatının artırılması', 180_000, 'VERBAL', 'Çeşidin genişləndirilməsi', 'Alış qaimələri ilə sonradan yoxlama'),
      purposeLine('PERSONAL_NON_BUSINESS', 'Şəxsi ehtiyaclar', 102_000, 'MISSING', 'Biznesə birbaşa fayda yaratmır', 'Nəzarət imkanı yoxdur'),
    ],
    primaryRepaymentSource: 'Pərakəndə satışdan gündəlik nağd daxilolmalar',
    secondaryRepaymentSource: 'Ticarət obyektinin girovu',
    groupMembers: [
      groupMember('Zaqatala Ticarət Evi (demo)', 'SELF', 274_000, 468_000, { requestedExposure: 750_000 }),
      groupMember('Sahibkarın həyat yoldaşı (demo)', 'RELATED_BORROWER', 0, 48_000),
    ],
    bureauReports: [report],
    collateral: [
      collateralItem({
        type: 'REAL_ESTATE_COMMERCIAL',
        description: 'Ticarət obyekti, 420 m² (demo obyekt)',
        ownerName: 'Sahibkar (demo)',
        marketValue: 640_000,
        forcedSaleValue: 460_000,
        existingLienAmount: 274_000,
      }),
      collateralItem({
        type: 'PERSONAL_GUARANTEE',
        description: 'Həyat yoldaşının zaminliyi',
        ownerName: 'Sahibkarın həyat yoldaşı (demo)',
        ownerRelationship: 'GUARANTOR',
        marketValue: 750_000,
        forcedSaleValue: 0,
      }),
    ],
    documents: [
      document(applicationId, 'LEGAL', 'Sahibkar qeydiyyat şəhadətnaməsi', 'VERIFIED'),
      document(applicationId, 'TAX', 'Sadələşdirilmiş vergi bəyannaməsi 2025', 'PARTIALLY_VERIFIED'),
      document(applicationId, 'BANK_STATEMENT', 'Bank çıxarışı (12 ay)', 'VERIFIED'),
      document(applicationId, 'REGISTRY_LEDGER', 'Qeydiyyat dəftəri (foto)', 'PARTIALLY_VERIFIED'),
      document(applicationId, 'INVENTORY_LIST', 'Anbar qalığı', 'VERBAL'),
      document(applicationId, 'RECEIVABLE_LIST', 'Nisyə satış siyahısı', 'VERBAL'),
      document(applicationId, 'PAYABLE_LIST', 'Kreditor siyahısı', 'MISSING', { received: false }),
      document(applicationId, 'COLLATERAL', 'Ticarət obyekti üzrə çıxarış', 'VERIFIED'),
      document(applicationId, 'BUREAU_REPORT', 'AKB çıxarışı', 'VERIFIED'),
    ],
    periods: [p2024, p2025, p2026],
    balanceSheets: [bs2024, bs2025, bs2026],
    incomeStatements: [is2024, is2025, is2026],
    cashFlows: [cf2025],
    adjustments: [],
    turnover: monthlyTurnover(p2025.id, monthsOfYear(2025), 62_000, 41_000, 78_000, 186_667, 121_000),
    businessAssessment: {
      applicationId,
      scorecardVersion: 'PROMETEIA_QUICK_WIN_V1',
      assessedBy: 'UW-001',
      assessedAt: '2026-07-18T09:00:00.000Z',
      answers: [
        {
          areaKey: 'RELATIONSHIP_VERIFICATION',
          dimensionKey: 'RELATIONSHIP_VERIFICATION',
          score: 2,
          justification: 'Obyektin mülkiyyəti təsdiqlənir, lakin dövriyyənin böyük hissəsi nağddır və uçotda əks olunmur.',
          supportingDocuments: ['Mülkiyyət sənədi', 'Bank çıxarışı'],
        },
        { areaKey: 'STRUCTURE_AND_MANAGEMENT', dimensionKey: 'TRACK_RECORD', score: 2, justification: '11 il fəaliyyət, lakin idarəetmə tam bir şəxsə bağlıdır.', supportingDocuments: [] },
        { areaKey: 'STRUCTURE_AND_MANAGEMENT', dimensionKey: 'BUSINESS_STRUCTURE', score: 1, justification: 'Açar şəxsdən tam asılılıq, təchizatçı konsentrasiyası 70%.', supportingDocuments: [] },
        { areaKey: 'DOCUMENTATION_REPORTING', dimensionKey: 'DOCUMENTATION_REPORTING', score: 1, justification: 'Uçot yalnız əl ilə aparılan qeydiyyat dəftəri ilə məhdudlaşır.', supportingDocuments: ['Qeydiyyat dəftəri'] },
      ],
    },
    legacyAssessment: {
      applicationId,
      scorecardVersion: 'ATB_YEKUN_REY_V1',
      assessedBy: 'UW-001',
      assessedAt: '2026-07-18T10:00:00.000Z',
      answers: [
        { componentKey: 'AKB_EXTRACTS_OBTAINED', optionKey: 'YES', achievement: 1 },
        { componentKey: 'UNJUSTIFIED_RECENT_INQUIRIES', optionKey: 'YES', achievement: 0 },
        { componentKey: 'UNJUSTIFIED_DPD_0_30', optionKey: 'YES', achievement: 0 },
        { componentKey: 'UNJUSTIFIED_DPD_30_PLUS', optionKey: 'NO', achievement: 1, comment: '31 günlük gecikmə sənədlə əsaslandırılıb (təchizatçı mübahisəsi).' },
        { componentKey: 'REPAID_BY_INSTALMENTS', optionKey: 'NO', achievement: 0 },
        { componentKey: 'DEBT_BURDEN_INCREASE', optionKey: 'YES', achievement: 0 },
        { componentKey: 'BUSINESS_OWNERSHIP_LINK', achievement: 0.6 },
        { componentKey: 'STRUCTURE_AND_MANAGEMENT', achievement: 0.45 },
        { componentKey: 'DOCUMENTATION_REPORTING', achievement: 0.3 },
        { componentKey: 'BALANCE_SHEET', achievement: 0.4 },
        { componentKey: 'INCOME_STATEMENT', achievement: 0.35 },
        { componentKey: 'CASH_FLOWS', achievement: 0.35 },
        { componentKey: 'STATEMENT_COMPARISON', achievement: 0.3 },
        { componentKey: 'RATIOS', achievement: 0.35 },
        { componentKey: 'PURPOSE_DOCUMENTS', optionKey: 'PARTIAL', achievement: 0.5 },
        { componentKey: 'PURPOSE_EFFICIENCY', optionKey: 'INEFFICIENT', achievement: 0 },
        { componentKey: 'PURPOSE_CONTROL', optionKey: 'PARTIAL', achievement: 0.5 },
        { componentKey: 'COLLATERAL_OWNER_RELATION', optionKey: 'YES', achievement: 1 },
        { componentKey: 'COLLATERAL_RISK_GRADE', optionKey: 'MEDIUM', achievement: 0.5 },
        { componentKey: 'GUARANTOR_SUITABILITY', optionKey: 'PARTIAL', achievement: 0.5 },
      ],
    },
    workflowVersion: 'PROMETEIA_PROPOSED_V2',
    scorecardVersion: 'PROMETEIA_QUICK_WIN_V1',
    legacyScorecardVersion: 'ATB_YEKUN_REY_V1',
    policyVersion: 'ATB_POLICY_V1',
    policyExceptions: [],
    manualFindings: [],
    riskMitigants: [],
    covenants: [],
    conditions: [],
    pipeline: {
      receivedAt: '2026-07-16T11:00:00.000Z',
      assignedToUwAt: '2026-07-17T09:30:00.000Z',
      returnCount: 2,
      waitingReason: 'Kreditor siyahısı və nisyə satış uçotu gözlənilir',
      missingDocuments: ['Kreditor borcları siyahısı'],
    },
    auditTrail: [],
  };

  return { customer, application };
}

/* ================================================================== */
/* 3. Strong borrower                                                  */
/* ================================================================== */

export function buildStrongBorrowerCase(): { customer: Customer; application: CreditApplication } {
  const customerId = id('cust');
  const applicationId = id('app');

  const customer: Customer = {
    id: customerId,
    legalName: '"Gəncə Metal Emalı" MMC (demo)',
    displayName: 'Gəncə Metal Emalı',
    customerType: 'LEGAL_ENTITY',
    legalForm: 'MMC',
    taxId: 'DEMO-1000000003',
    registrationDate: '2011-09-20',
    activityStartDate: '2011-09-20',
    officialActivityYears: 14,
    unofficialActivityYears: 0,
    address: 'Gəncə şəhəri, sənaye sahəsi (demo ünvan)',
    region: 'Gəncə',
    sector: 'İstehsal',
    subSector: 'Metal konstruksiyaların istehsalı',
    businessModel: 'Sifariş əsasında metal konstruksiya istehsalı; tikinti şirkətləri və sənaye müəssisələri ilə müqavilələr.',
    products: ['Metal karkas', 'Sendviç panel', 'Anbar konstruksiyaları'],
    geography: 'Gəncə, Bakı, regionlar',
    locations: 1,
    employees: 96,
    keyCustomers: [
      { name: 'Sənaye müəssisəsi P', sharePct: 18 },
      { name: 'Tikinti şirkəti Q', sharePct: 15 },
      { name: 'Dövlət sifarişi R', sharePct: 12 },
    ],
    keySuppliers: [
      { name: 'Metal idxalatçısı S', sharePct: 40, paymentTerms: '45 gün' },
      { name: 'Yerli təchizatçı T', sharePct: 22, paymentTerms: '30 gün' },
    ],
    seasonality: 'İl boyu sabit; tikinti mövsümündə (aprel-oktyabr) 10-15% artım.',
    seasonalityIndex: [0.9, 0.9, 1.0, 1.1, 1.1, 1.1, 1.05, 1.05, 1.1, 1.05, 0.95, 0.7],
    shareholders: [
      { id: id('sh'), name: 'Təsisçi A (demo)', ownershipPct: 55, isUbo: true },
      { id: id('sh'), name: 'Təsisçi B (demo)', ownershipPct: 45, isUbo: true },
    ],
    management: [
      { id: id('mg'), name: 'Baş direktor (demo)', role: 'Baş direktor', yearsInCompany: 14, yearsInSector: 22, isKeyPerson: false },
      { id: id('mg'), name: 'İstehsalat direktoru (demo)', role: 'İstehsalat direktoru', yearsInCompany: 9, yearsInSector: 18, isKeyPerson: false },
      { id: id('mg'), name: 'Maliyyə direktoru (demo)', role: 'Maliyyə direktoru', yearsInCompany: 6, yearsInSector: 14, isKeyPerson: false },
    ],
    existingAtbCustomerSince: '2015-01-15',
  };

  const p2024 = period(applicationId, '2024', 2024, 'HISTORICAL', '2024-01-01', '2024-12-31', 12);
  const p2025 = period(applicationId, '2025', 2025, 'HISTORICAL', '2025-01-01', '2025-12-31', 12, true);

  const bs2024 = balance(p2024.id, {
    cash: 1_240_000,
    receivables: 1_860_000,
    inventory: 1_420_000,
    fixedAssets: 4_680_000,
    shortTermBankDebt: 620_000,
    payables: 1_180_000,
    longTermBankDebt: 1_240_000,
    shareCapital: 1_500_000,
    evidence: { cash: ['BANK_STATEMENT', 'VERIFIED'], receivables: ['CUSTOMER_DOCUMENT', 'VERIFIED'], inventory: ['CUSTOMER_DOCUMENT', 'VERIFIED'] },
  });

  const bs2025 = balance(p2025.id, {
    cash: 1_580_000,
    receivables: 2_010_000,
    inventory: 1_510_000,
    fixedAssets: 5_120_000,
    shortTermBankDebt: 540_000,
    payables: 1_260_000,
    longTermBankDebt: 980_000,
    shareCapital: 1_500_000,
    ownerWithdrawals: 0,
    evidence: {
      cash: ['BANK_STATEMENT', 'VERIFIED'],
      receivables: ['CUSTOMER_DOCUMENT', 'VERIFIED'],
      inventory: ['CUSTOMER_DOCUMENT', 'VERIFIED'],
      payables: ['CUSTOMER_DOCUMENT', 'VERIFIED'],
      fixedAssets: ['THIRD_PARTY_APPRAISAL', 'VERIFIED'],
    },
  });

  const is2024 = income(p2024.id, {
    sales: 12_400_000,
    cogs: 9_176_000,
    operatingExpenses: 1_480_000,
    depreciation: 420_000,
    interestExpense: 268_000,
    tax: 210_000,
    evidence: { sales: ['TAX_AUTHORITY', 'VERIFIED'] },
  });
  const is2025 = income(p2025.id, {
    sales: 14_260_000,
    cogs: 10_408_000,
    operatingExpenses: 1_610_000,
    depreciation: 460_000,
    interestExpense: 232_000,
    tax: 264_000,
    evidence: {
      sales: ['TAX_AUTHORITY', 'VERIFIED'],
      cogs: ['CUSTOMER_DOCUMENT', 'VERIFIED'],
      operatingExpenses: ['CUSTOMER_DOCUMENT', 'VERIFIED'],
      tax: ['TAX_AUTHORITY', 'VERIFIED'],
    },
  });

  const cf2025 = cashFlow(p2025.id, {
    openingCash: 1_240_000,
    customerReceipts: 14_110_000,
    supplierPayments: 10_328_000,
    payroll: 1_040_000,
    rent: 120_000,
    taxPaid: 264_000,
    otherOperatingExpenses: 450_000,
    capex: 420_000,
    principalRepaid: 340_000,
    interestPaid: 232_000,
    evidence: { customerReceipts: ['BANK_STATEMENT', 'VERIFIED'], supplierPayments: ['BANK_STATEMENT', 'VERIFIED'] },
  });

  const facilities = [
    facility({
      lender: 'Azər-Türk Bank',
      product: 'İnvestisiya krediti',
      originalAmount: 2_000_000,
      outstanding: 980_000,
      issueDate: '2022-05-16',
      maturityDate: '2029-05-16',
      monthlyPayment: 19_800,
      collateralised: true,
    }),
    facility({
      lender: 'Azər-Türk Bank',
      product: 'Dövriyyə krediti',
      originalAmount: 800_000,
      outstanding: 540_000,
      issueDate: '2024-09-02',
      maturityDate: '2027-09-02',
      monthlyPayment: 9_600,
      collateralised: true,
    }),
    facility({
      lender: 'Bank L (demo)',
      originalAmount: 1_000_000,
      outstanding: 0,
      issueDate: '2020-04-10',
      maturityDate: '2025-04-10',
      closureDate: '2025-04-10',
      status: 'CLOSED',
    }),
  ];

  const report = bureauReport(applicationId, 'Gəncə Metal Emalı', '2026-07-20', 884, facilities, {
    individualBureauRating: 'EXCELLENT',
    inquiries: [{ id: id('inq'), date: '2026-07-19', institution: 'Azər-Türk Bank', purpose: 'Biznes krediti', resultedInLoan: true }],
  });

  const application: CreditApplication = {
    id: applicationId,
    reference: 'KOB-2026-07-0163',
    customerId,
    applicationDate: '2026-07-21',
    branch: 'Gəncə filialı',
    rm: 'RM-008',
    underwriter: 'UW-002',
    channel: 'BRANCH',
    stage: 'COMMITTEE',
    requestedStructure: {
      amount: 1_800_000,
      currency: 'AZN',
      tenorMonths: 60,
      gracePeriodMonths: 6,
      annualRatePct: 15.5,
      commissionPct: 0.3,
      repaymentFrequency: 'MONTHLY',
      amortisation: 'ANNUITY',
      product: 'INVESTMENT_LOAN',
    },
    purposeSummary: 'Yeni lazer kəsmə xəttinin alınması və quraşdırılması.',
    purposeLines: [
      purposeLine(
        'CAPEX',
        'Lazer kəsmə xətti (avadanlıq alqı-satqı müqaviləsi ilə)',
        1_800_000,
        'VERIFIED',
        'İstehsal gücünün 35% artması, subpodrat xərclərinin azalması',
        'Avadanlıq birbaşa təchizatçıya ödənilir, qəbul aktı ilə təsdiqlənir',
        {
          evidenceDocument: 'Avadanlıq alqı-satqı müqaviləsi (demo)',
          effectiveness: {
            investmentAmount: 2_250_000,
            ownContribution: 450_000,
            financedAmount: 1_800_000,
            additionalAnnualSales: 3_100_000,
            additionalAnnualEbitda: 682_000,
            annualCashBenefit: 610_000,
            paybackYears: 3.7,
          },
        },
      ),
    ],
    primaryRepaymentSource: 'İstehsal fəaliyyətindən əməliyyat pul axını',
    secondaryRepaymentSource: 'İstehsal sahəsi və avadanlıq girovu',
    groupMembers: [groupMember('Gəncə Metal Emalı MMC', 'SELF', 1_520_000, 0, { requestedExposure: 1_800_000 })],
    bureauReports: [report],
    collateral: [
      collateralItem({
        type: 'REAL_ESTATE_COMMERCIAL',
        description: 'İstehsal sahəsi və inzibati bina, 6.800 m² (demo obyekt)',
        ownerName: 'Gəncə Metal Emalı MMC',
        ownerRelationship: 'SELF',
        marketValue: 5_400_000,
        forcedSaleValue: 4_320_000,
        existingLienAmount: 1_520_000,
      }),
      collateralItem({
        type: 'EQUIPMENT',
        description: 'Alınacaq lazer kəsmə xətti',
        ownerName: 'Gəncə Metal Emalı MMC',
        ownerRelationship: 'SELF',
        marketValue: 2_250_000,
        forcedSaleValue: 1_580_000,
      }),
    ],
    documents: [
      document(applicationId, 'LEGAL', 'Nizamnamə və qeydiyyat', 'VERIFIED'),
      document(applicationId, 'TAX', 'Mənfəət vergisi bəyannaməsi 2024-2025', 'VERIFIED'),
      document(applicationId, 'TAX', 'ƏDV bəyannamələri', 'VERIFIED'),
      document(applicationId, 'BANK_STATEMENT', 'Bank çıxarışı (24 ay)', 'VERIFIED'),
      document(applicationId, 'FINANCIAL_STATEMENT', 'Auditə keçmiş maliyyə hesabatları', 'VERIFIED'),
      document(applicationId, 'INVENTORY_LIST', 'Anbar uçot çıxarışı (ERP)', 'VERIFIED'),
      document(applicationId, 'RECEIVABLE_LIST', 'Debitor yaşlandırma hesabatı', 'VERIFIED'),
      document(applicationId, 'PAYABLE_LIST', 'Kreditor yaşlandırma hesabatı', 'VERIFIED'),
      document(applicationId, 'CONTRACT', 'Avadanlıq alqı-satqı müqaviləsi', 'VERIFIED'),
      document(applicationId, 'INVOICE', 'Proforma invoys', 'VERIFIED'),
      document(applicationId, 'COLLATERAL', 'Daşınmaz əmlak çıxarışı', 'VERIFIED'),
      document(applicationId, 'VALUATION', 'Qiymətləndirmə hesabatı', 'VERIFIED'),
      document(applicationId, 'INSURANCE', 'Əmlak sığortası', 'VERIFIED'),
      document(applicationId, 'BUREAU_REPORT', 'AKB çıxarışları', 'VERIFIED'),
    ],
    periods: [p2024, p2025],
    balanceSheets: [bs2024, bs2025],
    incomeStatements: [is2024, is2025],
    cashFlows: [cf2025],
    adjustments: [],
    turnover: monthlyTurnover(p2025.id, monthsOfYear(2025), 1_176_000, 0, 0, 1_188_333, 1_188_000),
    businessAssessment: {
      applicationId,
      scorecardVersion: 'PROMETEIA_QUICK_WIN_V1',
      assessedBy: 'UW-002',
      assessedAt: '2026-07-23T09:00:00.000Z',
      answers: [
        { areaKey: 'RELATIONSHIP_VERIFICATION', dimensionKey: 'RELATIONSHIP_VERIFICATION', score: 3, justification: 'Bütün sənədlər tam və uzlaşan.', supportingDocuments: ['Nizamnamə', 'Vergi bəyannaməsi', 'Bank çıxarışı'] },
        { areaKey: 'STRUCTURE_AND_MANAGEMENT', dimensionKey: 'TRACK_RECORD', score: 3, justification: '14 il rəsmi fəaliyyət, peşəkar idarəetmə komandası.', supportingDocuments: [] },
        { areaKey: 'STRUCTURE_AND_MANAGEMENT', dimensionKey: 'BUSINESS_STRUCTURE', score: 3, justification: 'Müştəri bazası diversifikasiya olunub, ən böyük müştəri 18%.', supportingDocuments: [] },
        { areaKey: 'DOCUMENTATION_REPORTING', dimensionKey: 'DOCUMENTATION_REPORTING', score: 3, justification: 'ERP sistemi, audit olunmuş hesabatlar.', supportingDocuments: ['Audit hesabatı'] },
      ],
    },
    legacyAssessment: {
      applicationId,
      scorecardVersion: 'ATB_YEKUN_REY_V1',
      assessedBy: 'UW-002',
      assessedAt: '2026-07-23T10:00:00.000Z',
      answers: [
        { componentKey: 'AKB_EXTRACTS_OBTAINED', optionKey: 'YES', achievement: 1 },
        { componentKey: 'UNJUSTIFIED_RECENT_INQUIRIES', optionKey: 'NO', achievement: 1 },
        { componentKey: 'UNJUSTIFIED_DPD_0_30', optionKey: 'NO', achievement: 1 },
        { componentKey: 'UNJUSTIFIED_DPD_30_PLUS', optionKey: 'NO', achievement: 1 },
        { componentKey: 'REPAID_BY_INSTALMENTS', optionKey: 'YES', achievement: 1 },
        { componentKey: 'DEBT_BURDEN_INCREASE', optionKey: 'NO', achievement: 1 },
        { componentKey: 'BUSINESS_OWNERSHIP_LINK', achievement: 0.95 },
        { componentKey: 'STRUCTURE_AND_MANAGEMENT', achievement: 0.9 },
        { componentKey: 'DOCUMENTATION_REPORTING', achievement: 0.95 },
        { componentKey: 'BALANCE_SHEET', achievement: 0.9 },
        { componentKey: 'INCOME_STATEMENT', achievement: 0.9 },
        { componentKey: 'CASH_FLOWS', achievement: 0.85 },
        { componentKey: 'STATEMENT_COMPARISON', achievement: 0.85 },
        { componentKey: 'RATIOS', achievement: 0.9 },
        { componentKey: 'PURPOSE_DOCUMENTS', optionKey: 'PRESENT', achievement: 1 },
        { componentKey: 'PURPOSE_EFFICIENCY', optionKey: 'EFFICIENT', achievement: 1 },
        { componentKey: 'PURPOSE_CONTROL', optionKey: 'POSSIBLE', achievement: 1 },
        { componentKey: 'COLLATERAL_OWNER_RELATION', optionKey: 'YES', achievement: 1 },
        { componentKey: 'COLLATERAL_RISK_GRADE', optionKey: 'LOW', achievement: 1 },
        { componentKey: 'GUARANTOR_SUITABILITY', optionKey: 'SUITABLE', achievement: 1 },
      ],
    },
    workflowVersion: 'PROMETEIA_PROPOSED_V2',
    scorecardVersion: 'PROMETEIA_QUICK_WIN_V1',
    legacyScorecardVersion: 'ATB_YEKUN_REY_V1',
    policyVersion: 'ATB_POLICY_V1',
    policyExceptions: [],
    manualFindings: [],
    riskMitigants: [],
    covenants: [],
    conditions: [],
    underwriterRecommendation: {
      decision: 'APPROVE_WITH_CONDITIONS',
      recommendedAmount: 1_800_000,
      narrative:
        'Sifariş bütün maliyyə normalarını qarşılayır, məlumat bazası tam təsdiqlənib və investisiyanın iqtisadi səmərəsi hesablanıb. Avadanlığın girov kimi rəsmiləşdirilməsi şərti ilə təsdiq tövsiyə olunur.',
      preparedBy: 'UW-002',
      preparedAt: '2026-07-23T15:00:00.000Z',
    },
    pipeline: {
      receivedAt: '2026-07-21T09:00:00.000Z',
      assignedToUwAt: '2026-07-21T14:00:00.000Z',
      uwCompletedAt: '2026-07-23T15:00:00.000Z',
      committeeAt: '2026-07-25T10:00:00.000Z',
      returnCount: 0,
      missingDocuments: [],
    },
    auditTrail: [],
  };

  return { customer, application };
}

/* ================================================================== */
/* 4. Construction                                                     */
/* ================================================================== */

export function buildConstructionCase(): { customer: Customer; application: CreditApplication } {
  const customerId = id('cust');
  const applicationId = id('app');

  const customer: Customer = {
    id: customerId,
    legalName: '"Abşeron İnşaat Servis" MMC (demo)',
    displayName: 'Abşeron İnşaat Servis',
    customerType: 'LEGAL_ENTITY',
    legalForm: 'MMC',
    taxId: 'DEMO-1000000004',
    registrationDate: '2017-02-08',
    activityStartDate: '2017-02-08',
    officialActivityYears: 9,
    unofficialActivityYears: 0,
    address: 'Abşeron rayonu (demo ünvan)',
    region: 'Abşeron',
    sector: 'Tikinti',
    subSector: 'Sənaye və infrastruktur tikintisi',
    businessModel: 'Podrat müqavilələri əsasında sənaye obyektlərinin tikintisi; mərhələli ödəniş qrafiki.',
    products: ['Podrat tikinti', 'Təmir-bərpa işləri'],
    geography: 'Abşeron, Bakı',
    locations: 1,
    employees: 132,
    keyCustomers: [
      { name: 'Baş sifarişçi U', sharePct: 46 },
      { name: 'Sifarişçi V', sharePct: 28 },
    ],
    keySuppliers: [{ name: 'Tikinti materialları təchizatçısı W', sharePct: 52, paymentTerms: '60 gün' }],
    seasonality: 'Qış aylarında işlərin dayanması səbəbindən dövriyyə kəskin azalır.',
    seasonalityIndex: [0.4, 0.5, 0.9, 1.2, 1.3, 1.35, 1.35, 1.3, 1.25, 1.15, 0.85, 0.45],
    shareholders: [{ id: id('sh'), name: 'Təsisçi C (demo)', ownershipPct: 100, isUbo: true }],
    management: [
      { id: id('mg'), name: 'Baş direktor (demo)', role: 'Baş direktor', yearsInCompany: 9, yearsInSector: 19, isKeyPerson: true },
    ],
  };

  const p2024 = period(applicationId, '2024', 2024, 'HISTORICAL', '2024-01-01', '2024-12-31', 12);
  const p2025 = period(applicationId, '2025', 2025, 'HISTORICAL', '2025-01-01', '2025-12-31', 12, true);

  const bs2024 = balance(p2024.id, {
    cash: 180_000,
    receivables: 2_640_000,
    inventory: 890_000,
    fixedAssets: 1_960_000,
    shortTermBankDebt: 1_180_000,
    payables: 2_240_000,
    longTermBankDebt: 340_000,
    shareCapital: 300_000,
  });
  const bs2025 = balance(p2025.id, {
    cash: 96_000,
    receivables: 3_480_000,
    inventory: 1_020_000,
    fixedAssets: 2_140_000,
    shortTermBankDebt: 1_820_000,
    payables: 2_910_000,
    longTermBankDebt: 280_000,
    shareCapital: 300_000,
    evidence: { receivables: ['CUSTOMER_DOCUMENT', 'PARTIALLY_VERIFIED'] },
  });

  const is2024 = income(p2024.id, { sales: 8_640_000, cogs: 7_128_000, operatingExpenses: 890_000, depreciation: 210_000, interestExpense: 248_000, tax: 62_000 });
  const is2025 = income(p2025.id, { sales: 7_920_000, cogs: 6_732_000, operatingExpenses: 940_000, depreciation: 228_000, interestExpense: 312_000, tax: 38_000 });

  const cf2025 = cashFlow(p2025.id, {
    openingCash: 180_000,
    customerReceipts: 7_080_000,
    supplierPayments: 6_062_000,
    payroll: 640_000,
    rent: 60_000,
    taxPaid: 38_000,
    otherOperatingExpenses: 240_000,
    capex: 408_000,
    newBorrowing: 900_000,
    principalRepaid: 344_000,
    interestPaid: 312_000,
  });

  const facilities = [
    facility({ lender: 'Azər-Türk Bank', originalAmount: 1_200_000, outstanding: 820_000, issueDate: '2024-06-14', maturityDate: '2027-06-14', monthlyPayment: 44_200, collateralised: true, maxDpd: 14 }),
    facility({ lender: 'Bank M (demo)', originalAmount: 1_400_000, outstanding: 1_280_000, issueDate: '2025-09-30', maturityDate: '2028-09-30', monthlyPayment: 58_900, maxDpd: 22 }),
  ];

  const report = bureauReport(applicationId, 'Abşeron İnşaat Servis', '2026-07-25', 452, facilities, {
    individualBureauRating: 'MEDIUM',
    inquiries: [{ id: id('inq'), date: '2026-07-10', institution: 'Bank N (demo)', purpose: 'Biznes krediti', resultedInLoan: false }],
  });

  const application: CreditApplication = {
    id: applicationId,
    reference: 'KOB-2026-07-0171',
    customerId,
    applicationDate: '2026-07-26',
    branch: 'Abşeron filialı',
    rm: 'RM-031',
    channel: 'BRANCH',
    stage: 'SME_CENTER_ANALYSIS',
    requestedStructure: {
      amount: 900_000,
      currency: 'AZN',
      tenorMonths: 24,
      gracePeriodMonths: 4,
      annualRatePct: 18,
      commissionPct: 0.5,
      repaymentFrequency: 'MONTHLY',
      amortisation: 'ANNUITY',
      product: 'WORKING_CAPITAL_LOAN',
    },
    purposeSummary: 'Podrat müqaviləsi üzrə material alışının maliyyələşdirilməsi.',
    purposeLines: [
      purposeLine('INVENTORY', 'Tikinti materiallarının alışı (podrat müqaviləsi üzrə)', 700_000, 'VERIFIED', 'Müqavilə üzrə işlərin qrafikə uyğun icrası', 'Material alışı birbaşa təchizatçıya ödənilir', { evidenceDocument: 'Podrat müqaviləsi (demo)' }),
      purposeLine('WORKING_CAPITAL', 'Əmək haqqı və cari xərclər', 200_000, 'PARTIALLY_VERIFIED', 'İşçi qüvvəsinin saxlanması', 'Əmək haqqı layihəsi üzrə köçürmə'),
    ],
    primaryRepaymentSource: 'Podrat müqavilələri üzrə mərhələli ödənişlər',
    secondaryRepaymentSource: 'Texnika girovu',
    groupMembers: [groupMember('Abşeron İnşaat Servis MMC', 'SELF', 820_000, 1_280_000, { requestedExposure: 900_000 })],
    bureauReports: [report],
    collateral: [
      collateralItem({ type: 'EQUIPMENT', description: 'Tikinti texnikası (ekskavator, kran)', ownerName: 'Abşeron İnşaat Servis MMC', ownerRelationship: 'SELF', marketValue: 1_480_000, forcedSaleValue: 1_036_000, existingLienAmount: 820_000 }),
      collateralItem({ type: 'RECEIVABLES', description: 'Podrat müqaviləsi üzrə debitor borclarının girovu', ownerName: 'Abşeron İnşaat Servis MMC', ownerRelationship: 'SELF', marketValue: 1_600_000, forcedSaleValue: 960_000, evidence: 'PARTIALLY_VERIFIED' }),
    ],
    documents: [
      document(applicationId, 'LEGAL', 'Nizamnamə', 'VERIFIED'),
      document(applicationId, 'TAX', 'Vergi bəyannaməsi 2025', 'VERIFIED'),
      document(applicationId, 'BANK_STATEMENT', 'Bank çıxarışı', 'VERIFIED'),
      document(applicationId, 'CONTRACT', 'Podrat müqaviləsi', 'VERIFIED'),
      document(applicationId, 'RECEIVABLE_LIST', 'Debitor siyahısı', 'PARTIALLY_VERIFIED'),
      document(applicationId, 'INVENTORY_LIST', 'Material qalığı', 'PARTIALLY_VERIFIED'),
      document(applicationId, 'PAYABLE_LIST', 'Kreditor siyahısı', 'VERBAL'),
      document(applicationId, 'VALUATION', 'Texnika qiymətləndirməsi', 'VERIFIED'),
      document(applicationId, 'BUREAU_REPORT', 'AKB çıxarışı', 'VERIFIED'),
    ],
    periods: [p2024, p2025],
    balanceSheets: [bs2024, bs2025],
    incomeStatements: [is2024, is2025],
    cashFlows: [cf2025],
    adjustments: [],
    turnover: monthlyTurnover(p2025.id, monthsOfYear(2025), 590_000, 0, 0, 660_000, 640_000),
    businessAssessment: {
      applicationId,
      scorecardVersion: 'PROMETEIA_QUICK_WIN_V1',
      assessedBy: 'RM-031',
      assessedAt: '2026-07-27T09:00:00.000Z',
      answers: [
        { areaKey: 'RELATIONSHIP_VERIFICATION', dimensionKey: 'RELATIONSHIP_VERIFICATION', score: 3, justification: 'Podrat müqavilələri və bank dövriyyəsi uzlaşır.', supportingDocuments: ['Podrat müqaviləsi'] },
        { areaKey: 'STRUCTURE_AND_MANAGEMENT', dimensionKey: 'TRACK_RECORD', score: 2, justification: '9 il fəaliyyət, lakin idarəetmə bir şəxsə bağlıdır.', supportingDocuments: [] },
        { areaKey: 'STRUCTURE_AND_MANAGEMENT', dimensionKey: 'BUSINESS_STRUCTURE', score: 1, justification: 'İki sifarişçi dövriyyənin 74%-ni təşkil edir; təchizatçı konsentrasiyası 52%.', supportingDocuments: [] },
        { areaKey: 'DOCUMENTATION_REPORTING', dimensionKey: 'DOCUMENTATION_REPORTING', score: 2, justification: 'Uçot aparılır, lakin kreditor borcları şifahi məlumata əsaslanır.', supportingDocuments: [] },
      ],
    },
    legacyAssessment: {
      applicationId,
      scorecardVersion: 'ATB_YEKUN_REY_V1',
      assessedBy: 'RM-031',
      assessedAt: '2026-07-27T10:00:00.000Z',
      answers: [
        { componentKey: 'AKB_EXTRACTS_OBTAINED', optionKey: 'YES', achievement: 1 },
        { componentKey: 'UNJUSTIFIED_RECENT_INQUIRIES', optionKey: 'NO', achievement: 1 },
        { componentKey: 'UNJUSTIFIED_DPD_0_30', optionKey: 'YES', achievement: 0 },
        { componentKey: 'UNJUSTIFIED_DPD_30_PLUS', optionKey: 'NO', achievement: 1 },
        { componentKey: 'REPAID_BY_INSTALMENTS', optionKey: 'YES', achievement: 1 },
        { componentKey: 'DEBT_BURDEN_INCREASE', optionKey: 'YES', achievement: 0 },
        { componentKey: 'BUSINESS_OWNERSHIP_LINK', achievement: 0.8 },
        { componentKey: 'STRUCTURE_AND_MANAGEMENT', achievement: 0.55 },
        { componentKey: 'DOCUMENTATION_REPORTING', achievement: 0.6 },
        { componentKey: 'BALANCE_SHEET', achievement: 0.5 },
        { componentKey: 'INCOME_STATEMENT', achievement: 0.55 },
        { componentKey: 'CASH_FLOWS', achievement: 0.4 },
        { componentKey: 'STATEMENT_COMPARISON', achievement: 0.45 },
        { componentKey: 'RATIOS', achievement: 0.4 },
        { componentKey: 'PURPOSE_DOCUMENTS', optionKey: 'PRESENT', achievement: 1 },
        { componentKey: 'PURPOSE_EFFICIENCY', optionKey: 'PARTIAL', achievement: 0.5 },
        { componentKey: 'PURPOSE_CONTROL', optionKey: 'POSSIBLE', achievement: 1 },
        { componentKey: 'COLLATERAL_OWNER_RELATION', optionKey: 'NO', achievement: 0 },
        { componentKey: 'COLLATERAL_RISK_GRADE', optionKey: 'MEDIUM', achievement: 0.5 },
        { componentKey: 'GUARANTOR_SUITABILITY', optionKey: 'UNSUITABLE', achievement: 0 },
      ],
    },
    workflowVersion: 'PROMETEIA_PROPOSED_V2',
    scorecardVersion: 'PROMETEIA_QUICK_WIN_V1',
    legacyScorecardVersion: 'ATB_YEKUN_REY_V1',
    policyVersion: 'ATB_POLICY_V1',
    policyExceptions: [],
    manualFindings: [],
    riskMitigants: [],
    covenants: [],
    conditions: [],
    pipeline: { receivedAt: '2026-07-26T10:00:00.000Z', returnCount: 0, missingDocuments: ['Kreditor borcları siyahısı'] },
    auditTrail: [],
  };

  return { customer, application };
}

/* ================================================================== */
/* 5. Agriculture                                                      */
/* ================================================================== */

export function buildAgricultureCase(): { customer: Customer; application: CreditApplication } {
  const customerId = id('cust');
  const applicationId = id('app');

  const customer: Customer = {
    id: customerId,
    legalName: 'Fərdi sahibkar "Mil-Muğan Aqro" (demo)',
    displayName: 'Mil-Muğan Aqro',
    customerType: 'INDIVIDUAL_ENTREPRENEUR',
    legalForm: 'FST',
    taxId: 'DEMO-1000000005',
    registrationDate: '2019-11-12',
    activityStartDate: '2013-03-01',
    officialActivityYears: 6,
    unofficialActivityYears: 13,
    address: 'Mil-Muğan bölgəsi (demo ünvan)',
    region: 'Aran',
    sector: 'Kənd təsərrüfatı',
    subSector: 'Bitkiçilik və heyvandarlıq (qarışıq)',
    businessModel: 'Taxıl və yonca əkini, cavan mal-qaranın kökəldilməsi və satışı.',
    products: ['Buğda', 'Yonca', 'Ət (diri çəki)', 'Süd'],
    geography: 'Aran bölgəsi',
    locations: 1,
    employees: 14,
    keyCustomers: [
      { name: 'Ət emalı müəssisəsi Y', sharePct: 42 },
      { name: 'Taxıl alıcısı Z', sharePct: 33 },
    ],
    keySuppliers: [{ name: 'Toxum və gübrə təchizatçısı', sharePct: 60, paymentTerms: 'Məhsul yığımından sonra' }],
    seasonality: 'Gəlir iyun-iyul (taxıl) və oktyabr-dekabr (heyvandarlıq) aylarında cəmlənir.',
    seasonalityIndex: [0.3, 0.3, 0.4, 0.5, 0.8, 2.6, 2.4, 0.8, 0.7, 1.4, 1.4, 0.9],
    shareholders: [{ id: id('sh'), name: 'Sahibkar (demo)', ownershipPct: 100, isUbo: true }],
    management: [{ id: id('mg'), name: 'Sahibkar (demo)', role: 'Təsərrüfat rəhbəri', yearsInCompany: 13, yearsInSector: 13, isKeyPerson: true }],
  };

  const p2024 = period(applicationId, '2024', 2024, 'HISTORICAL', '2024-01-01', '2024-12-31', 12);
  const p2025 = period(applicationId, '2025', 2025, 'HISTORICAL', '2025-01-01', '2025-12-31', 12, true);

  const bs2024 = balance(p2024.id, {
    cash: 68_000,
    receivables: 92_000,
    inventory: 540_000,
    fixedAssets: 1_180_000,
    shortTermBankDebt: 260_000,
    payables: 140_000,
    longTermBankDebt: 180_000,
    shareCapital: 200_000,
  });
  const bs2025 = balance(p2025.id, {
    cash: 54_000,
    receivables: 118_000,
    inventory: 624_000,
    fixedAssets: 1_240_000,
    shortTermBankDebt: 320_000,
    payables: 168_000,
    longTermBankDebt: 150_000,
    shareCapital: 200_000,
    evidence: { inventory: ['FIELD_VISIT', 'PARTIALLY_VERIFIED'] },
  });

  const is2024 = income(p2024.id, { sales: 1_320_000, cogs: 924_000, operatingExpenses: 168_000, depreciation: 96_000, interestExpense: 68_000, tax: 8_000 });
  const is2025 = income(p2025.id, { sales: 1_560_000, cogs: 1_022_000, operatingExpenses: 182_000, depreciation: 104_000, interestExpense: 74_000, tax: 9_000, evidence: { sales: ['FIELD_VISIT', 'PARTIALLY_VERIFIED'] } });

  const cf2025 = cashFlow(p2025.id, {
    openingCash: 68_000,
    customerReceipts: 1_540_000,
    supplierPayments: 1_010_000,
    payroll: 108_000,
    rent: 42_000,
    taxPaid: 9_000,
    otherOperatingExpenses: 64_000,
    capex: 164_000,
    ownerWithdrawal: 72_000,
    newBorrowing: 180_000,
    principalRepaid: 145_000,
    interestPaid: 74_000,
  });

  const facilities = [
    facility({ lender: 'Azər-Türk Bank', product: 'Aqro kredit', originalAmount: 400_000, outstanding: 290_000, issueDate: '2024-03-18', maturityDate: '2028-03-18', monthlyPayment: 7_200, collateralised: true }),
    facility({ lender: 'Bank O (demo)', product: 'Aqro kredit', originalAmount: 250_000, outstanding: 180_000, issueDate: '2025-02-20', maturityDate: '2029-02-20', monthlyPayment: 4_300 }),
  ];

  const report = bureauReport(applicationId, 'Mil-Muğan Aqro', '2026-07-28', 706, facilities, { individualBureauRating: 'GOOD' });

  const application: CreditApplication = {
    id: applicationId,
    reference: 'KOB-2026-07-0178',
    customerId,
    applicationDate: '2026-07-29',
    branch: 'Aran filialı',
    rm: 'RM-045',
    channel: 'BRANCH',
    stage: 'RM_SUBMITTED',
    requestedStructure: {
      amount: 280_000,
      currency: 'AZN',
      tenorMonths: 36,
      gracePeriodMonths: 8,
      annualRatePct: 16,
      commissionPct: 0.3,
      repaymentFrequency: 'SEASONAL',
      amortisation: 'SEASONAL',
      product: 'AGRO_LOAN',
    },
    purposeSummary: 'Cavan mal-qaranın alınması və yem ehtiyatının yaradılması.',
    purposeLines: [
      purposeLine('INVENTORY', '120 baş cavan mal-qaranın alınması', 210_000, 'PARTIALLY_VERIFIED', 'Kökəltmə dövrü sonunda diri çəki satışından gəlir', 'Baytarlıq sənədləri və birka nömrələri üzrə monitorinq'),
      purposeLine('WORKING_CAPITAL', 'Yem və baytarlıq xərcləri', 70_000, 'PARTIALLY_VERIFIED', 'Kökəltmə prosesinin fasiləsizliyi', 'Alış qaimələri'),
    ],
    primaryRepaymentSource: 'Taxıl və diri çəki satışından mövsümi daxilolmalar',
    secondaryRepaymentSource: 'Kənd təsərrüfatı texnikası və torpaq sahəsi',
    groupMembers: [groupMember('Mil-Muğan Aqro (demo)', 'SELF', 290_000, 180_000, { requestedExposure: 280_000 })],
    bureauReports: [report],
    collateral: [
      collateralItem({ type: 'REAL_ESTATE_LAND', description: 'Kənd təsərrüfatı təyinatlı torpaq sahəsi, 84 ha', ownerName: 'Sahibkar (demo)', marketValue: 840_000, forcedSaleValue: 588_000, existingLienAmount: 290_000 }),
      collateralItem({ type: 'EQUIPMENT', description: 'Traktor və kombayn', ownerName: 'Sahibkar (demo)', marketValue: 320_000, forcedSaleValue: 224_000 }),
    ],
    documents: [
      document(applicationId, 'LEGAL', 'Sahibkar qeydiyyatı', 'VERIFIED'),
      document(applicationId, 'TAX', 'Vergi bəyannaməsi 2025', 'PARTIALLY_VERIFIED'),
      document(applicationId, 'BANK_STATEMENT', 'Bank çıxarışı', 'PARTIALLY_VERIFIED'),
      document(applicationId, 'INVENTORY_LIST', 'Mal-qara siyahısı (birka nömrələri ilə)', 'PARTIALLY_VERIFIED'),
      document(applicationId, 'CONTRACT', 'Ət emalı müəssisəsi ilə müqavilə', 'VERIFIED'),
      document(applicationId, 'COLLATERAL', 'Torpaq üzrə çıxarış', 'VERIFIED'),
      document(applicationId, 'BUREAU_REPORT', 'AKB çıxarışı', 'VERIFIED'),
      document(applicationId, 'RECEIVABLE_LIST', 'Debitor siyahısı', 'MISSING', { received: false }),
    ],
    periods: [p2024, p2025],
    balanceSheets: [bs2024, bs2025],
    incomeStatements: [is2024, is2025],
    cashFlows: [cf2025],
    adjustments: [],
    turnover: monthlyTurnover(p2025.id, monthsOfYear(2025), 78_000, 0, 41_000, 121_667, 96_000),
    sectorData: {
      agriculture: {
        subType: 'LIVESTOCK',
        landHectares: 84,
        crops: [
          { crop: 'Buğda', hectares: 52, yieldPerHectare: 28, normYieldPerHectare: 30, pricePerUnit: 420, unit: 'ton', costPerHectare: 604.5 },
          { crop: 'Yonca', hectares: 32, yieldPerHectare: 640, normYieldPerHectare: 700, pricePerUnit: 1.14, unit: 'top', costPerHectare: 380 },
        ],
        livestock: { opening: 186, births: 42, purchases: 60, sales: 74, mortality: 6, closing: 208, avgUnitValue: 1_780 },
        feed: { opening: 320, produced: 1_240, purchased: 180, consumed: 1_460, closing: 280, unit: 'ton' },
      },
    },
    businessAssessment: {
      applicationId,
      scorecardVersion: 'PROMETEIA_QUICK_WIN_V1',
      assessedBy: 'RM-045',
      assessedAt: '2026-07-30T09:00:00.000Z',
      answers: [
        { areaKey: 'RELATIONSHIP_VERIFICATION', dimensionKey: 'RELATIONSHIP_VERIFICATION', score: 3, justification: 'Torpaq mülkiyyəti, birka nömrələri və emal müəssisəsi ilə müqavilə uzlaşır.', supportingDocuments: ['Torpaq çıxarışı', 'Müqavilə'] },
        { areaKey: 'STRUCTURE_AND_MANAGEMENT', dimensionKey: 'TRACK_RECORD', score: 3, justification: '13 il təsərrüfat təcrübəsi.', supportingDocuments: [] },
        { areaKey: 'STRUCTURE_AND_MANAGEMENT', dimensionKey: 'BUSINESS_STRUCTURE', score: 2, justification: 'İki alıcı dövriyyənin 75%-ni təşkil edir; mövsümilik yüksəkdir.', supportingDocuments: [] },
        { areaKey: 'DOCUMENTATION_REPORTING', dimensionKey: 'DOCUMENTATION_REPORTING', score: 2, justification: 'Mal-qara uçotu aparılır, maliyyə uçotu sadədir.', supportingDocuments: [] },
      ],
    },
    legacyAssessment: {
      applicationId,
      scorecardVersion: 'ATB_YEKUN_REY_V1',
      assessedBy: 'RM-045',
      assessedAt: '2026-07-30T10:00:00.000Z',
      answers: [
        { componentKey: 'AKB_EXTRACTS_OBTAINED', optionKey: 'YES', achievement: 1 },
        { componentKey: 'UNJUSTIFIED_RECENT_INQUIRIES', optionKey: 'NO', achievement: 1 },
        { componentKey: 'UNJUSTIFIED_DPD_0_30', optionKey: 'NO', achievement: 1 },
        { componentKey: 'UNJUSTIFIED_DPD_30_PLUS', optionKey: 'NO', achievement: 1 },
        { componentKey: 'REPAID_BY_INSTALMENTS', optionKey: 'YES', achievement: 1 },
        { componentKey: 'DEBT_BURDEN_INCREASE', optionKey: 'NO', achievement: 1 },
        { componentKey: 'BUSINESS_OWNERSHIP_LINK', achievement: 0.85 },
        { componentKey: 'STRUCTURE_AND_MANAGEMENT', achievement: 0.75 },
        { componentKey: 'DOCUMENTATION_REPORTING', achievement: 0.6 },
        { componentKey: 'BALANCE_SHEET', achievement: 0.65 },
        { componentKey: 'INCOME_STATEMENT', achievement: 0.6 },
        { componentKey: 'CASH_FLOWS', achievement: 0.6 },
        { componentKey: 'STATEMENT_COMPARISON', achievement: 0.55 },
        { componentKey: 'RATIOS', achievement: 0.6 },
        { componentKey: 'PURPOSE_DOCUMENTS', optionKey: 'PARTIAL', achievement: 0.5 },
        { componentKey: 'PURPOSE_EFFICIENCY', optionKey: 'EFFICIENT', achievement: 1 },
        { componentKey: 'PURPOSE_CONTROL', optionKey: 'POSSIBLE', achievement: 1 },
        { componentKey: 'COLLATERAL_OWNER_RELATION', optionKey: 'YES', achievement: 1 },
        { componentKey: 'COLLATERAL_RISK_GRADE', optionKey: 'MEDIUM', achievement: 0.5 },
        { componentKey: 'GUARANTOR_SUITABILITY', optionKey: 'PARTIAL', achievement: 0.5 },
      ],
    },
    workflowVersion: 'PROMETEIA_PROPOSED_V2',
    scorecardVersion: 'PROMETEIA_QUICK_WIN_V1',
    legacyScorecardVersion: 'ATB_YEKUN_REY_V1',
    policyVersion: 'ATB_POLICY_V1',
    policyExceptions: [],
    manualFindings: [],
    riskMitigants: [],
    covenants: [],
    conditions: [],
    pipeline: { receivedAt: '2026-07-29T14:00:00.000Z', returnCount: 0, missingDocuments: ['Debitor siyahısı'] },
    auditTrail: [],
  };

  return { customer, application };
}
