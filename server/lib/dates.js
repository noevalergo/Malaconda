/** Firestore Timestamp | Date | string | null → Date | null */
export function toDate(value) {
  if (!value) return null;
  return typeof value.toDate === "function" ? value.toDate() : new Date(value);
}

/** "2027-01" (calendar month in Swiss time) for a date. Used for monthly commissions. */
export function zurichMonth(date) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Zurich", year: "numeric", month: "2-digit" }).formatToParts(date);
  const y = parts.find((p) => p.type === "year").value;
  const m = parts.find((p) => p.type === "month").value;
  return `${y}-${m}`;
}

/** First instant of the month AFTER "YYYY-MM", in Swiss time. */
export function startOfNextZurichMonth(month) {
  const [y, m] = month.split("-").map(Number);
  const next = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;
  const firstUtc = Date.UTC(m === 12 ? y + 1 : y, m === 12 ? 0 : m, 1);
  // Zurich is UTC+2 (summer) or UTC+1 (winter): midnight is 22:00 or 23:00 UTC the day before.
  for (const offsetHours of [2, 1]) {
    const candidate = new Date(firstUtc - offsetHours * 3_600_000);
    if (zurichMonth(candidate) === next) return candidate;
  }
  throw new Error(`Cannot compute month start for ${month}`);
}
