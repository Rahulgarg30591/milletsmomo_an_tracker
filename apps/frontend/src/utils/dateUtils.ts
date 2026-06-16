export function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function getToday(): string {
  return formatDate(new Date());
}

export function getYesterday(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return formatDate(d);
}

export function formatDateLabel(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function formatCurrency(amount: number): string {
  return `\u20B9${amount}`;
}

export function isToday(dateStr: string): boolean {
  return dateStr === getToday();
}

export function isYesterday(dateStr: string): boolean {
  return dateStr === getYesterday();
}
