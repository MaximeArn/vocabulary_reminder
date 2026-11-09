/**
 * Dates historiques.
 *
 * Pas de `Date` JavaScript : elle ne sait pas représenter proprement l'Antiquité.
 * Les années suivent la convention des historiens : -480 = 480 av. J.-C., et
 * l'an 0 n'existe pas (on passe de -1 à 1). Pour les calculs d'écart, on passe
 * par la numérotation astronomique (1 av. J.-C. = 0, 2 av. J.-C. = -1…).
 * Les dates sont conservées telles que les sources les donnent (pas de
 * conversion entre calendriers julien et grégorien).
 */

export type Precision = "day" | "month" | "year" | "decade" | "century";

export interface HistoricalDate {
  /** Année « historienne » : jamais 0, négative avant J.-C. Pour un siècle : sa première année. */
  year: number;
  /** 1 à 12, si la précision est le mois ou le jour. */
  month?: number;
  day?: number;
  precision: Precision;
  /** Date approximative : « vers 480 av. J.-C. ». */
  circa: boolean;
}

/* ---------- Numérotation astronomique ---------- */

/** -480 → -479 ; -1 → 0 ; 1 → 1. */
export function toAstronomical(year: number): number {
  return year < 0 ? year + 1 : year;
}

/** Inverse de `toAstronomical` : ne produit jamais l'an 0. */
export function fromAstronomical(astronomical: number): number {
  return astronomical <= 0 ? astronomical - 1 : astronomical;
}

/** Décale une année d'un nombre d'années, en sautant l'an 0. */
export function shiftYear(year: number, years: number): number {
  return fromAstronomical(toAstronomical(year) + years);
}

/** Clé de tri chronologique. */
export function chronologicalKey(date: HistoricalDate): number {
  return toAstronomical(date.year) * 10000 + (date.month ?? 0) * 100 + (date.day ?? 0);
}

/** Écart en années entre deux dates (positif si `b` est après `a`). */
export function yearsBetween(a: HistoricalDate, b: HistoricalDate): number {
  return toAstronomical(b.year) - toAstronomical(a.year);
}

/* ---------- Siècles et décennies ---------- */

/** Première année d'un siècle : Ve s. → 401 ; Ve s. av. J.-C. → -500. */
export function centuryStartYear(century: number, beforeChrist: boolean): number {
  return beforeChrist ? -century * 100 : (century - 1) * 100 + 1;
}

/** Numéro de siècle d'une année : 401 → 5 ; -500 → 5. */
export function centuryOf(year: number): number {
  return Math.ceil(Math.abs(year) / 100);
}

/** Décennie d'une année : 1925 → 1920 ; -485 → -480. */
export function decadeOf(year: number): number {
  return Math.sign(year) * Math.floor(Math.abs(year) / 10) * 10;
}

/* ---------- Mise en forme française ---------- */

export const MONTHS = [
  "janvier",
  "février",
  "mars",
  "avril",
  "mai",
  "juin",
  "juillet",
  "août",
  "septembre",
  "octobre",
  "novembre",
  "décembre",
];

/** En dessous de l'an 1000, on précise « apr. J.-C. » pour éviter toute ambiguïté. */
const AD_SUFFIX_BELOW = 1000;

const ROMAN: [number, string][] = [
  [10, "X"],
  [9, "IX"],
  [5, "V"],
  [4, "IV"],
  [1, "I"],
];

export function toRoman(value: number): string {
  let rest = value;
  let result = "";
  for (const [amount, symbol] of ROMAN) {
    while (rest >= amount) {
      result += symbol;
      rest -= amount;
    }
  }
  return result;
}

function eraSuffix(year: number): string {
  if (year < 0) return " av. J.-C.";
  return year < AD_SUFFIX_BELOW ? " apr. J.-C." : "";
}

/** Date sans mention d'ère (« 12 octobre 1492 », « années 1920 », « Ve siècle »). */
function formatWithoutEra(date: HistoricalDate): string {
  const absolute = Math.abs(date.year);
  switch (date.precision) {
    case "day":
      return `${date.day === 1 ? "1er" : date.day} ${MONTHS[(date.month ?? 1) - 1]} ${absolute}`;
    case "month":
      return `${MONTHS[(date.month ?? 1) - 1]} ${absolute}`;
    case "year":
      return String(absolute);
    case "decade":
      return `années ${Math.abs(decadeOf(date.year))}`;
    case "century": {
      const century = centuryOf(date.year);
      return `${toRoman(century)}${century === 1 ? "er" : "e"} siècle`;
    }
  }
}

/** « 331 av. J.-C. », « vers 480 av. J.-C. », « 12 octobre 1492 », « Ve siècle av. J.-C. ». */
export function formatDate(date: HistoricalDate): string {
  const circa = date.circa ? "vers " : "";
  return `${circa}${formatWithoutEra(date)}${eraSuffix(date.year)}`;
}

/**
 * Date ou période : « 1337 – 1453 », « 490 – 479 av. J.-C. »,
 * « 27 av. J.-C. – 14 apr. J.-C. ».
 */
export function formatSpan(start: HistoricalDate, end?: HistoricalDate): string {
  if (!end) return formatDate(start);
  const sameEra = Math.sign(start.year) === Math.sign(end.year) && eraSuffix(start.year) === eraSuffix(end.year);
  if (sameEra && !end.circa) {
    const startText = `${start.circa ? "vers " : ""}${formatWithoutEra(start)}`;
    return `${startText} – ${formatWithoutEra(end)}${eraSuffix(end.year)}`;
  }
  return `${formatDate(start)} – ${formatDate(end)}`;
}

/** Ancienneté approximative : « il y a 2 357 ans ». */
export function formatAge(date: HistoricalDate, currentYear: number): string | undefined {
  const years = currentYear - toAstronomical(date.year);
  if (years < 1) return undefined;
  return `il y a ${new Intl.NumberFormat("fr-FR").format(years)} an${years > 1 ? "s" : ""}`;
}

/* ---------- Validation ---------- */

const DAYS_IN_MONTH = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

export function maxDayOfMonth(month: number): number {
  return DAYS_IN_MONTH[month - 1] ?? 31;
}

/** La date est-elle cohérente ? Renvoie un message d'erreur, ou `undefined`. */
export function dateProblem(date: HistoricalDate): string | undefined {
  if (!Number.isInteger(date.year) || date.year === 0) return "L’année est invalide (il n’y a pas d’an 0).";
  if (date.precision === "day" || date.precision === "month") {
    if (!date.month || date.month < 1 || date.month > 12) return "Le mois est invalide.";
  }
  if (date.precision === "day") {
    if (!date.day || date.day < 1 || date.day > maxDayOfMonth(date.month ?? 1)) return "Le jour est invalide.";
  }
  return undefined;
}
