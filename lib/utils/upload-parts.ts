/**
 * Pure math for resilient multipart uploads — no network, no DOM, no server
 * actions. Kept separate so the core logic (part planning, backoff, progress
 * aggregation) is trivially unit-testable and reusable between the upload
 * engine (lib/stores/upload-store.ts) and the server actions.
 */

/** S3/R2 minimum part size is 5 MB (except the last); we use 8 MB. */
export const PART_SIZE_BYTES = 8 * 1024 * 1024

/** Below this, a single PUT is simpler and just as reliable. */
export const MULTIPART_THRESHOLD_BYTES = PART_SIZE_BYTES

export interface UploadPartPlan {
  partNumber: number // 1-indexed, as S3 requires
  start: number // inclusive byte offset
  end: number // exclusive byte offset
  size: number
}

/** Splits a file size into contiguous part plans. Empty file → no parts. */
export function planParts(sizeBytes: number, partSize = PART_SIZE_BYTES): UploadPartPlan[] {
  if (sizeBytes <= 0) return []
  const parts: UploadPartPlan[] = []
  let start = 0
  let partNumber = 1
  while (start < sizeBytes) {
    const end = Math.min(start + partSize, sizeBytes)
    parts.push({ partNumber, start, end, size: end - start })
    start = end
    partNumber++
  }
  return parts
}

/** Small files skip multipart entirely — one PUT, like before this feature. */
export function shouldUseMultipart(sizeBytes: number, threshold = MULTIPART_THRESHOLD_BYTES): boolean {
  return sizeBytes >= threshold
}

export interface BackoffOptions {
  baseMs?: number
  maxMs?: number
  /** Fraction of the exponential delay applied as +/- jitter. */
  jitterRatio?: number
  /** Injectable RNG (0..1) so tests are deterministic. */
  random?: () => number
}

/**
 * Exponential backoff with bounded jitter for a single part's retry.
 * attempt is 1-indexed (first retry = attempt 1).
 */
export function backoffDelayMs(attempt: number, opts: BackoffOptions = {}): number {
  const { baseMs = 500, maxMs = 15000, jitterRatio = 0.3, random = Math.random } = opts
  const exp = Math.min(maxMs, baseMs * 2 ** Math.max(0, attempt - 1))
  const jitter = exp * jitterRatio * (random() * 2 - 1) // +/- jitterRatio around exp
  return Math.max(0, Math.round(exp + jitter))
}

export interface AggregateProgressInput {
  totalBytes: number
  /** Bytes of parts fully uploaded (ETag received). */
  completedBytes: number
  /** Bytes already sent for the part currently in flight (not yet acked). */
  inFlightBytes?: number
}

/** Whole-percent progress across completed parts + the part in flight. */
export function aggregateProgress(input: AggregateProgressInput): number {
  const { totalBytes, completedBytes, inFlightBytes = 0 } = input
  if (totalBytes <= 0) return 0
  const pct = ((completedBytes + inFlightBytes) / totalBytes) * 100
  return Math.max(0, Math.min(100, Math.round(pct)))
}
