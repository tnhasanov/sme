import type { CreditApplication, Customer } from '@/types/application';
import type { UUID } from '@/types/core';
import type {
  ApplicationFilter,
  ApplicationRepository,
  CustomerRepository,
  UnitOfWork,
} from './types';

/**
 * In-memory implementation used by the MVP.
 *
 * Writes mutate a module-level store that lives for the process lifetime.
 * That is sufficient for the analysis-heavy workflows this build covers and
 * keeps the demo reproducible; swapping in Prisma changes only this file.
 */

class InMemoryCustomerRepository implements CustomerRepository {
  constructor(private readonly store: Map<UUID, Customer>) {}

  async list(): Promise<Customer[]> {
    return [...this.store.values()];
  }

  async findById(id: UUID): Promise<Customer | null> {
    return this.store.get(id) ?? null;
  }

  async save(customer: Customer): Promise<Customer> {
    this.store.set(customer.id, customer);
    return customer;
  }
}

class InMemoryApplicationRepository implements ApplicationRepository {
  constructor(private readonly store: Map<UUID, CreditApplication>) {}

  async list(filter: ApplicationFilter = {}): Promise<CreditApplication[]> {
    let items = [...this.store.values()];
    if (filter.stage) items = items.filter((a) => a.stage === filter.stage);
    if (filter.branch) items = items.filter((a) => a.branch === filter.branch);
    if (filter.rm) items = items.filter((a) => a.rm === filter.rm);
    if (filter.underwriter) items = items.filter((a) => a.underwriter === filter.underwriter);
    if (filter.customerId) items = items.filter((a) => a.customerId === filter.customerId);
    if (filter.search) {
      const q = filter.search.toLocaleLowerCase('az');
      items = items.filter((a) => a.reference.toLocaleLowerCase('az').includes(q));
    }
    return items.sort((a, b) => b.applicationDate.localeCompare(a.applicationDate));
  }

  async findById(id: UUID): Promise<CreditApplication | null> {
    return this.store.get(id) ?? null;
  }

  async findByReference(reference: string): Promise<CreditApplication | null> {
    return [...this.store.values()].find((a) => a.reference === reference) ?? null;
  }

  async save(application: CreditApplication): Promise<CreditApplication> {
    this.store.set(application.id, application);
    return application;
  }

  async recordRejection(
    id: UUID,
    rejection: CreditApplication['rejection'],
  ): Promise<CreditApplication> {
    const existing = this.store.get(id);
    if (!existing) throw new Error(`Sifariş tapılmadı: ${id}`);
    // The record is retained in full — only the stage and rejection move.
    const updated: CreditApplication = {
      ...existing,
      stage: rejection?.stage ?? existing.stage,
      rejection,
    };
    this.store.set(id, updated);
    return updated;
  }
}

const customerStore = new Map<UUID, Customer>();
const applicationStore = new Map<UUID, CreditApplication>();
let seeded = false;

export function hydrate(customers: Customer[], applications: CreditApplication[]): void {
  if (seeded) return;
  for (const c of customers) customerStore.set(c.id, c);
  for (const a of applications) applicationStore.set(a.id, a);
  seeded = true;
}

export const unitOfWork: UnitOfWork = {
  customers: new InMemoryCustomerRepository(customerStore),
  applications: new InMemoryApplicationRepository(applicationStore),
};
