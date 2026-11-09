import { centuryStartYear, dateProblem, decadeOf, MONTHS, type HistoricalDate } from "./dates";

/**
 * Lecture d'une date écrite librement, comme dans des notes de lecture :
 * « 331 av. J.-C. », « -331 », « vers 480 av. J.-C. », « 14 juillet 1789 »,
 * « juillet 1789 », « Ve siècle av. J.-C. », « années 1920 », « 1337-1453 »,
 * « 490 – 479 av. J.-C. », « 27 av. J.-C. – 14 apr. J.-C. ».
 * Renvoie `null` si le texte n'est pas une date valide (an 0, 30 février…).
 */

export interface ParsedDates {
  start: HistoricalDate;
  end?: HistoricalDate;
}

type Era = "bc" | "ad" | undefined;

const BEFORE_CHRIST = /\s*(av\.?|avant)\s*(j\.?\s*-?\s*c\.?|jésus[\s-]*christ|notre\s+ère|n\.\s*è\.)\s*$/i;
const AFTER_CHRIST = /\s*(apr\.?|après)\s*(j\.?\s*-?\s*c\.?|jésus[\s-]*christ|notre\s+ère|n\.\s*è\.)\s*$/i;
const CIRCA = /^(vers|env\.?|environ|v\.|c\.|~)\s*/i;
const ROMAN_VALUES: Record<string, number> = { i: 1, v: 5, x: 10, l: 50, c: 100 };

function fromRoman(text: string): number | undefined {
  const letters = text.toLowerCase();
  if (!/^[ivxlc]+$/.test(letters)) return undefined;
  let total = 0;
  for (let index = 0; index < letters.length; index++) {
    const value = ROMAN_VALUES[letters[index]!]!;
    const next = ROMAN_VALUES[letters[index + 1] ?? ""] ?? 0;
    total += value < next ? -value : value;
  }
  return total;
}

/** Retire l'ère écrite en fin de texte. */
function splitEra(text: string): { text: string; era: Era } {
  if (BEFORE_CHRIST.test(text)) return { text: text.replace(BEFORE_CHRIST, "").trim(), era: "bc" };
  if (AFTER_CHRIST.test(text)) return { text: text.replace(AFTER_CHRIST, "").trim(), era: "ad" };
  return { text: text.trim(), era: undefined };
}

/** Une date seule (sans période), avec l'ère par défaut si le texte n'en précise pas. */
function parseSingle(raw: string, defaultEra: Era): HistoricalDate | null {
  let { text, era } = splitEra(raw);
  era = era ?? defaultEra;
  const circa = CIRCA.test(text);
  text = text.replace(CIRCA, "").trim().toLowerCase();
  const sign = (year: number) => (era === "bc" || year < 0 ? -Math.abs(year) : year);

  let date: HistoricalDate | null = null;
  let match: RegExpMatchArray | null;
  if ((match = text.match(/^années\s+(-?\d{2,4})$/))) {
    date = { year: sign(decadeOf(Math.abs(Number(match[1])))), precision: "decade", circa };
  } else if ((match = text.match(/^([ivxlc]+|\d{1,2})\s*(?:e|er|ème|è)\s+(?:siècle|s\.)$/))) {
    const century = fromRoman(match[1]!) ?? Number(match[1]);
    date = { year: centuryStartYear(century, era === "bc"), precision: "century", circa };
  } else if ((match = text.match(/^(1er|\d{1,2})\s+([a-zéû]+)\s+(-?\d{1,4})$/))) {
    const month = MONTHS.indexOf(match[2]!) + 1;
    if (month === 0) return null;
    const day = match[1] === "1er" ? 1 : Number(match[1]);
    date = { year: sign(Number(match[3])), month, day, precision: "day", circa };
  } else if ((match = text.match(/^([a-zéû]+)\s+(-?\d{1,4})$/))) {
    const month = MONTHS.indexOf(match[1]!) + 1;
    if (month === 0) return null;
    date = { year: sign(Number(match[2])), month, precision: "month", circa };
  } else if ((match = text.match(/^(-?\d{1,4})$/))) {
    date = { year: sign(Number(match[1])), precision: "year", circa };
  }
  if (!date || dateProblem(date)) return null;
  return date;
}

export function parseDateText(raw: string): ParsedDates | null {
  const text = raw.trim().replace(/\s+/g, " ");
  if (text === "") return null;

  // Période : deux dates séparées par un tiret. Le tiret peut aussi appartenir à « J.-C. » :
  // on essaie chaque séparateur possible et on garde le premier où les deux côtés sont des dates.
  for (const separator of text.matchAll(/\s*(?:–|—|-|\bà\b)\s*/g)) {
    const index = separator.index ?? 0;
    if (index === 0) continue; // signe moins d'une année négative
    const left = text.slice(0, index);
    const right = text.slice(index + separator[0].length);
    if (right === "") continue;
    // « 490 – 479 av. J.-C. » : l'ère de la fin vaut aussi pour le début s'il n'en a pas.
    const rightEra = splitEra(right).era;
    const start = parseSingle(left, splitEra(left).era ?? (rightEra === "bc" ? "bc" : undefined));
    const end = parseSingle(right, undefined);
    if (start && end) return { start, end };
  }

  const single = parseSingle(text, undefined);
  return single ? { start: single } : null;
}
