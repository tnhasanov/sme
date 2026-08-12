import type { CreditApplication, Customer, Decision } from '@/types/application';
import type { Assessment } from '@/services/assessment';
import { AUTHORITY_LABEL_AZ } from '@/config/workflow';
import { GRADE_LABEL_AZ } from '@/config/rating';

/**
 * Underwriting opinion builder (§59).
 *
 * Produces a complete, structured first draft from the calculated data alone
 * — no language model is involved. The underwriter edits the draft; the
 * system never invents a fact it did not compute.
 */

export interface OpinionSection {
  key: string;
  titleAz: string;
  titleEn: string;
  paragraphs: string[];
  bullets?: string[];
}

export interface OpinionDraft {
  sections: OpinionSection[];
  positives: string[];
  negatives: string[];
  recommendation: {
    decision: Decision;
    recommendedAmount: number;
    rationale: string[];
    conditions: string[];
  };
}

const azn = (n: number | null | undefined) =>
  n === null || n === undefined || !Number.isFinite(n)
    ? '—'
    : `${new Intl.NumberFormat('az-AZ', { maximumFractionDigits: 0 }).format(Math.round(n))} AZN`;
const pct = (n: number | null | undefined, d = 1) =>
  n === null || n === undefined || !Number.isFinite(n) ? '—' : `${(n * 100).toFixed(d)}%`;
const x = (n: number | null | undefined) =>
  n === null || n === undefined ? '—' : Number.isFinite(n) ? `${n.toFixed(2)}x` : '∞';

