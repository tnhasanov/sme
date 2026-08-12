import type { CreditApplication, Customer } from '@/types/application';
import type { UUID } from '@/types/core';

/**
 * Repository contracts.
 *
 * The MVP ships an in-memory implementation seeded from typed fixtures; a
 * Prisma/PostgreSQL implementation slots in behind the same interfaces
 * without touching any module, service or page. See
 * /docs/atb-underwriting-spec.md for the migration path.
 */

export interface CustomerRepository {
  list(): Promise<Customer[]>;
  findById(id: UUID): Promise<Customer | null>;
  save(customer: Customer): Promise<Customer>;
}

export interface ApplicationFilter {
  stage?: string;
  branch?: string;
  rm?: string;
  underwriter?: string;
  customerId?: UUID;
  search?: string;
}

export interface ApplicationRepository {
  list(filter?: ApplicationFilter): Promise<CreditApplication[]>;
  findById(id: UUID): Promise<CreditApplication | null>;
  findByReference(reference: string): Promise<CreditApplication | null>;
  save(application: CreditApplication): Promise<CreditApplication>;
  /** Rejected applications are never deleted (§17). */
  recordRejection(id: UUID, rejection: CreditApplication['rejection']): Promise<CreditApplication>;
}

export interface UnitOfWork {
  customers: CustomerRepository;
  applications: ApplicationRepository;
}
