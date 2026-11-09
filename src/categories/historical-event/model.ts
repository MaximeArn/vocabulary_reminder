import {
  buildChoiceQuestion,
  CHOICE_COUNT,
  type ChoiceQuestion,
  type OrderQuestion,
  type TypedGrade,
  type TypedQuestion,
} from "../../domain/quiz";
import { shuffle, type Random } from "../../domain/random";
import { cleanOptionalText, cleanText, comparisonKey } from "../../domain/text";
import type { Item } from "../../domain/types";
import {
  expectRecord,
  expectText,
  InvalidContentError,
  optionalText,
  type CategoryModel,
  type DraftErrors,
  type Exercise,
} from "../model";
import {
  centuryOf,
  centuryStartYear,
  chronologicalKey,
  dateProblem,
  decadeOf,
  formatDate,
  formatSpan,
  shiftYear,
  toAstronomical,
  type HistoricalDate,
  type Precision,
} from "./dates";

/** Catégorie « Dates historiques » : un événement, sa date ou sa période, son contexte. */

export interface HistoricalEventContent {
  name: string;
  start: HistoricalDate;
  /** Fin, pour une période (« 1337 – 1453 »). */
  end?: HistoricalDate;
  /** Date incertaine ou discutée par les historiens. */
  uncertain: boolean;
  description?: string;
  people: string[];
  source?: string;
  notes?: string;
}

type EventItem = Item<HistoricalEventContent>;

/** Libellé de la date ou de la période d'un événement. */
export function eventDateLabel(content: HistoricalEventContent): string {
  return formatSpan(content.start, content.end);
}

/* ---------- Formulaire ---------- */

export type Era = "bc" | "ad";

/** Saisie d'une date : des chaînes, telles que tapées dans les champs. */
export interface DateDraft {
  precision: Precision;
  day: string;
  month: string;
  /** Année, ou numéro de siècle si la précision est le siècle. Toujours positif : l'ère est à part. */
  year: string;
  era: Era;
  circa: boolean;
}

export interface HistoricalEventDraft {
  name: string;
  start: DateDraft;
  isPeriod: boolean;
  end: DateDraft;
  uncertain: boolean;
  description: string;
  /** Personnages, séparés par des virgules. */
  people: string;
  source: string;
  notes: string;
}

export const emptyDateDraft = (): DateDraft => ({ precision: "year", day: "", month: "", year: "", era: "ad", circa: false });

function draftFromDate(date: HistoricalDate): DateDraft {
  const era: Era = date.year < 0 ? "bc" : "ad";
  return {
    precision: date.precision,
    day: date.day ? String(date.day) : "",
    month: date.month ? String(date.month) : "",
    year: String(date.precision === "century" ? centuryOf(date.year) : Math.abs(date.year)),
    era,
    circa: date.circa,
  };
}

const isWholeNumber = (text: string) => /^\d+$/.test(text.trim());

/** Convertit une saisie en date, ou renvoie le message d'erreur à afficher. */
export function dateFromDraft(draft: DateDraft): HistoricalDate | string {
  if (draft.year.trim() === "") return draft.precision === "century" ? "Indique le siècle." : "Indique l’année.";
  if (!isWholeNumber(draft.year) || Number(draft.year) === 0) {
    return draft.precision === "century" ? "Le siècle doit être un nombre entier." : "L’année doit être un nombre entier (pas d’an 0).";
  }
  const typed = Number(draft.year);
  const beforeChrist = draft.era === "bc";

  let date: HistoricalDate;
  switch (draft.precision) {
    case "century":
      date = { year: centuryStartYear(typed, beforeChrist), precision: "century", circa: draft.circa };
      break;
    case "decade": {
      const decade = decadeOf(typed);
      if (decade === 0) return "Pour une décennie, indique une année d’au moins 10.";
      date = { year: beforeChrist ? -decade : decade, precision: "decade", circa: draft.circa };
      break;
    }
    default:
      date = { year: beforeChrist ? -typed : typed, precision: draft.precision, circa: draft.circa };
      if (draft.precision === "month" || draft.precision === "day") {
        if (!isWholeNumber(draft.month)) return "Choisis le mois.";
        date.month = Number(draft.month);
      }
      if (draft.precision === "day") {
        if (!isWholeNumber(draft.day)) return "Indique le jour.";
        date.day = Number(draft.day);
      }
  }
  return dateProblem(date) ?? date;
}

