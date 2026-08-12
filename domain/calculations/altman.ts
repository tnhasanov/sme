import type { BalanceSheetTotals, IncomeStatementTotals } from '@/types/financials';
import { safeDiv } from '@/types/core';

/**
 * Altman Z-score (§45).
 *
 * Three variants exist in the ATB workbook and the platform keeps all of
 * them selectable, because the workbook's own selector (`G116`) lets the
 * analyst choose. Prometeia's quick-win proposal uses the PRIVATE variant,
 * which is therefore the default for the rating engine.
 */

export type AltmanVariant = 'GENERAL' | 'PRIVATE' | 'EMERGING';
export type AltmanZone = 'LOW_RISK' | 'GREY' | 'HIGH_RISK';

export interface AltmanVariantConfig {
  key: AltmanVariant;
  labelAz: string;
  labelEn: string;
  coefficients: { x1: number; x2: number; x3: number; x4: number; x5: number; constant: number };
  lowRiskAbove: number;
  highRiskBelow: number;
  usesX5: boolean;
  sourceRef: string;
}

export const ALTMAN_VARIANTS: Record<AltmanVariant, AltmanVariantConfig> = {
  GENERAL: {
    key: 'GENERAL',
    labelAz: 'Altman Z Score — Ümumi',
    labelEn: 'Altman Z-Score — General',
    coefficients: { x1: 1.2, x2: 1.4, x3: 3.3, x4: 0.6, x5: 1.0, constant: 0 },
    lowRiskAbove: 2.99,
    highRiskBelow: 1.81,
    usesX5: true,
    sourceRef: 'Rəy iş kitabı, Əmsallar sheet — Ümumi variant',
  },
  PRIVATE: {
    key: 'PRIVATE',
    labelAz: 'Altman Z Score — Özəl şirkətlər',
    labelEn: 'Altman Z-Score — Private firms',
    coefficients: { x1: 0.717, x2: 0.847, x3: 3.107, x4: 0.42, x5: 0.998, constant: 0 },
    lowRiskAbove: 2.9,
    highRiskBelow: 1.23,
    usesX5: true,
    sourceRef: 'Rəy iş kitabı, Əmsallar sheet; Prometeia quick-win proposal',
  },
  EMERGING: {
    key: 'EMERGING',
    labelAz: 'Altman Z Score — İnkişaf etməkdə olan ölkələr',
    labelEn: 'Altman Z-Score — Emerging markets',
    coefficients: { x1: 6.56, x2: 3.26, x3: 6.72, x4: 1.05, x5: 0, constant: 3.25 },
    lowRiskAbove: 2.6,
    highRiskBelow: 1.1,
    usesX5: false,
    sourceRef: 'Rəy iş kitabı, Əmsallar sheet — İnkişaf etməkdə olan ölkələr variantı',
  },
};

export interface AltmanInputs {
  workingCapital: number;
  retainedEarnings: number;
  ebit: number;
  equity: number;
  totalLiabilities: number;
  sales: number;
  totalAssets: number;
}

export interface AltmanResult {
  variant: AltmanVariant;
  x1: number | null;
  x2: number | null;
  x3: number | null;
  x4: number | null;
  x5: number | null;
  z: number | null;
  zone: AltmanZone | null;
  zoneLabelAz: string;
  terms: Array<{ key: string; label: string; ratio: number | null; coefficient: number; contribution: number }>;
  config: AltmanVariantConfig;
}

/**
 * Zone boundaries. The methodology does not state whether a Z exactly on a
 * boundary belongs to the adjacent zone or the grey zone; the platform
 * treats exact boundaries as GREY (the conservative reading) and the choice
 * is configurable through `boundaryInclusive` in the notching config.
 */
export function altmanZone(
  z: number,
  cfg: AltmanVariantConfig,
  boundary: 'LOW_SIDE' | 'HIGH_SIDE' | 'GREY' = 'GREY',
): AltmanZone {
  if (z > cfg.lowRiskAbove) return 'LOW_RISK';
  if (z < cfg.highRiskBelow) return 'HIGH_RISK';
  if (z === cfg.lowRiskAbove) return boundary === 'HIGH_SIDE' ? 'LOW_RISK' : 'GREY';
  if (z === cfg.highRiskBelow) return boundary === 'LOW_SIDE' ? 'HIGH_RISK' : 'GREY';
  return 'GREY';
}

export const ALTMAN_ZONE_LABEL_AZ: Record<AltmanZone, string> = {
  LOW_RISK: 'Sağlam (aşağı risk)',
  GREY: 'Boz zona (orta risk)',
  HIGH_RISK: 'Təhlükəli (yüksək risk)',
};

export function computeAltman(
  inputs: AltmanInputs,
  variant: AltmanVariant = 'PRIVATE',
  boundary: 'LOW_SIDE' | 'HIGH_SIDE' | 'GREY' = 'GREY',
): AltmanResult {
  const cfg = ALTMAN_VARIANTS[variant];
  const { coefficients: k } = cfg;

  const x1 = safeDiv(inputs.workingCapital, inputs.totalAssets);
  const x2 = safeDiv(inputs.retainedEarnings, inputs.totalAssets);
  const x3 = safeDiv(inputs.ebit, inputs.totalAssets);
  const x4 = safeDiv(inputs.equity, inputs.totalLiabilities);
  const x5 = cfg.usesX5 ? safeDiv(inputs.sales, inputs.totalAssets) : null;

  const terms = [
    { key: 'x1', label: 'İşlək kapital / Cəmi aktivlər', ratio: x1, coefficient: k.x1, contribution: (x1 ?? 0) * k.x1 },
    {
      key: 'x2',
      label: 'Bölüşdürülməmiş mənfəət / Cəmi aktivlər',
      ratio: x2,
      coefficient: k.x2,
      contribution: (x2 ?? 0) * k.x2,
    },
    { key: 'x3', label: 'EBIT / Cəmi aktivlər', ratio: x3, coefficient: k.x3, contribution: (x3 ?? 0) * k.x3 },
    { key: 'x4', label: 'Kapital / Cəmi öhdəliklər', ratio: x4, coefficient: k.x4, contribution: (x4 ?? 0) * k.x4 },
  ];
  if (cfg.usesX5) {
    terms.push({
      key: 'x5',
      label: 'Satış / Cəmi aktivlər',
      ratio: x5,
      coefficient: k.x5,
      contribution: (x5 ?? 0) * k.x5,
    });
  }

  const anyMissing = x1 === null || x2 === null || x3 === null || x4 === null || (cfg.usesX5 && x5 === null);
  const z = anyMissing ? null : cfg.coefficients.constant + terms.reduce((s, t) => s + t.contribution, 0);
  const zone = z === null ? null : altmanZone(z, cfg, boundary);

  return {
    variant,
    x1,
    x2,
    x3,
    x4,
    x5,
    z,
    zone,
    zoneLabelAz: zone ? ALTMAN_ZONE_LABEL_AZ[zone] : 'Hesablanmayıb',
    terms,
    config: cfg,
  };
}

export function altmanInputsFrom(
  balance: BalanceSheetTotals,
  income: IncomeStatementTotals,
  retainedEarnings: number,
): AltmanInputs {
  return {
    workingCapital: balance.workingCapital,
    retainedEarnings,
    ebit: income.ebit,
    equity: balance.totalEquity,
    totalLiabilities: balance.totalLiabilities,
    sales: income.sales,
    totalAssets: balance.totalAssets,
  };
}
