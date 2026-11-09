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
 * L'ordre des questions est ensuite mélangé, et les types d'exercice alternent.
 *
 * `exercisesFor` donne les exercices possibles pour une carte (selon sa catégorie
 * et les préférences de l'utilisateur).
 */
export function planSession(
  cards: Card[],
  today: string,
  size: number,
  exercisesFor: (card: Card) => string[],
  random: Random = Math.random,
): SessionItem[] {
  const due = cards.filter((card) => isDue(card.progress, today) && card.progress.box > 0).sort(byUrgency);
  const fresh = cards
    .filter((card) => card.progress.box === 0 && isDue(card.progress, today))
    .sort((a, b) => a.item.createdAt - b.item.createdAt);
  const upcoming = cards.filter((card) => !isDue(card.progress, today)).sort(byUrgency);

  const selected = shuffle([...due, ...fresh, ...upcoming].slice(0, size), random);
  const offset = random() < 0.5 ? 0 : 1;

  const items: SessionItem[] = [];
  selected.forEach((card, index) => {
    const exercises = exercisesFor(card);
    const exercise = exercises[(index + offset) % Math.max(exercises.length, 1)];
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
