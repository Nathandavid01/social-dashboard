/** Trivial promise delay — its own module so tests can mock it to run instantly. */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
