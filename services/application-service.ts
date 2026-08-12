import { cache } from 'react';
import { ensureSeeded } from '@/data/seed';
import { unitOfWork } from '@/repositories/in-memory';
import type { ApplicationFilter } from '@/repositories/types';
import type { CreditApplication, Customer } from '@/types/application';
import type { FinancialLens } from '@/types/core';
import { assessApplication, type Assessment } from './assessment';

/**
 * Application service — the only entry point pages use.
 *
 * Assessments are memoised per request so a page and its sticky panel share
 * one computation instead of racing to two slightly different answers.
 */

export interface ApplicationCase {
  application: CreditApplication;
  customer: Customer;
  assessment: Assessment;
}

function init() {
  ensureSeeded();
}

export const listApplications = cache(async (filter?: ApplicationFilter) => {
  init();
  return unitOfWork.applications.list(filter);
});

export const listCustomers = cache(async () => {
  init();
  return unitOfWork.customers.list();
});

export const getCustomer = cache(async (id: string) => {
  init();
  return unitOfWork.customers.findById(id);
});

export const getApplication = cache(async (id: string) => {
  init();
  return unitOfWork.applications.findById(id);
});

export const getCase = cache(
  async (id: string, lens: FinancialLens = 'ADJUSTED'): Promise<ApplicationCase | null> => {
    init();
    const application = await unitOfWork.applications.findById(id);
    if (!application) return null;
    const customer = await unitOfWork.customers.findById(application.customerId);
    if (!customer) return null;
    return { application, customer, assessment: assessApplication(application, customer, { lens }) };
  },
);

/** Every live case with its assessment — used by dashboard and portfolio. */
export const listCases = cache(async (): Promise<ApplicationCase[]> => {
  init();
  const applications = await unitOfWork.applications.list();
  const customers = await unitOfWork.customers.list();
  const byId = new Map(customers.map((c) => [c.id, c]));

  return applications
    .map((application) => {
      const customer = byId.get(application.customerId);
      if (!customer) return null;
      return { application, customer, assessment: assessApplication(application, customer) };
    })
    .filter((x): x is ApplicationCase => x !== null);
});

/** Cases that carry full financial data — rejected stubs are excluded. */
export const listAssessedCases = cache(async (): Promise<ApplicationCase[]> => {
  const all = await listCases();
  return all.filter((c) => c.application.periods.length > 0);
});
