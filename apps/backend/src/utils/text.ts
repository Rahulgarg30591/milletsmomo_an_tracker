/**
 * Trims and collapses runs of spaces, so "Gupta  Gas " and "Gupta Gas" are the
 * same value. Blank becomes null.
 */
export function normalizeText(value: string | null | undefined): string | null {
  const cleaned = (value ?? '').replace(/\s+/g, ' ').trim();
  return cleaned === '' ? null : cleaned;
}
