import { addDays, studyDayOf } from "./studyDay";
import type { Item, Review } from "./types";

/**
 * Répétition espacée, système de Leitner — moteur commun à toutes les catégories.
 *
 * Chaque fiche est dans une « boîte » de 0 à 6. Une bonne réponse la fait monter
 * d'une boîte, ce qui espace sa prochaine révision ; une erreur la renvoie en
 * boîte 1 : elle revient dès le lendemain.
 *
 * La progression n'est pas stockée : elle est recalculée en rejouant l'historique
 * des réponses. Deux appareils qui ont révisé hors ligne n'entrent donc jamais en
 * conflit (on réunit leurs historiques), et l'algorithme pourra changer sans rien perdre.
 */

/** Intervalle (en jours) avant la prochaine révision, selon la boîte atteinte. */
const BOX_INTERVAL_DAYS = [0, 1, 3, 7, 15, 30, 90];

export const MAX_BOX = BOX_INTERVAL_DAYS.length - 1;

/** À partir de cette boîte (un mois d'intervalle), la fiche est considérée comme maîtrisée. */
export const MASTERED_BOX = 5;

export function intervalForBox(box: number): number {
  return BOX_INTERVAL_DAYS[Math.min(Math.max(box, 0), MAX_BOX)] ?? 0;
}

export interface Schedule {
  box: number;
  dueDay: string;
  lapses: number;
}

/** Progression d'une fiche, calculée à partir de son historique. */
export interface Progress extends Schedule {
  correctCount: number;
  wrongCount: number;
  lastReviewedAt?: number;
}

/** La fiche doit-elle être révisée ce jour-là ? (Une nouvelle fiche l'est dès son ajout.) */
export function isDue(schedule: Pick<Schedule, "dueDay">, today: string): boolean {
  return schedule.dueDay <= today;
}

/**
 * Nouveau planning après une réponse.
 * Une fiche révisée en avance (entraînement libre) ne monte pas de boîte :
 * l'algorithme reste honnête. Une erreur compte toujours.
 */
export function nextSchedule(schedule: Schedule, correct: boolean, today: string): Schedule {
  if (!correct) {
    return { box: 1, dueDay: addDays(today, intervalForBox(1)), lapses: schedule.lapses + 1 };
  }
  if (!isDue(schedule, today)) {
    return { box: schedule.box, dueDay: schedule.dueDay, lapses: schedule.lapses };
  }
  const box = Math.min(schedule.box + 1, MAX_BOX);
  return { box, dueDay: addDays(today, intervalForBox(box)), lapses: schedule.lapses };
}

/** Progression d'une fiche jamais révisée : à réviser dès le jour de son ajout. */
export function initialProgress(createdAt: number): Progress {
  return {
    box: 0,
    dueDay: studyDayOf(new Date(createdAt)),
    lapses: 0,
    correctCount: 0,
    wrongCount: 0,
  };
}

/** Applique une réponse à une progression. */
export function applyReview(progress: Progress, review: Pick<Review, "correct" | "studyDay" | "answeredAt">): Progress {
  return {
    ...nextSchedule(progress, review.correct, review.studyDay),
    correctCount: progress.correctCount + (review.correct ? 1 : 0),
    wrongCount: progress.wrongCount + (review.correct ? 0 : 1),
    lastReviewedAt: review.answeredAt,
  };
}

/** Rejoue l'historique d'une fiche, dans l'ordre chronologique. */
export function replayProgress(createdAt: number, reviews: Review[]): Progress {
  return [...reviews].sort(byAnswerOrder).reduce(applyReview, initialProgress(createdAt));
}

/** Progression de chaque fiche, à partir de l'historique complet. */
export function progressByItem(items: Pick<Item, "id" | "createdAt">[], reviews: Review[]): Map<string, Progress> {
  const reviewsByItem = new Map<string, Review[]>();
  for (const review of reviews) {
    const list = reviewsByItem.get(review.itemId);
    if (list) list.push(review);
    else reviewsByItem.set(review.itemId, [review]);
  }
  return new Map(items.map((item) => [item.id, replayProgress(item.createdAt, reviewsByItem.get(item.id) ?? [])]));
}

/** Ordre stable : par heure de réponse, puis par identifiant en cas d'égalité. */
function byAnswerOrder(a: Review, b: Review): number {
  return a.answeredAt - b.answeredAt || a.id.localeCompare(b.id);
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
