import { isDue } from "./srs";
import { shuffle, type Random } from "./random";
import type { QuizMode, Word } from "./types";

/** Composition d'une session de révision. */

export type SessionMode = QuizMode | "mixed";

export const SESSION_MODE_LABELS: Record<SessionMode, string> = {
  mixed: "Les deux",
  "word-to-definition": "La définition",
  "definition-to-word": "Le mot",
};

export const DEFAULT_SESSION_SIZE = 5;
export const SESSION_SIZES = [5, 10, 15, 20];

export interface SessionItem {
  wordId: string;
  mode: QuizMode;
}

/**
 * Choisit les mots d'une session, par priorité :
 * 1. les mots à réviser, du plus en retard au moins en retard (les plus fragiles d'abord) ;
 * 2. les nouveaux mots, du plus ancien au plus récent ;
 * 3. si la session n'est pas pleine, de l'entraînement sur les prochains mots à réviser.
 * L'ordre des questions est ensuite mélangé.
 */
export function planSession(
  words: Word[],
  today: string,
  size: number,
  mode: SessionMode,
  random: Random = Math.random,
): SessionItem[] {
  const due = words.filter((word) => isDue(word, today) && word.box > 0).sort(byUrgency);
  const fresh = words.filter((word) => word.box === 0 && isDue(word, today)).sort((a, b) => a.createdAt - b.createdAt);
  const upcoming = words.filter((word) => !isDue(word, today)).sort(byUrgency);

  const selected = shuffle([...due, ...fresh, ...upcoming].slice(0, size), random);
  const startWithDefinition = random() < 0.5;

  return selected.map((word, index) => ({
    wordId: word.id,
    mode: modeForQuestion(mode, index, startWithDefinition),
  }));
}

function byUrgency(a: Word, b: Word): number {
  return a.dueDay.localeCompare(b.dueDay) || a.box - b.box;
}

/** En mode mixte, les deux sens alternent d'une question à l'autre. */
function modeForQuestion(mode: SessionMode, index: number, startWithDefinition: boolean): QuizMode {
  if (mode !== "mixed") return mode;
  const definitionFirst = index % 2 === 0 ? startWithDefinition : !startWithDefinition;
  return definitionFirst ? "word-to-definition" : "definition-to-word";
}

/** Nombre de mots à réviser aujourd'hui (nouveaux mots compris). */
export function countDue(words: Word[], today: string): number {
  return words.filter((word) => isDue(word, today)).length;
}

/** Prochain jour où des mots seront à réviser, s'il n'y en a pas aujourd'hui. */
export function nextDueDay(words: Word[], today: string): string | undefined {
  return words
    .map((word) => word.dueDay)
    .filter((day) => day > today)
    .sort()[0];
}