const splitPeople = (text: string) =>
  text
    .split(/[,;\n]/)
    .map((person) => cleanText(person))
    .filter((person) => person !== "");

/* ---------- Exercices ---------- */

/** Écarts (en années) entre dates plausibles, selon la précision. */
const YEAR_OFFSETS: Record<Precision, number[]> = {
  day: [1, 2, 3, 4, 5, 6, 8, 10],
  month: [1, 2, 3, 4, 5, 6, 8, 10],
  year: [1, 2, 3, 4, 5, 6, 7, 8, 10, 12, 15],
  decade: [10, 20, 30, 40, 50],
  century: [100, 200, 300, 400],
};

/** Plus l'événement est ancien, plus les écarts plausibles sont grands. */
function offsetsFor(date: HistoricalDate, currentYear: number): number[] {
  const offsets = YEAR_OFFSETS[date.precision];
  const age = currentYear - toAstronomical(date.year);
  if (date.precision !== "year" || age < 1000) return offsets;
  return [...offsets, 18, 20];
}

/** Même événement décalé de `years` années (période comprise). */
function shiftedContent(content: HistoricalEventContent, years: number): HistoricalEventContent {
  const shift = (date: HistoricalDate): HistoricalDate => ({ ...date, year: shiftYear(date.year, years) });
  return { ...content, start: shift(content.start), end: content.end && shift(content.end) };
}

function instructionFor(content: HistoricalEventContent): string {
  if (content.end) return "À quelle période ?";
  switch (content.start.precision) {
    case "day":
    case "month":
      return "À quelle date ?";
    case "year":
      return "En quelle année ?";
    default:
      return "À quelle époque ?";
  }
}

/**
 * Retrouver la date d'un événement. Les mauvaises réponses sont des dates
 * plausibles fabriquées autour de la bonne, à la même précision : d'abord les
 * écarts avec d'autres événements proches de la collection, puis des écarts types.
 * Jamais d'an 0, jamais de date future, aucun libellé en double.
 */
export function buildEventToDateQuestion(
  target: EventItem,
  pool: EventItem[],
  random: Random = Math.random,
  currentYear = new Date().getFullYear(),
): ChoiceQuestion | null {
  const content = target.content;
  const offsets = offsetsFor(content.start, currentYear);
  const maxOffset = Math.max(...offsets);

  const fromCollection = pool
    .filter((item) => item.id !== target.id)
    .map((item) => toAstronomical(item.content.start.year) - toAstronomical(content.start.year))
    .filter((years) => years !== 0 && Math.abs(years) <= maxOffset);
  const typical = offsets.flatMap((years) => [years, -years]);
  const candidates = [...shuffle(fromCollection, random), ...shuffle(typical, random)];

  const correctLabel = eventDateLabel(content);
  const usedLabels = new Set([correctLabel]);
  const distractors: { id: string; label: string }[] = [];
  for (const years of candidates) {
    if (distractors.length === CHOICE_COUNT - 1) break;
    const shifted = shiftedContent(content, years);
    const latest = shifted.end ?? shifted.start;
    if (toAstronomical(latest.year) > currentYear) continue;
    const label = eventDateLabel(shifted);
    if (usedLabels.has(label)) continue;
    usedLabels.add(label);
    distractors.push({ id: `décalage:${years}`, label });
  }
  if (distractors.length < CHOICE_COUNT - 1) return null;

  return {
    type: "choice",
    itemId: target.id,
    exercise: eventToDate.id,
    prompt: content.name,
    instruction: instructionFor(content),
    choices: shuffle([{ id: target.id, label: correctLabel }, ...distractors], random),
    correctChoiceId: target.id,
  };
}

/** Événements les plus proches dans le temps parmi lesquels tirer les 3 mauvaises réponses (2 de marge pour varier). */
const NEAREST_EVENTS = 5;

/**
 * Retrouver l'événement d'une date. Les mauvaises réponses sont d'autres
 * événements de la collection, les plus proches dans le temps d'abord.
 * Un événement de même date affichée n'est jamais proposé (il serait correct lui aussi).
 */
