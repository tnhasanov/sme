'use client';

import { emptyReview, type FindingDisposition, type UnderwriterReview } from '@/domain/review/types';

/**
 * Client-side persistence for underwriter review state.
 *
 * The MVP keeps reviews in the browser so the workflow is fully demonstrable on
 * a stateless host without provisioning a database. The shape is identical to
 * what a `ReviewRepository` would store, so moving this to PostgreSQL is a
 * swap of this module, not a change to any component.
 */

const KEY_PREFIX = 'atb-uw-review:';

function key(applicationId: string): string {
  return `${KEY_PREFIX}${applicationId}`;
}

export function loadReview(applicationId: string): UnderwriterReview {
  const fresh = emptyReview(applicationId, new Date().toISOString());
  if (typeof window === 'undefined') return fresh;

  try {
    const raw = window.localStorage.getItem(key(applicationId));
    if (!raw) return fresh;
    const parsed = JSON.parse(raw) as UnderwriterReview;
    // Merge over a fresh object so a stored review written by an older version
    // cannot leave a required field undefined.
    return {
      ...fresh,
      ...parsed,
      findings: parsed.findings ?? {},
      sectionNotes: parsed.sectionNotes ?? {},
    };
  } catch {
    return fresh;
  }
}

export function saveReview(review: UnderwriterReview): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key(review.applicationId), JSON.stringify(review));
  } catch {
    // Storage can be full or blocked; the UI keeps working from memory.
  }
}

export function clearReview(applicationId: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(key(applicationId));
  } catch {
    /* ignore */
  }
}

export function withFindingReview(
  review: UnderwriterReview,
  findingId: string,
  patch: { disposition?: FindingDisposition; note?: string; mitigant?: string },
): UnderwriterReview {
  const now = new Date().toISOString();
  const existing = review.findings[findingId] ?? {
    findingId,
    disposition: 'OPEN' as FindingDisposition,
    note: '',
    mitigant: '',
    updatedAt: now,
  };

  return {
    ...review,
    findings: {
      ...review.findings,
      [findingId]: { ...existing, ...patch, updatedAt: now },
    },
    updatedAt: now,
  };
}

/* ------------------------------------------------------------------ */
/* Intake drafts                                                       */
/* ------------------------------------------------------------------ */

const INTAKE_KEY = 'atb-intake-draft';

/** The most recent uploaded-and-analysed case, so a refresh does not lose it. */
export function saveIntakeDraft(payload: unknown): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(INTAKE_KEY, JSON.stringify(payload));
  } catch {
    /* ignore */
  }
}

export function loadIntakeDraft<T>(): T | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.sessionStorage.getItem(INTAKE_KEY);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export function clearIntakeDraft(): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.removeItem(INTAKE_KEY);
  } catch {
    /* ignore */
  }
}
