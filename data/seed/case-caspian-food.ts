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
 * Demo case 1 (§78) — Xəzər Ərzaq Distribusiya MMC.
 *
 * Risk shape: revenue grows strongly, EBITDA grows more slowly, receivables
 * and inventory balloon, debt rises and operating cash flow weakens. The
 * borrower looks profitable on paper while cash conversion deteriorates —
 * exactly the pattern the cross-check and repayment-capacity engines exist to
 * surface. All identifiers are synthetic.
 */

export function buildCaspianFoodCase(): { customer: Customer; application: CreditApplication } {
  const customerId = id('cust');
  const applicationId = id('app');

  const customer: Customer = {
    id: customerId,
    legalName: '"Xəzər Ərzaq Distribusiya" MMC',
    displayName: 'Xəzər Ərzaq Distribusiya',
    customerType: 'LEGAL_ENTITY',
    legalForm: 'MMC',
    taxId: 'DEMO-1000000001',
    registrationDate: '2016-03-14',
    activityStartDate: '2014-09-01',
    officialActivityYears: 10,
    unofficialActivityYears: 12,
    address: 'Bakı şəhəri, sənaye zonası (demo ünvan)',
    region: 'Bakı',
    sector: 'Topdan ticarət',
    subSector: 'Ərzaq məhsullarının distribusiyası',
    businessModel:
      'İstehsalçılardan ərzaq məhsullarının alınması və regional pərakəndə şəbəkələrə, market zəncirlərinə möhlətli satışı.',
    products: ['Quru ərzaq', 'Konservləşdirilmiş məhsullar', 'İçkilər', 'Şirniyyat'],
    geography: 'Bakı, Abşeron, Sumqayıt, Gəncə',
    locations: 3,
    employees: 64,
    keyCustomers: [
      { name: 'Regional market şəbəkəsi A', sharePct: 31 },
      { name: 'Regional market şəbəkəsi B', sharePct: 22 },
      { name: 'Topdan alıcı C', sharePct: 11 },
    ],
    keySuppliers: [
      { name: 'İstehsalçı X', sharePct: 38, paymentTerms: '30 gün möhlət' },
      { name: 'İdxalatçı Y', sharePct: 25, paymentTerms: 'Qabaqcadan ödəniş' },
    ],
    seasonality: 'Payız-qış aylarında satış artımı, yay aylarında 15-20% enmə.',
    seasonalityIndex: [1.0, 0.95, 1.0, 1.02, 1.0, 0.85, 0.8, 0.85, 1.05, 1.15, 1.15, 1.18],
    shareholders: [
      { id: id('sh'), name: 'Təsisçi 1 (demo)', ownershipPct: 70, isUbo: true, otherBusinesses: ['Nəqliyyat MMC (demo)'] },
      { id: id('sh'), name: 'Təsisçi 2 (demo)', ownershipPct: 30, isUbo: false },
    ],
    management: [
      {
        id: id('mg'),
        name: 'Baş direktor (demo)',
        role: 'Baş direktor',
        yearsInCompany: 10,
        yearsInSector: 16,
        isKeyPerson: true,
        note: 'Bütün əsas müştəri münasibətləri bu şəxs üzərində cəmlənib.',
      },
      {
        id: id('mg'),
        name: 'Maliyyə meneceri (demo)',
        role: 'Maliyyə meneceri',
        yearsInCompany: 3,
        yearsInSector: 7,
        isKeyPerson: false,
      },
    ],
    existingAtbCustomerSince: '2019-05-20',
  };

  /* ---------------- Periods ---------------- */
  const p2023 = period(applicationId, '2023', 2023, 'HISTORICAL', '2023-01-01', '2023-12-31', 12);
  const p2024 = period(applicationId, '2024', 2024, 'HISTORICAL', '2024-01-01', '2024-12-31', 12);
  const p2025 = period(applicationId, '2025', 2025, 'HISTORICAL', '2025-01-01', '2025-12-31', 12, true);
  const p2026 = period(applicationId, '2026 YTD (6 ay)', 2026, 'YTD', '2026-01-01', '2026-06-30', 6);

  /* ---------------- Balance sheets ----------------
   * Receivables and inventory climb far faster than sales; the funding gap
   * is plugged with short-term bank debt and supplier credit.
   */
  const bs2023 = balance(p2023.id, {
    cash: 410_000,
    receivables: 1_980_000,
    inventory: 2_340_000,
    fixedAssets: 1_620_000,
    shortTermBankDebt: 1_450_000,
    payables: 1_760_000,
    longTermBankDebt: 620_000,
    shareCapital: 500_000,
    ownerContributions: 0,
    ownerWithdrawals: 0,
  });

  const bs2024 = balance(p2024.id, {
    cash: 362_000,
    receivables: 3_120_000,
    inventory: 3_180_000,
    fixedAssets: 1_840_000,
    shortTermBankDebt: 2_640_000,
    payables: 2_310_000,
    longTermBankDebt: 520_000,
    shareCapital: 500_000,
    ownerContributions: 0,
    ownerWithdrawals: 0,
  });

  const bs2025 = balance(p2025.id, {
    cash: 268_000,
    receivables: 4_760_000,
    inventory: 4_120_000,
    otherCurrentAssets: 180_000,
    fixedAssets: 2_060_000,
    shortTermBankDebt: 3_700_000,
    payables: 2_980_000,
    otherCurrentLiabilities: 240_000,
    longTermBankDebt: 410_000,
    shareCapital: 500_000,
    ownerContributions: 0,
    ownerWithdrawals: 220_000,
    evidence: {
      receivables: ['CUSTOMER_DOCUMENT', 'PARTIALLY_VERIFIED'],
      inventory: ['CUSTOMER_VERBAL', 'VERBAL'],
      payables: ['CUSTOMER_VERBAL', 'VERBAL'],
      cash: ['BANK_STATEMENT', 'VERIFIED'],
      shortTermBankDebt: ['CREDIT_BUREAU', 'VERIFIED'],
    },
  });

  const bs2026 = balance(p2026.id, {
    cash: 214_000,
    receivables: 5_420_000,
    inventory: 4_460_000,
    otherCurrentAssets: 160_000,
    fixedAssets: 2_010_000,
    shortTermBankDebt: 4_720_000,
    payables: 3_240_000,
    otherCurrentLiabilities: 210_000,
    longTermBankDebt: 350_000,
    shareCapital: 500_000,
    ownerWithdrawals: 140_000,
    evidence: {
      inventory: ['CUSTOMER_VERBAL', 'VERBAL'],
      payables: ['CUSTOMER_VERBAL', 'VERBAL'],
    },
  });

  /* ---------------- Income statements ---------------- */
  const is2023 = income(p2023.id, {
    sales: 14_200_000,
    cogs: 11_786_000,
    operatingExpenses: 1_560_000,
    depreciation: 180_000,
    interestExpense: 296_000,
    tax: 74_000,
    evidence: { sales: ['TAX_AUTHORITY', 'VERIFIED'] },
  });

  const is2024 = income(p2024.id, {
    sales: 17_900_000,
    cogs: 15_036_000,
    operatingExpenses: 1_820_000,
    depreciation: 196_000,
    interestExpense: 428_000,
    tax: 92_000,
    evidence: { sales: ['TAX_AUTHORITY', 'VERIFIED'] },
  });

  const is2025 = income(p2025.id, {
    // Sales +32%, EBITDA only +14% — the margin-compression commentary.
    sales: 23_628_000,
    cogs: 20_190_000,
    operatingExpenses: 2_248_000,
    depreciation: 224_000,
    interestExpense: 712_000,
    otherIncome: 60_000,
    tax: 118_000,
    evidence: {
      sales: ['TAX_AUTHORITY', 'PARTIALLY_VERIFIED'],
      cogs: ['CUSTOMER_DOCUMENT', 'PARTIALLY_VERIFIED'],
      operatingExpenses: ['CUSTOMER_VERBAL', 'VERBAL'],
    },
  });

  const is2026 = income(p2026.id, {
    sales: 12_640_000,
    cogs: 10_860_000,
    operatingExpenses: 1_120_000,
    depreciation: 112_000,
    interestExpense: 402_000,
    tax: 58_000,
  });

  /* ---------------- Cash flows ----------------
   * Receipts lag sales badly: the receivable build-up is real cash the
   * business never collected.
   */
  const cf2024 = cashFlow(p2024.id, {
    openingCash: 410_000,
    customerReceipts: 16_760_000,
    supplierPayments: 14_486_000,
    payroll: 980_000,
    rent: 260_000,
    taxPaid: 92_000,
    otherOperatingExpenses: 580_000,
    capex: 416_000,
    newBorrowing: 1_620_000,
    principalRepaid: 480_000,
    interestPaid: 428_000,
  });

  const cf2025 = cashFlow(p2025.id, {
    openingCash: 362_000,
    // 23.6m of sales but only 21.9m collected — the 1.64m receivable build.
    customerReceipts: 21_988_000,
    supplierPayments: 19_356_000,
    payroll: 1_180_000,
    rent: 290_000,
    taxPaid: 118_000,
    otherOperatingExpenses: 620_000,
    capex: 440_000,
    ownerWithdrawal: 220_000,
    newBorrowing: 2_140_000,
    principalRepaid: 690_000,
    interestPaid: 712_000,
    evidence: {
      customerReceipts: ['BANK_STATEMENT', 'VERIFIED'],
      supplierPayments: ['BANK_STATEMENT', 'PARTIALLY_VERIFIED'],
      otherOperatingExpenses: ['CUSTOMER_VERBAL', 'VERBAL'],
    },
  });

  /* ---------------- Bureau ---------------- */
  const facilities = [
    facility({
      lender: 'Azər-Türk Bank',
      product: 'Dövriyyə vəsaiti krediti',
      originalAmount: 1_200_000,
      outstanding: 780_000,
      issueDate: '2024-04-15',
      maturityDate: '2027-04-15',
      monthlyPayment: 22_000,
      maxDpd: 6,
      collateralised: true,
    }),
    facility({
      lender: 'Bank B (demo)',
      product: 'Kredit xətti',
      originalAmount: 2_000_000,
      outstanding: 1_680_000,
      issueDate: '2025-02-10',
      maturityDate: '2027-02-10',
      monthlyPayment: 40_000,
      maxDpd: 18,
      dpd30PlusEvents: 0,
    }),
    facility({
      lender: 'Bank C (demo)',
      product: 'Dövriyyə krediti',
      originalAmount: 1_500_000,
      outstanding: 1_240_000,
      issueDate: '2025-08-22',
      maturityDate: '2028-08-22',
      monthlyPayment: 28_000,
      maxDpd: 4,
    }),
    facility({
      lender: 'Bank B (demo)',
      product: 'Dövriyyə krediti',
      originalAmount: 900_000,
      outstanding: 0,
      issueDate: '2023-01-20',
      maturityDate: '2026-01-20',
      monthlyPayment: 0,
      closureDate: '2025-02-05',
      earlyClosure: true,
      status: 'CLOSED',
      maxDpd: 12,
    }),
    facility({
      lender: 'Azər-Türk Bank',
      product: 'Avadanlıq krediti',
      originalAmount: 600_000,
      outstanding: 410_000,
      issueDate: '2023-11-08',
      maturityDate: '2028-11-08',
      monthlyPayment: 9_500,
      maxDpd: 0,
      collateralised: true,
    }),
  ];

  const report = bureauReport(applicationId, 'Xəzər Ərzaq Distribusiya', '2026-07-04', 612, facilities, {
    individualBureauRating: 'MEDIUM',
    inquiries: [
      { id: id('inq'), date: '2026-06-18', institution: 'Bank D (demo)', purpose: 'Biznes krediti', resultedInLoan: false },
      { id: id('inq'), date: '2026-05-29', institution: 'Bank E (demo)', purpose: 'Biznes krediti', resultedInLoan: false },
      { id: id('inq'), date: '2026-02-11', institution: 'Bank C (demo)', purpose: 'Biznes krediti', resultedInLoan: true },
    ],
  });

  const relatedReport = bureauReport(
    applicationId,
    'Təsisçi 1 (demo)',
    '2026-07-04',
    588,
    [
      facility({
        lender: 'Bank F (demo)',
        product: 'İstehlak krediti',
        originalAmount: 90_000,
        outstanding: 61_000,
        issueDate: '2025-03-12',
        maturityDate: '2028-03-12',
        monthlyPayment: 3_200,
        subjectName: 'Təsisçi 1 (demo)',
        maxDpd: 9,
      }),
    ],
    { individualBureauRating: 'MEDIUM' },
  );

  /* ---------------- Application ---------------- */
  const application: CreditApplication = {
    id: applicationId,
    reference: 'KOB-2026-07-0142',
    customerId,
    applicationDate: '2026-07-06',
    branch: 'Mərkəzi filial',
    rm: 'RM-014',
    underwriter: 'UW-003',
    channel: 'BRANCH',
    stage: 'UNDERWRITING',

    requestedStructure: {
      amount: 2_500_000,
      currency: 'AZN',
      tenorMonths: 36,
      gracePeriodMonths: 3,
      annualRatePct: 17.5,
      commissionPct: 0.5,
      repaymentFrequency: 'MONTHLY',
      amortisation: 'ANNUITY',
      product: 'WORKING_CAPITAL_LINE',
    },

    purposeSummary:
      'Dövriyyə vəsaitinin maliyyələşdirilməsi, mövcud qısamüddətli bank borcunun bir hissəsinin refinansmanı və anbar avadanlığının alınması.',
    purposeLines: [
      purposeLine(
        'INVENTORY',
        'Payız-qış mövsümü üçün mal ehtiyatının artırılması',
        1_100_000,
        'PARTIALLY_VERIFIED',
        'Mövsümi satış artımının maliyyələşdirilməsi, təchizatçıdan həcm endirimi',
        'Alış qaimələri və anbar uçotu üzrə rüblük monitorinq',
        { evidenceDocument: 'Təchizatçı ilə çərçivə müqaviləsi (demo)' },
      ),
      purposeLine(
        'REFINANCE_OTHER_BANK',
        'Bank C (demo) üzrə dövriyyə kreditinin bağlanması',
        900_000,
        'VERIFIED',
        'Faiz yükünün azaldılması və ödəniş qrafikinin uzadılması',
        'Bağlayıcı ödəniş birbaşa bank hesabına köçürülür',
        { evidenceDocument: 'Bank C arayışı (demo)' },
      ),
      purposeLine(
        'CAPEX',
        'Anbar rəf sistemi və yükləyici texnika',
        320_000,
        'PARTIALLY_VERIFIED',
        'Anbar dövriyyəsinin sürətlənməsi, itkilərin azalması',
        'Avadanlıq alqı-satqı müqaviləsi və qəbul aktı',
        {
          effectiveness: {
            investmentAmount: 400_000,
            ownContribution: 80_000,
            financedAmount: 320_000,
            additionalAnnualSales: 620_000,
            additionalAnnualEbitda: 94_000,
            annualCashBenefit: 78_000,
            paybackYears: 5.1,
          },
        },
      ),
      purposeLine(
        'WORKING_CAPITAL',
        'Ümumi dövriyyə vəsaiti ehtiyacı',
        180_000,
        'VERBAL',
        'Debitor borclarının maliyyələşdirilməsi',
        'Təyinat üzrə birbaşa nəzarət mümkün deyil',
      ),
    ],
    primaryRepaymentSource: 'Əsas fəaliyyətdən pul axını (topdan satış daxilolmaları)',
    secondaryRepaymentSource: 'Girov qoyulmuş kommersiya daşınmaz əmlakının realizasiyası',

    groupMembers: [
      groupMember('Xəzər Ərzaq Distribusiya MMC', 'SELF', 1_190_000, 2_920_000, { requestedExposure: 2_500_000 }),
      groupMember('Təsisçi 1 (demo)', 'SHAREHOLDER', 0, 61_000),
      groupMember('Nəqliyyat MMC (demo)', 'SISTER_COMPANY', 0, 340_000, {
        note: 'Eyni təsisçiyə məxsus nəqliyyat şirkəti — sifarişçiyə daşıma xidməti göstərir.',
      }),
    ],

    bureauReports: [report, relatedReport],

    collateral: [
      collateralItem({
        type: 'REAL_ESTATE_COMMERCIAL',
        description: 'Anbar kompleksi, 3.200 m² (demo obyekt)',
        ownerName: 'Xəzər Ərzaq Distribusiya MMC',
        ownerRelationship: 'SELF',
        marketValue: 2_900_000,
        forcedSaleValue: 2_180_000,
        existingLienAmount: 410_000,
        insuranceExpiry: '2027-03-01',
      }),
      collateralItem({
        type: 'REAL_ESTATE_RESIDENTIAL',
        description: 'Yaşayış mənzili, 148 m² (demo obyekt)',
        ownerName: 'Təsisçi 1 (demo)',
        ownerRelationship: 'SHAREHOLDER',
        marketValue: 420_000,
        forcedSaleValue: 315_000,
      }),
      collateralItem({
        type: 'INVENTORY',
        description: 'Anbardakı mal ehtiyatının dövriyyə girovu',
        ownerName: 'Xəzər Ərzaq Distribusiya MMC',
        ownerRelationship: 'SELF',
        marketValue: 1_200_000,
        forcedSaleValue: 720_000,
        evidence: 'VERBAL',
        registered: false,
      }),
      collateralItem({
        type: 'PERSONAL_GUARANTEE',
        description: 'Təsisçi 1 zaminliyi',
        ownerName: 'Təsisçi 1 (demo)',
        ownerRelationship: 'GUARANTOR',
        marketValue: 2_500_000,
        forcedSaleValue: 0,
        registered: true,
      }),
    ],

    documents: [
      document(applicationId, 'LEGAL', 'Nizamnamə və dövlət qeydiyyatı şəhadətnaməsi', 'VERIFIED'),
      document(applicationId, 'TAX', 'Mənfəət vergisi bəyannaməsi 2025', 'VERIFIED', { documentDate: '2026-03-28' }),
      document(applicationId, 'TAX', 'ƏDV bəyannamələri (12 ay)', 'PARTIALLY_VERIFIED'),
      document(applicationId, 'BANK_STATEMENT', 'Bank hesabından çıxarış (12 ay)', 'VERIFIED'),
      document(applicationId, 'FINANCIAL_STATEMENT', 'İdarəetmə balansı və MZH 2025', 'PARTIALLY_VERIFIED'),
      document(applicationId, 'INVENTORY_LIST', 'Anbar qalığı siyahısı', 'VERBAL', {
        relatedMetrics: ['inventory', 'inventoryDays'],
      }),
      document(applicationId, 'RECEIVABLE_LIST', 'Debitor borcları siyahısı (yaşlandırma ilə)', 'PARTIALLY_VERIFIED', {
        relatedMetrics: ['receivables', 'receivableDays'],
      }),
      document(applicationId, 'PAYABLE_LIST', 'Kreditor borcları siyahısı', 'MISSING', {
        received: false,
        relatedMetrics: ['payables', 'creditorDays'],
      }),
      document(applicationId, 'CONTRACT', 'Təchizatçı ilə çərçivə müqaviləsi', 'PARTIALLY_VERIFIED'),
      document(applicationId, 'COLLATERAL', 'Anbar kompleksi üzrə çıxarış', 'VERIFIED'),
      document(applicationId, 'VALUATION', 'Qiymətləndirmə hesabatı — anbar kompleksi', 'VERIFIED'),
      document(applicationId, 'INSURANCE', 'Sığorta polisi — anbar kompleksi', 'VERIFIED'),
      document(applicationId, 'BUREAU_REPORT', 'AKB çıxarışı — sifarişçi və təsisçilər', 'VERIFIED'),
    ],

    periods: [p2023, p2024, p2025, p2026],
    balanceSheets: [bs2023, bs2024, bs2025, bs2026],
    incomeStatements: [is2023, is2024, is2025, is2026],
    cashFlows: [cf2024, cf2025],
    adjustments: [
      {
        id: id('adj'),
        applicationId,
        periodId: p2025.id,
        target: 'BALANCE_SHEET',
        field: 'inventory',
        originalValue: 4_120_000,
        adjustedValue: 3_580_000,
        difference: -540_000,
        reason: 'UNSUPPORTED_INVENTORY',
        narrative:
          'Anbar siyahısında sənədlə təsdiqlənməyən və dövriyyəsi 360 gündən artıq olan mövqelər çıxarıldı.',
        evidence: 'ANALYST_ESTIMATE',
        analyst: 'UW-003',
        createdAt: '2026-07-09T11:20:00.000Z',
      },
      {
        id: id('adj'),
        applicationId,
        periodId: p2025.id,
        target: 'BALANCE_SHEET',
        field: 'receivables',
        originalValue: 4_760_000,
        adjustedValue: 4_280_000,
        difference: -480_000,
        reason: 'RECEIVABLE_HAIRCUT',
        narrative: '90 gündən artıq gecikmiş debitor borclarına 40% diskont tətbiq edildi.',
        evidence: 'ANALYST_ESTIMATE',
        analyst: 'UW-003',
        createdAt: '2026-07-09T11:35:00.000Z',
      },
    ],
    turnover: monthlyTurnover(p2025.id, monthsOfYear(2025), 1_460_000, 92_000, 280_000, 1_969_000, 1_720_000),

    businessAssessment: {
      applicationId,
      scorecardVersion: 'PROMETEIA_QUICK_WIN_V1',
      assessedBy: 'UW-003',
      assessedAt: '2026-07-09T12:00:00.000Z',
      answers: [
        {
          areaKey: 'RELATIONSHIP_VERIFICATION',
          dimensionKey: 'RELATIONSHIP_VERIFICATION',
          score: 3,
          justification:
            'VÖEN, qeydiyyat, anbar mülkiyyəti, bank dövriyyəsi və təchizatçı müqavilələri tam uzlaşır.',
          supportingDocuments: ['Nizamnamə', 'Bank çıxarışı', 'Təchizatçı müqaviləsi'],
        },
        {
          areaKey: 'STRUCTURE_AND_MANAGEMENT',
          dimensionKey: 'TRACK_RECORD',
          score: 3,
          justification: '10 il rəsmi fəaliyyət, rəhbərin 16 illik sektor təcrübəsi.',
          supportingDocuments: ['Qeydiyyat sənədi'],
        },
        {
          areaKey: 'STRUCTURE_AND_MANAGEMENT',
          dimensionKey: 'BUSINESS_STRUCTURE',
          score: 2,
          justification:
            'İlk iki müştəri satışın 53%-ni təşkil edir; qrupdaxili nəqliyyat şirkəti ilə əməliyyatlar mövcuddur.',
          supportingDocuments: ['Müştəri dövriyyə cədvəli'],
        },
        {
          areaKey: 'DOCUMENTATION_REPORTING',
          dimensionKey: 'DOCUMENTATION_REPORTING',
          score: 1,
          justification:
            'Anbar qalığı və kreditor borcları yalnız şifahi məlumata əsaslanır, kreditor siyahısı təqdim edilməyib.',
          supportingDocuments: [],
        },
      ],
    },

    legacyAssessment: {
      applicationId,
      scorecardVersion: 'ATB_YEKUN_REY_V1',
      assessedBy: 'UW-003',
      assessedAt: '2026-07-09T13:00:00.000Z',
      answers: [
        { componentKey: 'AKB_EXTRACTS_OBTAINED', optionKey: 'YES', achievement: 1 },
        { componentKey: 'UNJUSTIFIED_RECENT_INQUIRIES', optionKey: 'YES', achievement: 0, comment: 'Son 2 ayda iki bankdan nəticəsiz müraciət.' },
        { componentKey: 'UNJUSTIFIED_DPD_0_30', optionKey: 'YES', achievement: 0, comment: '18 günlük gecikmə izah edilməyib.' },
        { componentKey: 'UNJUSTIFIED_DPD_30_PLUS', optionKey: 'NO', achievement: 1 },
        { componentKey: 'REPAID_BY_INSTALMENTS', optionKey: 'NO', achievement: 0 },
        { componentKey: 'DEBT_BURDEN_INCREASE', optionKey: 'YES', achievement: 0 },

        { componentKey: 'BUSINESS_OWNERSHIP_LINK', achievement: 0.85 },
        { componentKey: 'STRUCTURE_AND_MANAGEMENT', achievement: 0.7 },
        { componentKey: 'DOCUMENTATION_REPORTING', achievement: 0.45 },

        { componentKey: 'BALANCE_SHEET', achievement: 0.55 },
        { componentKey: 'INCOME_STATEMENT', achievement: 0.6 },
        { componentKey: 'CASH_FLOWS', achievement: 0.45 },
        { componentKey: 'STATEMENT_COMPARISON', achievement: 0.4 },
        { componentKey: 'RATIOS', achievement: 0.5 },

        { componentKey: 'PURPOSE_DOCUMENTS', optionKey: 'PARTIAL', achievement: 0.5 },
        { componentKey: 'PURPOSE_EFFICIENCY', optionKey: 'PARTIAL', achievement: 0.5 },
        { componentKey: 'PURPOSE_CONTROL', optionKey: 'POSSIBLE', achievement: 1 },

        { componentKey: 'COLLATERAL_OWNER_RELATION', optionKey: 'YES', achievement: 1 },
        { componentKey: 'COLLATERAL_RISK_GRADE', optionKey: 'LOW', achievement: 1 },
        { componentKey: 'GUARANTOR_SUITABILITY', optionKey: 'PARTIAL', achievement: 0.5 },
      ],
    },

    workflowVersion: 'PROMETEIA_PROPOSED_V2',
    scorecardVersion: 'PROMETEIA_QUICK_WIN_V1',
    legacyScorecardVersion: 'ATB_YEKUN_REY_V1',
    policyVersion: 'ATB_POLICY_V1',

    policyExceptions: [],
    manualFindings: [],
    riskMitigants: [
      {
        id: id('rsk'),
        category: 'LIQUIDITY',
        severity: 'HIGH',
        description: 'Debitor borclarının sürətli artımı dövriyyə vəsaitini bağlayır və likvidliyi zəiflədir.',
        mitigant:
          'Debitor borclarının 90 gündən artıq hissəsinin rüblük hesabatla izlənməsi və limitin bu göstəriciyə bağlanması.',
        residualRisk: 'MEDIUM',
      },
      {
        id: id('rsk'),
        category: 'CONCENTRATION',
        severity: 'MEDIUM',
        description: 'İlk iki müştəri satışın 53%-ni təşkil edir.',
        mitigant: 'Bu müştərilərlə uzunmüddətli müqavilələrin təqdim edilməsi və debitor sığortası.',
        residualRisk: 'MEDIUM',
      },
      {
        id: id('rsk'),
        category: 'TRANSPARENCY',
        severity: 'HIGH',
        description: 'Anbar qalığı və kreditor borcları sənədlə təsdiqlənmir.',
        mitigant: 'Müstəqil anbar sayımı və kreditor siyahısının təqdim edilməsi şərt kimi qoyulur.',
        residualRisk: 'MEDIUM',
      },
    ],
    covenants: [],
    conditions: [],

    pipeline: {
      receivedAt: '2026-07-06T09:15:00.000Z',
      assignedToUwAt: '2026-07-07T10:00:00.000Z',
      uwCompletedAt: '2026-07-10T16:30:00.000Z',
      returnCount: 1,
      waitingReason: 'Kreditor borcları siyahısı gözlənilir',
      missingDocuments: ['Kreditor borcları siyahısı'],
    },
    auditTrail: [
      {
        id: id('aud'),
        applicationId,
        entity: 'FinancialAdjustment',
        field: 'inventory',
        oldValue: '4 120 000',
        newValue: '3 580 000',
        user: 'UW-003',
        role: 'UNDERWRITER',
        reason: 'Sənədlə təsdiqlənməyən mal qalığı çıxarıldı',
        timestamp: '2026-07-09T11:20:00.000Z',
        category: 'FINANCIAL_ADJUSTMENT',
      },
      {
        id: id('aud'),
        applicationId,
        entity: 'CreditApplication',
        field: 'stage',
        oldValue: 'RM_SUBMITTED',
        newValue: 'UNDERWRITING',
        user: 'UW-003',
        role: 'UNDERWRITER',
        timestamp: '2026-07-07T10:00:00.000Z',
        category: 'WORKFLOW',
      },
    ],
  };

  return { customer, application };
}
