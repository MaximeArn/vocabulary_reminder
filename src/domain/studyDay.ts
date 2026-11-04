/**
 * Le « jour d'étude » commence à 4 h du matin, comme dans Anki :
 * une révision faite à 1 h du matin compte encore pour la veille.
 */
export const DAY_STARTS_AT_HOUR = 4;

/** Jour d'étude d'une date, au format AAAA-MM-JJ en heure locale. */
export function studyDayOf(date: Date): string {
  const shifted = new Date(date);
  shifted.setHours(shifted.getHours() - DAY_STARTS_AT_HOUR);
  const year = shifted.getFullYear();
  const month = String(shifted.getMonth() + 1).padStart(2, "0");
  const day = String(shifted.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
