import type { ExplainedMetric, Severity } from '@/types/core';

/** Azerbaijani-locale formatting helpers used across the workstation. */

const nf = (min: number, max: number) =>
  new Intl.NumberFormat('az-AZ', { minimumFractionDigits: min, maximumFractionDigits: max });

export function azn(value: number | null | undefined, decimals = 0): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  return nf(decimals, decimals).format(value);
}

export function aznFull(value: number | null | undefined, decimals = 0): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  return `${nf(decimals, decimals).format(value)} ₼`;
}

/** Compact form for headline tiles: 2.5 mln ₼ */
export function aznCompact(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `${nf(1, 2).format(value / 1_000_000)} mln ₼`;
  if (abs >= 1_000) return `${nf(0, 1).format(value / 1_000)} min ₼`;
  return `${nf(0, 0).format(value)} ₼`;
}

export function pct(value: number | null | undefined, decimals = 1): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  return `${nf(decimals, decimals).format(value * 100)}%`;
}

export function times(value: number | null | undefined, decimals = 2): string {
  if (value === null || value === undefined) return '—';
  if (!Number.isFinite(value)) return '∞';
  return `${nf(decimals, decimals).format(value)}x`;
}

export function days(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  return `${nf(0, 0).format(value)} gün`;
}

export function metricValue(m: ExplainedMetric | undefined): string {
  if (!m) return '—';
  switch (m.unit) {
    case 'PERCENT':
      return pct(m.value);
    case 'DAYS':
      return days(m.value);
    case 'CURRENCY':
      return aznFull(m.value);
    case 'TIMES':
      return times(m.value);
    case 'SCORE':
      return azn(m.value, 1);
    case 'RATIO':
    default:
      return times(m.value);
  }
}

export function dateAz(value: string | undefined | null): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return new Intl.DateTimeFormat('az-AZ', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(d);
}

export function dateTimeAz(value: string | undefined | null): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return new Intl.DateTimeFormat('az-AZ', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
}

export function daysBetween(a: string | undefined, b: string | undefined): number | null {
  if (!a || !b) return null;
  const d = (new Date(b).getTime() - new Date(a).getTime()) / 86_400_000;
  return Number.isFinite(d) ? Math.round(d * 10) / 10 : null;
}

export const SEVERITY_LABEL_AZ: Record<Severity, string> = {
  CRITICAL: 'Kritik',
  HIGH: 'Yüksək',
  MEDIUM: 'Orta',
  LOW: 'Aşağı',
  INFO: 'Məlumat',
};

export const SEVERITY_CLASS: Record<Severity, string> = {
  CRITICAL: 'bg-rose-500/15 text-rose-300 ring-rose-500/30',
  HIGH: 'bg-orange-500/15 text-orange-300 ring-orange-500/30',
  MEDIUM: 'bg-amber-500/15 text-amber-300 ring-amber-500/30',
  LOW: 'bg-sky-500/15 text-sky-300 ring-sky-500/30',
  INFO: 'bg-slate-500/15 text-slate-300 ring-slate-500/30',
};

export const STAGE_LABEL_AZ: Record<string, string> = {
  DRAFT: 'Qaralama',
  PRE_SCREENING: 'İlkin süzgəc',
  RM_SUBMITTED: 'RM təqdim edib',
  SME_CENTER_ANALYSIS: 'KOB Mərkəzi təhlili',
  UNDERWRITING: 'Anderraytinq',
  RISK_REVIEW: 'Risk baxışı',
  COMMITTEE: 'Komitə',
  DECIDED: 'Qərar verilib',
  REJECTED_PRESCREEN: 'İlkin mərhələdə imtina',
  RETURNED: 'Geri qaytarılıb',
  CANCELLED: 'Ləğv edilib',
};

export const DECISION_LABEL_AZ: Record<string, string> = {
  APPROVE: 'Təsdiq',
  APPROVE_WITH_CONDITIONS: 'Şərtlərlə təsdiq',
  DECLINE: 'İmtina',
  RETURN_FOR_INFORMATION: 'Məlumat üçün geri qaytarma',
  ESCALATE: 'Eskalasiya',
};

export const EVIDENCE_LABEL_AZ: Record<string, string> = {
  VERIFIED: 'Təsdiqlənib',
  PARTIALLY_VERIFIED: 'Qismən təsdiqlənib',
  VERBAL: 'Şifahi',
  ANALYST_ESTIMATE: 'Analitik qiymətləndirmə',
  MISSING: 'Yoxdur',
  CONTRADICTORY: 'Ziddiyyətli',
};

export const EVIDENCE_CLASS: Record<string, string> = {
  VERIFIED: 'bg-emerald-500/15 text-emerald-300 ring-emerald-500/30',
  PARTIALLY_VERIFIED: 'bg-lime-500/15 text-lime-300 ring-lime-500/30',
  VERBAL: 'bg-amber-500/15 text-amber-300 ring-amber-500/30',
  ANALYST_ESTIMATE: 'bg-sky-500/15 text-sky-300 ring-sky-500/30',
  MISSING: 'bg-rose-500/15 text-rose-300 ring-rose-500/30',
  CONTRADICTORY: 'bg-rose-500/20 text-rose-200 ring-rose-500/40',
};

