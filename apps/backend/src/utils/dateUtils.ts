/**
 * Renders a business date as 'YYYY-MM-DD' in IST.
 *
 * Accepts a string as well as a Date because the Postgres driver hands DATE
 * columns back as the raw 'YYYY-MM-DD' text (see the type parsers in
 * src/db/pool.ts). Those are already the value we want and are returned
 * untouched; running them through a timezone conversion would be wrong, since
 * a date with no time attached has no zone to convert from.
 */
export function formatDate(date: Date | string): string {
  if (typeof date === 'string') {
    return date.slice(0, 10);
  }
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return formatter.format(date);
}

export function getNowIST(): Date {
  const now = new Date();
  const istString = now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' });
  return new Date(istString);
}
