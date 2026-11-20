import type { Card } from "./card";
import { isDue } from "./srs";
import { addDays } from "./studyDay";
import { shuffle, type Random } from "./random";

/** Composition d'une session de révision, toutes catégories confondues. */

export const DEFAULT_SESSION_SIZE = 5;
export const SESSION_SIZES = [5, 10, 15, 20];

export interface SessionItem {
  itemId: string;
  exercise: string;
}

/**
 * Nombre maximal de nouvelles fiches par jour pour une catégorie (`undefined` : pas
 * de limite). Les catégories intégrées (101 départements disponibles d'office) font
 * entrer leurs fiches peu à peu dans la révision du jour.
 */
export type NewPerDay = (kind: string) => number | undefined;
const noLimit: NewPerDay = () => undefined;

/** Ordre d'arrivée des nouvelles cartes : par ajout ; les volets d'une même fiche arrivent ensemble. */
const byCreation = (a: Card, b: Card) =>
  a.item.createdAt - b.item.createdAt || a.item.id.localeCompare(b.item.id) || (a.track ?? "").localeCompare(b.track ?? "");

/** Nouvelles fiches (jamais révisées, ajoutées), en séparant celles admises aujourd'hui des autres. */
function freshCards(cards: Card[], today: string, newPerDay: NewPerDay): { allowed: Card[]; waiting: Card[] } {
  const introducedToday = new Map<string, number>();
  for (const card of cards) {
    if (card.progress.firstReviewDay === today) {
      introducedToday.set(card.item.kind, (introducedToday.get(card.item.kind) ?? 0) + 1);
    }
  }
  const allowed: Card[] = [];
  const waiting: Card[] = [];
  const taken = new Map<string, number>();
  for (const card of cards.filter((c) => c.progress.box === 0 && isDue(c.progress, today)).sort(byCreation)) {
    const kind = card.item.kind;
    const limit = newPerDay(kind);
    const count = taken.get(kind) ?? 0;
    if (limit === undefined || count < limit - (introducedToday.get(kind) ?? 0)) {
      allowed.push(card);
      taken.set(kind, count + 1);
    } else {
      waiting.push(card);
    }
  }
  return { allowed, waiting };
}

/** Fiches de la révision du jour : celles à revoir, puis les nouvelles admises aujourd'hui. */
export function dailyCards(cards: Card[], today: string, newPerDay: NewPerDay = noLimit): Card[] {
  const due = cards.filter((card) => isDue(card.progress, today) && card.progress.box > 0).sort(byUrgency);
  return [...due, ...freshCards(cards, today, newPerDay).allowed];
}

/**
 * Choisit les cartes d'une session, par priorité :
 * 1. les cartes à réviser, de la plus en retard à la moins en retard (les plus fragiles d'abord) ;
 * 2. les nouvelles cartes, de la plus ancienne à la plus récente (dans la limite du jour) ;
 * 3. si la session n'est pas pleine, de l'entraînement sur les prochaines cartes à réviser.
 * L'ordre des questions est ensuite mélangé.
 *
 * `chooseExercise` donne l'exercice d'une carte (selon sa catégorie, son niveau et
 * les préférences de l'utilisateur) ; `rotation` permet d'alterner les exercices.
 */
export type ExerciseChooser = (card: Card, rotation: number) => string | undefined;

export function planSession(
  cards: Card[],
  today: string,
  size: number,
  chooseExercise: ExerciseChooser,
  random: Random = Math.random,
  newPerDay: NewPerDay = noLimit,
): SessionItem[] {
  const daily = dailyCards(cards, today, newPerDay);
  const upcoming = cards.filter((card) => !isDue(card.progress, today)).sort(byUrgency);
  return assignExercises(shuffle([...daily, ...upcoming].slice(0, size), random), chooseExercise, random);
}

/** Associe à chaque carte son exercice ; l'alternance commence au hasard. */
function assignExercises(cards: Card[], chooseExercise: ExerciseChooser, random: Random): SessionItem[] {
  const offset = random() < 0.5 ? 0 : 1;
  const items: SessionItem[] = [];
  cards.forEach((card, index) => {
    const exercise = chooseExercise(card, index + offset);
    if (exercise) items.push({ itemId: card.item.id, exercise });
  });
  return items;
}

function byUrgency(a: Card, b: Card): number {
  return a.progress.dueDay.localeCompare(b.progress.dueDay) || a.progress.box - b.progress.box;
}

/** Nombre de cartes de la révision du jour (nouvelles admises comprises). */
export function countDue(cards: Card[], today: string, newPerDay: NewPerDay = noLimit): number {
  return dailyCards(cards, today, newPerDay).length;
}

/**
 * Prochain jour où des cartes seront à réviser, s'il n'y en a pas aujourd'hui :
 * demain si de nouvelles fiches attendent leur tour (limite du jour atteinte).
 */
export function nextDueDay(cards: Card[], today: string, newPerDay: NewPerDay = noLimit): string | undefined {
  if (freshCards(cards, today, newPerDay).waiting.length > 0) return addDays(today, 1);
  return cards
    .map((card) => card.progress.dueDay)
    .filter((day) => day > today)
    .sort()[0];
}

/* ---------- Entraînements (accès rapides) ---------- */

/**
 * Révisions ciblées, en plus de la révision du jour. Leurs réponses comptent
 * comme les autres : une bonne réponse fait progresser la fiche (une fois par
 * jour au plus, règle de `nextSchedule`), une erreur la renvoie en apprentissage.
 */
export type PracticeKind = "forgotten" | "recent" | "random";

/** Une fiche est une « nouveauté » pendant les 7 jours qui suivent son ajout. */
export const RECENT_DAYS = 7;
const DAY_MS = 24 * 60 * 60 * 1000;

/** Cartes concernées par un entraînement, par ordre de priorité. */
export function practiceCandidates(cards: Card[], kind: PracticeKind, now: number): Card[] {
  switch (kind) {
    case "forgotten":
      // Les plus souvent oubliées d'abord ; à égalité, celles revues il y a le plus longtemps.
      return cards
        .filter((card) => card.progress.lapses > 0)
        .sort(
          (a, b) =>
            b.progress.lapses - a.progress.lapses || (a.progress.lastReviewedAt ?? 0) - (b.progress.lastReviewedAt ?? 0),
        );
    case "recent":
      return cards.filter((card) => now - card.item.createdAt <= RECENT_DAYS * DAY_MS).sort((a, b) => b.item.createdAt - a.item.createdAt);
    case "random":
      return cards;
  }
}

/** Compose un entraînement : les cartes prioritaires (ou tirées au hasard), questions mélangées. */
export function planPractice(
  cards: Card[],
  kind: PracticeKind,
  size: number,
  now: number,
  chooseExercise: ExerciseChooser,
  random: Random = Math.random,
): SessionItem[] {
  const candidates = practiceCandidates(cards, kind, now);
  if (kind === "random") return planDraw(candidates, size, chooseExercise, random);
  return assignExercises(shuffle(candidates.slice(0, size), random), chooseExercise, random);
}

/** Entraînement sur un tirage au hasard parmi ces cartes (une époque, par exemple). */
export function planDraw(cards: Card[], size: number, chooseExercise: ExerciseChooser, random: Random = Math.random): SessionItem[] {
  return assignExercises(shuffle(cards, random).slice(0, size), chooseExercise, random);
}