export const SOURCE_TYPE_LABEL_AZ: Record<string, string> = {
  TAX_AUTHORITY: 'Vergi orqanı',
  BANK_STATEMENT: 'Bank çıxarışı',
  POS: 'POS terminal',
  CREDIT_BUREAU: 'Kredit bürosu',
  CUSTOMER_DOCUMENT: 'Müştəri sənədi',
  CUSTOMER_VERBAL: 'Müştərinin şifahi məlumatı',
  FIELD_VISIT: 'Yerində baxış',
  INTERNAL_SYSTEM: 'Bankın daxili sistemi',
  ANALYST_CALCULATION: 'Analitik hesablama',
  THIRD_PARTY_APPRAISAL: 'Müstəqil qiymətləndirmə',
  REGISTRY: 'Dövlət reyestri',
};

export const RELATIONSHIP_LABEL_AZ: Record<string, string> = {
  SELF: 'Sifarişçi',
  PARENT: 'Ana şirkət',
  SUBSIDIARY: 'Törəmə şirkət',
  SISTER_COMPANY: 'Qardaş şirkət',
  SHAREHOLDER: 'Təsisçi',
  SOLE_PROPRIETOR: 'Fərdi sahibkar',
  GUARANTOR: 'Zamin',
  RELATED_BORROWER: 'Əlaqəli borcalan',
  ECONOMICALLY_RELATED: 'İqtisadi əlaqəli şəxs',
};

export const COLLATERAL_LABEL_AZ: Record<string, string> = {
  REAL_ESTATE_RESIDENTIAL: 'Yaşayış daşınmaz əmlakı',
  REAL_ESTATE_COMMERCIAL: 'Kommersiya daşınmaz əmlakı',
  REAL_ESTATE_LAND: 'Torpaq sahəsi',
  EQUIPMENT: 'Avadanlıq',
  VEHICLE: 'Nəqliyyat vasitəsi',
  CASH_DEPOSIT: 'Nağd / depozit',
  RECEIVABLES: 'Debitor borcları',
  INVENTORY: 'Mal-material ehtiyatı',
  PERSONAL_GUARANTEE: 'Fiziki şəxsin zaminliyi',
  CORPORATE_GUARANTEE: 'Hüquqi şəxsin zaminliyi',
};

export const PURPOSE_LABEL_AZ: Record<string, string> = {
  INVENTORY: 'Mal ehtiyatı',
  WORKING_CAPITAL: 'Dövriyyə vəsaiti',
  CAPEX: 'Əsas vəsait / investisiya',
  VEHICLE: 'Nəqliyyat vasitəsi',
  PROPERTY: 'Daşınmaz əmlak',
  REFINANCE_ATB: 'ATB-də refinansman',
  REFINANCE_OTHER_BANK: 'Digər bankda refinansman',
  PERSONAL_NON_BUSINESS: 'Şəxsi / biznesdənkənar',
  OTHER: 'Digər',
};

export const PRODUCT_LABEL_AZ: Record<string, string> = {
  WORKING_CAPITAL_LOAN: 'Dövriyyə vəsaiti krediti',
  WORKING_CAPITAL_LINE: 'Dövriyyə kredit xətti',
  INVESTMENT_LOAN: 'İnvestisiya krediti',
  OVERDRAFT: 'Overdraft',
  AGRO_LOAN: 'Aqro kredit',
  VEHICLE_LOAN: 'Nəqliyyat krediti',
  GUARANTEE: 'Zəmanət',
  LC: 'Akkreditiv',
};

export const DOCUMENT_LABEL_AZ: Record<string, string> = {
  LEGAL: 'Hüquqi sənədlər',
  TAX: 'Vergi sənədləri',
  BANK_STATEMENT: 'Bank çıxarışı',
  FINANCIAL_STATEMENT: 'Maliyyə hesabatları',
  INVENTORY_LIST: 'Mal qalığı siyahısı',
  RECEIVABLE_LIST: 'Debitor siyahısı',
  PAYABLE_LIST: 'Kreditor siyahısı',
  CONTRACT: 'Müqavilələr',
  INVOICE: 'Hesab-faktura / qaimə',
  COLLATERAL: 'Girov sənədləri',
  VALUATION: 'Qiymətləndirmə',
  INSURANCE: 'Sığorta',
  BUREAU_REPORT: 'AKB çıxarışı',
  BUSINESS_PHOTO: 'Biznes şəkilləri',
  REGISTRY_LEDGER: 'Qeydiyyat dəftəri',
  OTHER: 'Digər',
};

export const FINDING_CATEGORY_LABEL_AZ: Record<string, string> = {
  DATA_QUALITY: 'Məlumat keyfiyyəti',
  FINANCIAL_RISK: 'Maliyyə riski',
  CASH_FLOW: 'Pul axını',
  CREDIT_BEHAVIOUR: 'Kredit davranışı',
  PURPOSE: 'Kreditin məqsədi',
  COLLATERAL: 'Girov',
  GOVERNANCE: 'İdarəetmə',
  RECONCILIATION: 'Uzlaşma',
  POLICY: 'Siyasət',
  SECTOR: 'Sektor',
};

export const RISK_CATEGORY_LABEL_AZ: Record<string, string> = {
  LEVERAGE: 'Borc yükü',
  LIQUIDITY: 'Likvidlik',
  CASH_FLOW: 'Pul axını',
  REFINANCING: 'Refinansman',
  CONCENTRATION: 'Konsentrasiya',
  INDUSTRY: 'Sahə riski',
  FX: 'Valyuta riski',
  GOVERNANCE: 'İdarəetmə',
  TRANSPARENCY: 'Şəffaflıq',
  COLLATERAL: 'Girov',
  PURPOSE: 'Məqsəd',
  EXECUTION: 'İcra riski',
  RELATED_PARTIES: 'Əlaqəli şəxslər',
};