export function buildDateToEventQuestion(target: EventItem, pool: EventItem[], random: Random = Math.random): ChoiceQuestion | null {
  const targetLabel = eventDateLabel(target.content);
  const targetKey = chronologicalKey(target.content.start);
  const others = pool
    .filter((item) => item.id !== target.id && eventDateLabel(item.content) !== targetLabel)
    .sort((a, b) => Math.abs(chronologicalKey(a.content.start) - targetKey) - Math.abs(chronologicalKey(b.content.start) - targetKey));

  const build = (candidates: EventItem[]) =>
    buildChoiceQuestion({
      target,
      pool: candidates,
      exercise: dateToEvent.id,
      prompt: targetLabel,
      label: (item) => item.content.name,
      random,
    });
  return build(others.slice(0, NEAREST_EVENTS)) ?? build(others);
}

const eventToDate: Exercise<HistoricalEventContent> = {
  id: "historical-event.event-to-date",
  mode: "choice",
  label: "La date",
  instruction: "Quand ?",
  promptStyle: "headline",
  choiceStyle: "short",
  build: (target, pool, random) => buildEventToDateQuestion(target, pool, random),
};

const dateToEvent: Exercise<HistoricalEventContent> = {
  id: "historical-event.date-to-event",
  mode: "choice",
  label: "L’événement",
  instruction: "Quel événement ?",
  promptStyle: "headline",
  choiceStyle: "short",
  build: (target, pool, random) => buildDateToEventQuestion(target, pool, random),
};

/* ---------- Taper l'année ---------- */

/** Seules les dates connues à l'année près se prêtent à une saisie exacte. */
const typableYear = (content: HistoricalEventContent) => ["day", "month", "year"].includes(content.start.precision);

/** Libellé d'une année seule : « 1789 », « 331 av. J.-C. ». */
const yearLabel = (year: number) => formatDate({ year, precision: "year", circa: false });

/**
 * Corrige une année tapée (année historienne : « -331 » pour 331 av. J.-C.).
 * Seule l'année exacte est juste ; l'écart est indiqué.
 */
export function gradeTypedYear(answer: string, expected: number): TypedGrade {
  const year = Number(answer.trim());
  if (!Number.isInteger(year) || year === 0) return { correct: false, exact: false };
  if (year === expected) return { correct: true, exact: true };
  if (year === -expected) {
    return { correct: false, exact: false, detail: `Bonne année, mais ${expected < 0 ? "avant" : "après"} J.-C.` };
  }
  const gap = toAstronomical(year) - toAstronomical(expected);
  const years = Math.abs(gap);
  return { correct: false, exact: false, detail: `${years} ${years > 1 ? "ans" : "an"} trop ${gap < 0 ? "tôt" : "tard"}` };
}

export function buildTypedYearQuestion(target: EventItem): TypedQuestion | null {
  const content = target.content;
  if (!typableYear(content)) return null;
  const year = content.start.year;
  return {
    type: "typed",
    itemId: target.id,
    exercise: typedYear.id,
    prompt: content.name,
    instruction: content.end ? "En quelle année commence-t-elle ?" : "En quelle année ?",
    input: "year",
    expected: yearLabel(year),
    grade: (answer) => gradeTypedYear(answer, year),
  };
}

const typedYear: Exercise<HistoricalEventContent> = {
  id: "historical-event.event-to-year-typed",
  mode: "typed",
  follows: eventToDate.id,
  accepts: (target) => typableYear(target.content),
  label: "L’année, tapée",
  instruction: "En quelle année ?",
  promptStyle: "headline",
  choiceStyle: "short",
  build: (target) => buildTypedYearQuestion(target),
};

/* ---------- Remettre dans l'ordre ---------- */

/** Nombre d'événements à classer. */
export const ORDER_SIZE = 4;
/** Événements les plus proches parmi lesquels choisir les autres (de quoi varier, sans rendre la question triviale). */
const ORDER_NEIGHBOURS = 8;

const UNITS_PER_YEAR = 400;
/** Marge d'une date « vers… », en années, selon sa précision. */
const CIRCA_MARGIN: Record<Precision, number> = { day: 5, month: 5, year: 5, decade: 10, century: 25 };

