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
