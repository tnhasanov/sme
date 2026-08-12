import { safeDiv } from '@/types/core';
import type { Collateral } from '@/types/application';
import type { CollateralHaircutConfig } from '@/config/policy';

/**
 * Collateral valuation and coverage (§39).
 *
 * Eligible value chain: market value → forced-sale (liquidation) value →
 * haircut → less any prior-ranking lien. Guarantees are tracked but excluded
 * from eligible coverage by default, because a guarantee is a claim on a
 * person, not a realisable asset.
 */

export interface CollateralValuation {
  collateral: Collateral;
  marketValue: number;
  forcedSaleValue: number;
  haircutPct: number;
  haircutSource: 'CONFIG' | 'ANALYST_OVERRIDE';
  valueAfterHaircut: number;
  priorLien: number;
  eligibleValue: number;
  ltv: number | null;
  eligible: boolean;
  ineligibilityReason?: string;
}

export interface CollateralCoverage {
  items: CollateralValuation[];
  totalMarketValue: number;
  totalForcedSaleValue: number;
  totalEligibleValue: number;
  guaranteeValue: number;
  exposure: number;
  /** Forced-sale value / exposure. */
  coverage: number | null;
  /** Post-haircut eligible value / exposure — the policy metric. */
  eligibleCoverage: number | null;
  ltv: number | null;
  securedExposure: number;
  unsecuredExposure: number;
}

export function valueCollateral(item: Collateral, config: CollateralHaircutConfig): CollateralValuation {
  const configured = config.haircuts[item.type] ?? 50;
  const haircutPct = item.haircutOverridePct ?? configured;
  const haircutSource = item.haircutOverridePct !== undefined ? 'ANALYST_OVERRIDE' : 'CONFIG';

  const forcedSaleValue = item.forcedSaleValue || item.marketValue;
  const valueAfterHaircut = forcedSaleValue * (1 - haircutPct / 100);
  const eligibleValueRaw = Math.max(valueAfterHaircut - item.existingLienAmount, 0);

  const ineligible = config.ineligibleTypes.includes(item.type);
  const unregistered = !item.registered;

  return {
    collateral: item,
    marketValue: item.marketValue,
    forcedSaleValue,
    haircutPct,
    haircutSource,
    valueAfterHaircut,
    priorLien: item.existingLienAmount,
    eligibleValue: ineligible || unregistered ? 0 : eligibleValueRaw,
    ltv: null,
    eligible: !ineligible && !unregistered,
    ineligibilityReason: ineligible
      ? 'Zəmanət realizasiya oluna bilən aktiv deyil — uyğun girov örtüyünə daxil edilmir'
      : unregistered
        ? 'Girov qeydiyyata alınmayıb — qeydiyyat şərt kimi tələb olunur'
        : undefined,
  };
}

export function computeCollateralCoverage(
  collateral: Collateral[],
  exposure: number,
  config: CollateralHaircutConfig,
): CollateralCoverage {
  const items = collateral.map((c) => valueCollateral(c, config));
  const realisable = items.filter((i) => i.eligible);

  const totalMarketValue = realisable.reduce((s, i) => s + i.marketValue, 0);
  const totalForcedSaleValue = realisable.reduce((s, i) => s + i.forcedSaleValue, 0);
  const totalEligibleValue = realisable.reduce((s, i) => s + i.eligibleValue, 0);
  const guaranteeValue = items
    .filter((i) => !i.eligible && config.ineligibleTypes.includes(i.collateral.type))
    .reduce((s, i) => s + i.marketValue, 0);

  for (const i of items) {
    i.ltv = safeDiv(exposure, i.forcedSaleValue);
  }

  const securedExposure = Math.min(totalEligibleValue, exposure);

  return {
    items,
    totalMarketValue,
    totalForcedSaleValue,
    totalEligibleValue,
    guaranteeValue,
    exposure,
    coverage: safeDiv(totalForcedSaleValue, exposure),
    eligibleCoverage: safeDiv(totalEligibleValue, exposure),
    ltv: safeDiv(exposure, totalMarketValue),
    securedExposure,
    unsecuredExposure: Math.max(exposure - securedExposure, 0),
  };
}