/**
 * Intervalle de temps que recouvre le début d'un événement, selon sa précision
 * (un siècle couvre cent ans, « vers 480 » quelques années de part et d'autre).
 * Deux événements dont les intervalles se chevauchent ne peuvent pas être classés.
 */
export function timeSpan(date: HistoricalDate): [number, number] {
  const year = toAstronomical(date.year) * UNITS_PER_YEAR;
  let span: [number, number];
  switch (date.precision) {
    case "day": {
      const point = year + (date.month ?? 1) * 32 + (date.day ?? 1);
      span = [point, point];
      break;
    }
    case "month": {
      const month = year + (date.month ?? 1) * 32;
      span = [month, month + 31];
      break;
    }
    case "year":
      span = [year, year + UNITS_PER_YEAR - 1];
      break;
    case "decade":
      // Avant J.-C., « les années 480 » courent de 489 à 480 : on couvre les deux sens.
      span = date.year < 0 ? [year - 9 * UNITS_PER_YEAR, year + 10 * UNITS_PER_YEAR - 1] : [year, year + 10 * UNITS_PER_YEAR - 1];
      break;
    case "century":
      span = [year, year + 100 * UNITS_PER_YEAR - 1];
      break;
  }
  if (!date.circa) return span;
  const margin = CIRCA_MARGIN[date.precision] * UNITS_PER_YEAR;
  return [span[0] - margin, span[1] + margin];
}

const overlaps = (a: [number, number], b: [number, number]) => a[0] <= b[1] && b[0] <= a[1];

/**
 * Remettre quatre événements dans l'ordre chronologique (selon leur début).
 * Les trois autres sont choisis parmi les plus proches dans le temps, sans
 * ambiguïté possible : leurs dates ne se recouvrent pas.
 */
export function buildOrderQuestion(target: EventItem, pool: EventItem[], random: Random = Math.random): OrderQuestion | null {
  const spanOf = (item: EventItem) => timeSpan(item.content.start);
  const middle = (item: EventItem) => (spanOf(item)[0] + spanOf(item)[1]) / 2;
  const targetMiddle = middle(target);
  const candidates = pool
    .filter((item) => item.id !== target.id && !overlaps(spanOf(item), spanOf(target)))
    .sort((a, b) => Math.abs(middle(a) - targetMiddle) - Math.abs(middle(b) - targetMiddle));

  const pick = (from: EventItem[]) => {
    const chosen = [target];
    for (const candidate of from) {
      if (chosen.length === ORDER_SIZE) break;
      const distinctName = chosen.every((item) => comparisonKey(item.content.name) !== comparisonKey(candidate.content.name));
      if (distinctName && chosen.every((item) => !overlaps(spanOf(item), spanOf(candidate)))) chosen.push(candidate);
    }
    return chosen.length === ORDER_SIZE ? chosen : null;
  };
  const chosen =
    pick(shuffle(candidates.slice(0, ORDER_NEIGHBOURS), random)) ?? pick([...candidates.slice(0, ORDER_NEIGHBOURS), ...candidates.slice(ORDER_NEIGHBOURS)]);
  if (!chosen) return null;

  const chronological = [...chosen].sort((a, b) => spanOf(a)[0] - spanOf(b)[0]);
  return {
    type: "order",
    itemId: target.id,
    exercise: chronologicalOrder.id,
    prompt: "Du plus ancien au plus récent",
    entries: shuffle(chosen, random).map((item) => ({
      itemId: item.id,
      label: item.content.name,
      detail: eventDateLabel(item.content),
      rank: chronological.indexOf(item),
    })),
  };
}

const chronologicalOrder: Exercise<HistoricalEventContent> = {
  id: "historical-event.chronological-order",
  mode: "order",
  label: "Remettre dans l’ordre",
  instruction: "Remets dans l’ordre",
  promptStyle: "text",
  choiceStyle: "short",
  build: (target, pool, random) => buildOrderQuestion(target, pool, random),
};

/* ---------- Validation d'un contenu venu de l'extérieur ---------- */

const PRECISIONS: Precision[] = ["day", "month", "year", "decade", "century"];

