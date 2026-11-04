/** Mises en forme françaises partagées par plusieurs écrans. */

export function formatWordCount(count: number): string {
  if (count === 0) return "Aucun mot";
  return count === 1 ? "1 mot" : `${count} mots`;
}

const longDateFormatter = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", year: "numeric" });

/** « 4 novembre 2026 » */
export function formatLongDate(timestamp: number): string {
  return longDateFormatter.format(timestamp);
}

const dayFormatter = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long" });

/** Date d'un jour d'étude (AAAA-MM-JJ). */
export function dateOfDay(day: string): Date {
  const [year, month, date] = day.split("-").map(Number);
  return new Date(year ?? 0, (month ?? 1) - 1, date ?? 1, 12);
}

/** « aujourd’hui », « demain » ou « le 12 novembre ». */
export function formatRelativeDay(day: string, today: string, tomorrow: string): string {
  if (day <= today) return "aujourd’hui";
  if (day === tomorrow) return "demain";
  return `le ${dayFormatter.format(dateOfDay(day))}`;
}
