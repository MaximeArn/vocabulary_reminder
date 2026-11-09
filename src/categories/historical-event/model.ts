import { buildChoiceQuestion, CHOICE_COUNT, type Question } from "../../domain/quiz";
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
): Question | null {
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
export function buildDateToEventQuestion(target: EventItem, pool: EventItem[], random: Random = Math.random): Question | null {
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
  label: "La date",
  instruction: "Quand ?",
  promptStyle: "headline",
  choiceStyle: "short",
  build: (target, pool, random) => buildEventToDateQuestion(target, pool, random),
};

const dateToEvent: Exercise<HistoricalEventContent> = {
  id: "historical-event.date-to-event",
  label: "L’événement",
  instruction: "Quel événement ?",
  promptStyle: "headline",
  choiceStyle: "short",
  build: (target, pool, random) => buildDateToEventQuestion(target, pool, random),
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

  exercises: [eventToDate, dateToEvent],
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