function validateDate(raw: unknown, field: string): HistoricalDate {
  const record = expectRecord(raw);
  const precision = record.precision as Precision;
  if (!PRECISIONS.includes(precision)) throw new InvalidContentError(`La précision de « ${field} » est invalide.`);
  const date: HistoricalDate = { year: Number(record.year), precision, circa: record.circa === true };
  if (typeof record.month === "number") date.month = record.month;
  if (typeof record.day === "number") date.day = record.day;
  const problem = dateProblem(date);
  if (problem) throw new InvalidContentError(`« ${field} » : ${problem}`);
  return date;
}

export const historicalEventModel: CategoryModel<HistoricalEventContent, HistoricalEventDraft> = {
  kind: "historical-event",
  label: "Dates",
  unit: { singular: "date", plural: "dates" },
  addLabel: "Une date historique",
  newItemTitle: "Nouvelle date",
  addedMessage: (title) => `Date ajoutée : « ${title} »`,
  color: "var(--dates)",
  softColor: "var(--dates-soft)",
  fillColor: "var(--dates-fill)",
  onFillColor: "var(--on-dates-fill)",
  searchPlaceholder: "Rechercher un événement, une date, un personnage…",
  listStyle: "timeline",
  chronologicalKey: (content) => chronologicalKey(content.start),

  validateContent(raw) {
    const record = expectRecord(raw);
    const people = Array.isArray(record.people) ? record.people.filter((person) => typeof person === "string") : [];
    return {
      name: expectText(record, "name"),
      start: validateDate(record.start, "start"),
      end: record.end === undefined || record.end === null ? undefined : validateDate(record.end, "end"),
      uncertain: record.uncertain === true,
      description: optionalText(record, "description"),
      people,
      source: optionalText(record, "source"),
      notes: optionalText(record, "notes"),
    };
  },

  title: (content) => content.name,
  subtitle: (content) => eventDateLabel(content),
  searchTexts: (content) =>
    [content.name, eventDateLabel(content), content.description, ...content.people, content.source, content.notes].filter(
      (text): text is string => text !== undefined,
    ),

  exercises: [eventToDate, dateToEvent, typedYear, chronologicalOrder],
  // Retrouver la date fonctionne dès le premier événement (les dates proposées sont fabriquées).
  canBuildQuestions: (items) => items.length > 0,

  emptyDraft: () => ({
    name: "",
    start: emptyDateDraft(),
    isPeriod: false,
    end: emptyDateDraft(),
    uncertain: false,
    description: "",
    people: "",
    source: "",
    notes: "",
  }),
  draftFrom: (content) => ({
    name: content.name,
    start: draftFromDate(content.start),
    isPeriod: content.end !== undefined,
    end: content.end ? draftFromDate(content.end) : emptyDateDraft(),
    uncertain: content.uncertain,
    description: content.description ?? "",
    people: content.people.join(", "),
    source: content.source ?? "",
    notes: content.notes ?? "",
  }),
  validateDraft: (draft) => {
    const errors: DraftErrors = {};
    if (cleanText(draft.name) === "") errors.name = "Indique l’événement.";
    const start = dateFromDraft(draft.start);
    if (typeof start === "string") errors.start = start;
    if (draft.isPeriod) {
      const end = dateFromDraft(draft.end);
      if (typeof end === "string") errors.end = end;
      else if (typeof start !== "string" && chronologicalKey(end) < chronologicalKey(start)) {
        errors.end = "La fin doit être postérieure au début.";
      }
    }
    return errors;
  },
  contentFrom: (draft) => {
    const start = dateFromDraft(draft.start);
    const end = draft.isPeriod ? dateFromDraft(draft.end) : undefined;
    if (typeof start === "string" || typeof end === "string") throw new InvalidContentError("Date invalide.");
    return {
      name: cleanText(draft.name),
      start,
      end,
      uncertain: draft.uncertain,
      description: cleanOptionalText(draft.description),
      people: splitPeople(draft.people),
      source: cleanOptionalText(draft.source),
      notes: cleanOptionalText(draft.notes),
    };
  },
};

/** Pour la détection de doublons à la saisie. */
export function findSameEvent(items: EventItem[], name: string, excludedId?: string): EventItem | undefined {
  const key = comparisonKey(name);
  if (key === "") return undefined;
  return items.find((item) => item.id !== excludedId && comparisonKey(item.content.name) === key);
}
