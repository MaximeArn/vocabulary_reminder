/**
 * Le « jour d'étude » commence à 4 h du matin, comme dans Anki :
 * une révision faite à 1 h du matin compte encore pour la veille.
 * Les jours sont manipulés au format AAAA-MM-JJ, en heure locale.
 */
export const DAY_STARTS_AT_HOUR = 4;

/** Jour d'étude d'une date. */
export function studyDayOf(date: Date): string {
  const shifted = new Date(date);
  shifted.setHours(shifted.getHours() - DAY_STARTS_AT_HOUR);
  return formatDay(shifted);
}

/** Ajoute (ou retire) des jours à un jour d'étude. */
export function addDays(day: string, count: number): string {
  const [year, month, date] = day.split("-").map(Number);
  // Calcul à midi : un changement d'heure (été / hiver) ne peut pas faire changer de jour.
  return formatDay(new Date(year ?? 0, (month ?? 1) - 1, (date ?? 1) + count, 12));
}

/** Les `count` derniers jours d'étude, du plus ancien à `today` inclus. */
export function lastDays(today: string, count: number): string[] {
  return Array.from({ length: count }, (_, index) => addDays(today, index - count + 1));
}

function formatDay(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
