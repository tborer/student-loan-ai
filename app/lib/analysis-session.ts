import type { AnalysisResult } from '@/utils/analysis';

const STORAGE_KEY = 'slr_session';

/** Spec: the bridge record between free results and the paid report is TTL-bound. */
const TTL_MS = 24 * 60 * 60 * 1000;

export interface StoredAnalysis {
  token: string;
  createdAt: number;
  result: AnalysisResult;
}

/**
 * Random, non-PII token used as Stripe's client_reference_id.
 */
export function generateSessionToken(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `slr_${crypto.randomUUID()}`;
  }
  return `slr_${Date.now()}_${Math.random().toString(36).slice(2, 12)}`;
}

/**
 * sessionStorage, not localStorage: the record dies with the tab, which suits
 * the privacy-first positioning. It survives the redirect out to Stripe and
 * back, since that returns to the same tab.
 *
 * Every access is guarded -- storage throws in private mode and in some
 * embedded browsers.
 */
export function storeAnalysis(result: AnalysisResult): StoredAnalysis | null {
  const record: StoredAnalysis = {
    token: generateSessionToken(),
    createdAt: Date.now(),
    result,
  };
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(record));
    return record;
  } catch {
    // Storage unavailable: the caller falls back to an in-memory handoff.
    return null;
  }
}

export function loadAnalysis(): StoredAnalysis | null {
  let raw: string | null = null;
  try {
    raw = sessionStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as StoredAnalysis;
    if (!parsed?.token || !parsed?.result) return null;
    if (Date.now() - parsed.createdAt > TTL_MS) {
      clearAnalysis();
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function clearAnalysis(): void {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // Nothing to do; the record expires on its own.
  }
}
