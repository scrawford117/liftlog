/** Local-date helpers. Dates are plain 'YYYY-MM-DD' strings in local time. */

export function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function parseISODate(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(s: string, n: number): string {
  const d = parseISODate(s);
  d.setDate(d.getDate() + n);
  return toISODate(d);
}

export function weekday(s: string): number {
  return parseISODate(s).getDay();
}

export function today(): string {
  return toISODate(new Date());
}

/** Monday of the week containing the date. */
export function weekStart(s: string): string {
  const wd = weekday(s);
  return addDays(s, wd === 0 ? -6 : 1 - wd);
}

export function formatDate(s: string, opts: Intl.DateTimeFormatOptions = { weekday: 'short', month: 'short', day: 'numeric' }) {
  return parseISODate(s).toLocaleDateString(undefined, opts);
}