export function buildOpinionDraft(
  app: CreditApplication,
  customer: Customer,
  a: Assessment,
): OpinionDraft {
  const structure = app.proposedStructure ?? app.requestedStructure;
  const sections: OpinionSection[] = [];

  const purposeTotal = app.purposeLines.reduce((s, p) => s + p.amount, 0) || app.requestedStructure.amount;
  const nonBusiness = app.purposeLines
    .filter((p) => p.category === 'PERSONAL_NON_BUSINESS')
    .reduce((s, p) => s + p.amount, 0);
  const refinancing = app.purposeLines
    .filter((p) => p.category === 'REFINANCE_ATB' || p.category === 'REFINANCE_OTHER_BANK')
    .reduce((s, p) => s + p.amount, 0);

  /* 1. Executive summary */
  sections.push({
    key: 'EXECUTIVE_SUMMARY',
    titleAz: 'İcmal',
    titleEn: 'Executive Summary',
    paragraphs: [
      `${customer.legalName} ${azn(app.requestedStructure.amount)} məbləğində, ${app.requestedStructure.tenorMonths} ay müddətinə, ${app.requestedStructure.gracePeriodMonths} ay güzəşt dövrü ilə kredit üçün müraciət edib. Təyinat: ${app.purposeSummary}`,
      `Əməliyyatdan sonrakı qrup ekspozisiyası ${azn(a.groupExposure.postTransactionGroupExposure)} təşkil edəcək, bu da sifarişi ${a.rating.segment === 'MEDIUM' ? 'Orta (İri)' : 'Kiçik'} seqmentə aid edir. AKB reytinqi ${a.bureauRating.grade ? GRADE_LABEL_AZ[a.bureauRating.grade] : 'təyin edilməyib'}, yekun daxili reytinq ${a.rating.finalGradeLabelAz}.`,
      a.activeStopFactors.length > 0
        ? `Sifariş üzrə ${a.activeStopFactors.length} stop faktor aşkarlanıb: ${a.activeStopFactors.map((s) => s.rule.labelAz).join('; ')}.`
        : 'Sifariş üzrə stop faktor aşkarlanmayıb.',
    ],
  });

  /* 2-4. Borrower, ownership, business */
  sections.push({
    key: 'BORROWER',
    titleAz: 'Borcalan və mülkiyyət',
    titleEn: 'Borrower and Ownership',
    paragraphs: [
      `${customer.legalName} ${customer.registrationDate} tarixindən qeydiyyatdadır; rəsmi fəaliyyət müddəti ${customer.officialActivityYears} il, qeyri-rəsmi fəaliyyət müddəti ${customer.unofficialActivityYears} ildir.`,
      `Mülkiyyət strukturu: ${customer.shareholders.map((s) => `${s.name} — ${s.ownershipPct}%${s.isUbo ? ' (UBO)' : ''}`).join('; ')}.`,
      customer.management.some((m) => m.isKeyPerson)
        ? `İdarəetmə açar şəxsdən asılıdır: ${customer.management.filter((m) => m.isKeyPerson).map((m) => `${m.role} (${m.yearsInSector} il sektor təcrübəsi)`).join('; ')}.`
        : 'İdarəetmə komandası paylanmışdır, açar şəxs riski qeyd edilməyib.',
    ],
  });

  sections.push({
    key: 'BUSINESS',
    titleAz: 'Biznes fəaliyyəti',
    titleEn: 'Business',
    paragraphs: [
      customer.businessModel,
      `Fəaliyyət ${customer.locations} obyektdə aparılır, işçi sayı ${customer.employees} nəfərdir. Coğrafiya: ${customer.geography}.`,
      `Müştəri konsentrasiyası: ilk iki müştəri satışın ${pct(customer.keyCustomers.slice(0, 2).reduce((s, k) => s + k.sharePct, 0) / 100)} hissəsini təşkil edir. Təchizatçı konsentrasiyası: ${pct((customer.keySuppliers[0]?.sharePct ?? 0) / 100)}.`,
      `Mövsümilik: ${customer.seasonality}`,
    ],
  });

  /* 5. Loan request */
  sections.push({
    key: 'LOAN_REQUEST',
    titleAz: 'Kredit sifarişi',
    titleEn: 'Loan Request',
    paragraphs: [
      `Tələb olunan struktur: ${azn(app.requestedStructure.amount)}, ${app.requestedStructure.tenorMonths} ay, illik ${app.requestedStructure.annualRatePct}%, ${app.requestedStructure.repaymentFrequency} ödəniş, ${app.requestedStructure.amortisation} amortizasiya. Hesablanmış aylıq ödəniş ${azn(a.proposedMonthlyPayment)}.`,
      `Əsas ödəniş mənbəyi: ${app.primaryRepaymentSource}. Əlavə ödəniş mənbəyi: ${app.secondaryRepaymentSource}.`,
    ],
  });

  /* 6. Credit history */
  sections.push({
    key: 'CREDIT_HISTORY',
    titleAz: 'Kredit tarixçəsi (AKB)',
    titleEn: 'Credit History',
    paragraphs: [
      `AKB üzrə cəmi aktiv borc ${azn(a.bureauSummary.totalDebt)} (ATB: ${azn(a.bureauSummary.atbDebt)}), aylıq borc xidməti ${azn(a.bureauSummary.monthlyDebtService)}. Aktiv kredit sayı ${a.bureauSummary.activeFacilityCount}, bağlanmış ${a.bureauSummary.closedFacilityCount}.`,
      `Maksimum tarixi gecikmə ${a.bureauSummary.historicMaxDpd} gün, cari gecikmə ${a.bureauSummary.currentMaxDpd} gün, 30+ gün hadisələrinin sayı ${a.bureauSummary.dpd30PlusEvents}.`,
      a.refinancing.instalmentRepaymentShare !== null
        ? `Əvvəlki kreditlərin ${pct(a.refinancing.instalmentRepaymentShare)} hissəsi aylıq ödənişlərlə bağlanıb (metodologiya norması >50%).`
        : 'Kredit tarixçəsi mövcud deyil.',
    ],
    bullets: a.refinancing.flags.map((f) => f.messageAz),
  });

  /* 7. Group exposure */
  sections.push({
    key: 'GROUP_EXPOSURE',
    titleAz: 'Qrup ekspozisiyası',
    titleEn: 'Group Exposure',
    paragraphs: [
      `Qrupa ${a.groupExposure.members.length} subyekt daxildir. Mövcud ekspozisiya ${azn(a.groupExposure.existingTotalExposure)} (ATB ${azn(a.groupExposure.existingAtbExposure)}, digər banklar ${azn(a.groupExposure.existingExternalExposure)}).`,
      `Tələb olunan məbləğ ${azn(a.groupExposure.requestedAmount)}, bağlanacaq borc ${azn(a.groupExposure.debtBeingRefinanced)}. Əməliyyatdan sonrakı qrup ekspozisiyası ${azn(a.groupExposure.postTransactionGroupExposure)}.`,
    ],
  });

  /* 8-11. Financials */
  sections.push({
    key: 'FINANCIAL_ANALYSIS',
    titleAz: 'Maliyyə təhlili',
    titleEn: 'Financial Analysis',
    paragraphs: [
      a.income
        ? `${a.primaryPeriod?.label} dövrü üzrə satış ${azn(a.income.sales)}, ümumi mənfəət ${azn(a.income.grossProfit)} (marja ${pct(a.income.grossMargin)}), EBITDA ${azn(a.income.ebitda)} (marja ${pct(a.income.ebitdaMargin)}), xalis mənfəət ${azn(a.income.netProfit)}.`
        : 'Maliyyə hesabatları daxil edilməyib.',
      a.balance
        ? `Cəmi aktivlər ${azn(a.balance.totalAssets)}, cəmi öhdəliklər ${azn(a.balance.totalLiabilities)}, şəxsi kapital ${azn(a.balance.totalEquity)}. İşlək kapital ${azn(a.balance.workingCapital)}, bank öhdəlikləri ${azn(a.balance.totalBankDebt)}.`
        : '',
      `Əsas əmsallar: cari likvidlik ${x(a.ratios.currentRatio?.value)}, kapitala nəzərən borclanma ${x(a.ratios.debtToEquityInclNew?.value)}, borc/EBITDA ${x(a.ratios.debtToEbitda?.value)}, debitor günləri ${a.ratios.receivableDays?.value?.toFixed(0) ?? '—'}, ehtiyat günləri ${a.ratios.inventoryDays?.value?.toFixed(0) ?? '—'}.`,
    ].filter(Boolean),
    bullets: a.commentary,
  });

  sections.push({
    key: 'CASH_FLOW',
    titleAz: 'Pul axını və ödəmə qabiliyyəti',
    titleEn: 'Cash Flow and Repayment Capacity',
    paragraphs: [
      a.repayment
        ? `Borc xidmətinə hazır aylıq pul axını (CFADS) ${azn(a.repayment.cfads)}, əməliyyatdan sonrakı aylıq borc xidməti ${azn(a.repayment.postTransactionDebtService)}, aylıq ehtiyat ${azn(a.repayment.headroomMonthly)}.`
        : 'Ödəmə qabiliyyəti hesablana bilmədi.',
      a.repayment
        ? `DSCR maliyyələşmədən əvvəl ${x(a.repayment.dscrBefore)}, sonra ${x(a.repayment.dscrAfter)}. Aylıq ödənişin proqnoz ödəmə qabiliyyətinə nisbəti ${Number.isFinite(a.repayment.paymentToCapacity ?? NaN) ? pct(a.repayment.paymentToCapacity) : 'ödəmə qabiliyyəti yoxdur'} (norma ≤ 80%).`
        : '',
      a.forecast
        ? `Proqnoz dövründə minimum aylıq nağd qalıq ${azn(a.forecast.minimumCash)} (${a.forecast.minimumCashMonth}), mənfi qalıqlı ay sayı ${a.forecast.negativeMonths}.`
        : '',
    ].filter(Boolean),
  });

  /* 12. Purpose */
  sections.push({
    key: 'PURPOSE',
    titleAz: 'Kreditin təyinatı',
    titleEn: 'Loan Purpose',
    paragraphs: [
      `Təyinat bölgüsü: ${app.purposeLines.map((p) => `${p.description} — ${azn(p.amount)} (${pct(p.amount / purposeTotal, 0)})`).join('; ')}.`,
      refinancing > 0
        ? `Məbləğin ${pct(refinancing / purposeTotal)} hissəsi mövcud borcların refinansmanına yönəldilir.`
        : 'Refinansman komponenti yoxdur.',
      nonBusiness > 0
        ? `Diqqət: məbləğin ${pct(nonBusiness / purposeTotal)} hissəsi (${azn(nonBusiness)}) biznesdənkənar təyinatlıdır və biznesə əlavə gəlir yaratmır.`
        : 'Bütün məbləğ biznes təyinatlıdır.',
    ],
  });

  /* 13. Collateral */
  sections.push({
    key: 'COLLATERAL',
    titleAz: 'Təminat',
    titleEn: 'Collateral',
    paragraphs: [
      `Girovun bazar dəyəri ${azn(a.collateral.totalMarketValue)}, likvid dəyəri ${azn(a.collateral.totalForcedSaleValue)}, diskontdan sonra uyğun dəyər ${azn(a.collateral.totalEligibleValue)}.`,
      `Əməliyyatdan sonrakı ATB ekspozisiyası ${azn(a.collateral.exposure)} olduqda uyğun girov örtüyü ${pct(a.collateral.eligibleCoverage)} təşkil edir; təminatsız hissə ${azn(a.collateral.unsecuredExposure)}.`,
    ],
    bullets: a.collateral.items
      .filter((i) => !i.eligible)
      .map((i) => `${i.collateral.description}: ${i.ineligibilityReason}`),
  });

  /* 14. Rating */
  sections.push({
    key: 'RATING',
    titleAz: 'Risk reytinqi',
    titleEn: 'Risk Rating',
    paragraphs: a.rating.steps.map((s) => `${s.labelAz}: ${s.reasonAz}`),
    bullets: [
      `ATB Yekun Rəy (As-Is ekspert qiymətləndirməsi): ${a.legacy.totalScore.toFixed(2)} / 100 — ${a.legacy.bandLabelAz}${a.legacy.globalStopTriggered ? ' (stop faktor səbəbindən sıfırlanıb)' : ''}.`,
      `Məlumat keyfiyyəti reytinqi: ${a.dataQuality.grade} — ${a.dataQuality.gradeLabelAz}.`,
    ],
  });

  /* 15. Policy */
  sections.push({
    key: 'POLICY',
    titleAz: 'Siyasət uyğunluğu',
    titleEn: 'Policy Compliance',
    paragraphs: [
      `${a.policy.evaluatedCount} qayda qiymətləndirilib, ${a.policy.passedCount} norma ödənilir. ${a.policy.breaches.length} pozuntu qeydə alınıb (${a.policy.stops.length} stop səviyyəli, ${a.policy.exceptions.length} istisna tələb edən).`,
    ],
    bullets: a.policy.breaches.map((b) => b.message),
  });

  const positives = buildPositives(a);
  const negatives = buildNegatives(a, nonBusiness, purposeTotal);
  const recommendation = buildRecommendation(app, a, negatives);

  return { sections, positives, negatives, recommendation };
}

