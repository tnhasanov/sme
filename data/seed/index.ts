import type { CreditApplication, Customer } from '@/types/application';
import { hydrate } from '@/repositories/in-memory';
import { buildCaspianFoodCase } from './case-caspian-food';
import {
  buildAgricultureCase,
  buildConstructionCase,
  buildRefinancingCase,
  buildStrongBorrowerCase,
} from './other-cases';
import { buildRejectedApplications } from './rejected-cases';

/**
 * Seed entry point.
 *
 * Every figure here is synthetic. No real customer name, tax number, phone
 * number, address, account number or bureau record from the reference
 * material is reproduced — only the risk patterns are carried across.
 */

let cache: { customers: Customer[]; applications: CreditApplication[] } | null = null;

export function seedData(): { customers: Customer[]; applications: CreditApplication[] } {
  if (cache) return cache;

  const cases = [
    buildCaspianFoodCase(),
    buildRefinancingCase(),
    buildStrongBorrowerCase(),
    buildConstructionCase(),
    buildAgricultureCase(),
  ];

  const customers = cases.map((c) => c.customer);
  const applications = cases.map((c) => c.application);

  // Rejected applications are retained in full (§17) so reject analysis,
  // approval-rate reporting and future model calibration remain possible.
  const rejected = buildRejectedApplications(customers);
  applications.push(...rejected.applications);
  customers.push(...rejected.customers);

  cache = { customers, applications };
  return cache;
}

/** Called once per process before any repository read. */
export function ensureSeeded(): void {
  const { customers, applications } = seedData();
  hydrate(customers, applications);
}
