import type { Card } from "./card";
import { isDue } from "./srs";
import { shuffle, type Random } from "./random";

/** Composition d'une session de révision, toutes catégories confondues. */

export const DEFAULT_SESSION_SIZE = 5;
export const SESSION_SIZES = [5, 10, 15, 20];

export interface SessionItem {
  itemId: string;
  exercise: string;
}

/**
 * Choisit les cartes d'une session, par priorité :
 * 1. les cartes à réviser, de la plus en retard à la moins en retard (les plus fragiles d'abord) ;
 * 2. les nouvelles cartes, de la plus ancienne à la plus récente ;
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
): SessionItem[] {
  const due = cards.filter((card) => isDue(card.progress, today) && card.progress.box > 0).sort(byUrgency);
  const fresh = cards
    .filter((card) => card.progress.box === 0 && isDue(card.progress, today))
    .sort((a, b) => a.item.createdAt - b.item.createdAt);
  const upcoming = cards.filter((card) => !isDue(card.progress, today)).sort(byUrgency);

  return assignExercises(shuffle([...due, ...fresh, ...upcoming].slice(0, size), random), chooseExercise, random);
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

/** Nombre de cartes à réviser aujourd'hui (nouvelles comprises). */
export function countDue(cards: Card[], today: string): number {
  return cards.filter((card) => isDue(card.progress, today)).length;
}

/** Prochain jour où des cartes seront à réviser, s'il n'y en a pas aujourd'hui. */
export function nextDueDay(cards: Card[], today: string): string | undefined {
  return cards
    .map((card) => card.progress.dueDay)
    .filter((day) => day > today)
    .sort()[0];
}

/* ---------- Entraînements (accès rapides) ---------- */

/**
 * Révisions ciblées, en plus de la révision du jour. Ce sont des entraînements :
 * une bonne réponse sur une fiche pas encore due ne fait pas avancer son planning
 * (règle de `nextSchedule`), une erreur compte toujours.
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