function buildPositives(a: Assessment): string[] {
  const out: string[] = [];
  if ((a.bureauSummary.acbMicroScore ?? 0) >= 700) {
    out.push(`AKB skoru ${a.bureauSummary.acbMicroScore} — güclü xarici kredit reytinqi.`);
  }
  if (a.bureauSummary.historicMaxDpd === 0) out.push('Kredit tarixçəsində heç bir gecikmə qeydə alınmayıb.');
  if ((a.refinancing.instalmentRepaymentShare ?? 0) > 0.5) {
    out.push('Əvvəlki kreditlərin əsas hissəsi adi aylıq ödənişlərlə bağlanıb.');
  }
  if ((a.repayment?.dscrAfter ?? 0) >= 1.5) out.push('Əməliyyatdan sonrakı DSCR normanı qarşılayır.');
  if ((a.collateral.eligibleCoverage ?? 0) >= 1) out.push('Uyğun girov örtüyü tam təminat səviyyəsindədir.');
  if (['A', 'B'].includes(a.dataQuality.grade)) out.push('Maliyyə məlumatları sənədlərlə yaxşı təsdiqlənib.');
  if (a.crossChecks.every((c) => c.passed)) out.push('Bütün uzlaşma yoxlamaları uğurludur.');
  if (a.activeStopFactors.length === 0) out.push('Stop faktor aşkarlanmayıb.');
  if ((a.ratios.debtToEquityInclNew?.value ?? 99) <= 1) out.push('Kapital adekvatlığı norması ödənilir.');
  if (a.rating.business.riskBand === 'LOW' || a.rating.business.riskBand === 'LOW_MEDIUM') {
    out.push('Biznes təhlili aşağı riskli qiymətləndirilib.');
  }
  return out;
}

