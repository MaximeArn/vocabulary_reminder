import { addDays } from "./studyDay";
import type { Word } from "./types";

/**
 * Répétition espacée, système de Leitner.
 *
 * Chaque mot est dans une « boîte » de 0 à 6. Une bonne réponse le fait monter
 * d'une boîte, ce qui espace sa prochaine révision ; une erreur le renvoie en
 * boîte 1 : il revient dès le lendemain.
 *
 * Le QCM ne donne qu'un signal juste / faux : Leitner s'y prête mieux que SM-2,
 * qui attend une note de difficulté. L'historique complet des réponses est
 * conservé, ce qui permettra de changer d'algorithme sans rien perdre.
 */

/** Intervalle (en jours) avant la prochaine révision, selon la boîte atteinte. */
const BOX_INTERVAL_DAYS = [0, 1, 3, 7, 15, 30, 90];

export const MAX_BOX = BOX_INTERVAL_DAYS.length - 1;

/** À partir de cette boîte (un mois d'intervalle), le mot est considéré comme maîtrisé. */
export const MASTERED_BOX = 5;

export function intervalForBox(box: number): number {
  return BOX_INTERVAL_DAYS[Math.min(Math.max(box, 0), MAX_BOX)] ?? 0;
}

export interface Schedule {
  box: number;
  dueDay: string;
  lapses: number;
}

/** Le mot doit-il être révisé aujourd'hui ? (Les nouveaux mots le sont dès leur ajout.) */
export function isDue(word: Pick<Word, "dueDay">, today: string): boolean {
  return word.dueDay <= today;
}

/**
 * Nouveau planning d'un mot après une réponse.
 * Un mot révisé en avance (entraînement libre) ne monte pas de boîte :
 * l'algorithme reste honnête. Une erreur compte toujours.
 */
export function nextSchedule(word: Pick<Word, "box" | "dueDay" | "lapses">, correct: boolean, today: string): Schedule {
  if (!correct) {
    return { box: 1, dueDay: addDays(today, intervalForBox(1)), lapses: word.lapses + 1 };
  }
  if (!isDue(word, today)) {
    return { box: word.box, dueDay: word.dueDay, lapses: word.lapses };
  }
  const box = Math.min(word.box + 1, MAX_BOX);
  return { box, dueDay: addDays(today, intervalForBox(box)), lapses: word.lapses };
}

/* ---------- Niveaux de maîtrise, pour l'affichage ---------- */

export type MasteryLevel = "new" | "learning" | "progressing" | "mastered";

export const MASTERY_LEVELS: MasteryLevel[] = ["new", "learning", "progressing", "mastered"];

export const MASTERY_LABELS: Record<MasteryLevel, string> = {
  new: "Nouveau",
  learning: "En apprentissage",
  progressing: "En bonne voie",
  mastered: "Maîtrisé",
};

export function masteryLevel(box: number): MasteryLevel {
  if (box === 0) return "new";
  if (box <= 2) return "learning";
  if (box < MASTERED_BOX) return "progressing";
  return "mastered";
}