function buildNegatives(a: Assessment, nonBusiness: number, purposeTotal: number): string[] {
  const out: string[] = [];
  for (const s of a.activeStopFactors) out.push(`STOP FAKTOR: ${s.rule.labelAz} — ${s.observedValue}`);
  for (const b of a.policy.stops) out.push(b.message);
  for (const b of a.policy.exceptions) out.push(b.message);
  for (const f of a.findings.filter((x) => x.severity === 'CRITICAL' || x.severity === 'HIGH').slice(0, 8)) {
    out.push(f.title);
  }
  if (nonBusiness / purposeTotal > 0.1) {
    out.push(`Məbləğin ${(100 * nonBusiness) / purposeTotal}%-i biznesdənkənar təyinatlıdır.`);
  }
  return [...new Set(out)];
}

function buildRecommendation(
  app: CreditApplication,
  a: Assessment,
  negatives: string[],
): OpinionDraft['recommendation'] {
  const requested = app.requestedStructure.amount;
  const maxSustainable = a.maxLoan?.maxSustainableLoan ?? 0;
  const rationale: string[] = [];
  const conditions: string[] = [];

  let decision: Decision;
  let recommendedAmount = requested;

  if (a.activeStopFactors.length > 0) {
    decision = 'DECLINE';
    recommendedAmount = 0;
    rationale.push(
      `Sifariş üzrə ${a.activeStopFactors.length} stop faktor mövcuddur; metodologiyaya əsasən bu, obyektiv qiymətləndirməni mümkünsüz edir və yalnız ${AUTHORITY_LABEL_AZ[a.routing.decisionAuthority ?? 'MANAGEMENT_BOARD']} səviyyəsində baxıla bilər.`,
    );
  } else if (maxSustainable <= 0) {
    decision = 'DECLINE';
    recommendedAmount = 0;
    rationale.push(
      'Mövcud pul axını mövcud borc öhdəliklərini belə tələb olunan DSCR səviyyəsində örtmür — əlavə borc yükü daşınmazdır.',
    );
  } else if (maxSustainable < requested * 0.95) {
    decision = 'APPROVE_WITH_CONDITIONS';
    recommendedAmount = Math.floor(maxSustainable / 10_000) * 10_000;
    rationale.push(
      `Tələb olunan ${new Intl.NumberFormat('az-AZ').format(requested)} AZN pul axını ilə dəstəklənmir; 1.50x DSCR həddində maksimum dayanıqlı məbləğ ${new Intl.NumberFormat('az-AZ').format(Math.round(maxSustainable))} AZN-dir. Azaldılmış məbləğ tövsiyə olunur.`,
    );
  } else if (a.policy.exceptions.length > 0) {
    decision = 'APPROVE_WITH_CONDITIONS';
    rationale.push('Maliyyə göstəriciləri məbləği dəstəkləyir, lakin bəzi siyasət normaları istisna tələb edir.');
  } else {
    decision = 'APPROVE_WITH_CONDITIONS';
    rationale.push('Sifariş bütün əsas maliyyə və siyasət normalarını qarşılayır.');
  }

  if ((a.collateral.eligibleCoverage ?? 0) < 1) {
    conditions.push('Əlavə təminatın təqdim edilməsi və ya məbləğin uyğun girov örtüyünə uyğunlaşdırılması.');
  }
  for (const item of a.collateral.items.filter((i) => !i.collateral.registered && i.collateral.type !== 'PERSONAL_GUARANTEE')) {
    conditions.push(`Girovun rəsmiləşdirilməsi və qeydiyyatı: ${item.collateral.description}.`);
  }
  for (const item of a.collateral.items.filter((i) => i.eligible && !i.collateral.insured)) {
    conditions.push(`Girovun sığortalanması: ${item.collateral.description}.`);
  }
  if (a.dataQuality.grade === 'C' || a.dataQuality.grade === 'D' || a.dataQuality.grade === 'E') {
    conditions.push('Çatışmayan sənədlərin (kreditor siyahısı, anbar sayımı) təqdim edilməsi.');
  }
  if (a.debtBeingClosed > 0) {
    conditions.push('Refinansman məbləğinin birbaşa müvafiq banka köçürülməsi və bağlanma arayışının alınması.');
  }
  if (negatives.some((n) => n.toLowerCase().includes('debitor'))) {
    conditions.push('Debitor borclarının rüblük yaşlandırma hesabatının təqdim edilməsi.');
  }

  return { decision, recommendedAmount, rationale, conditions: [...new Set(conditions)] };
}
