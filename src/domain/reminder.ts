import type { Card } from "./card";
import { currentStreak } from "./progress";
import type { Review } from "./types";

/**
 * Ce que le serveur doit savoir pour le rappel quotidien, calculé par l'app :
 * le serveur décide ainsi seul, même si l'app reste fermée plusieurs jours
 * (voir `supabase/functions/daily-reminder/reminder.ts`).
 */
export interface ReminderSummary {
  /** Nombre de fiches qui deviennent dues chaque jour d'étude. */
  due_by_day: Record<string, number>;
  /** Dernier jour d'étude avec au moins une réponse. */
  last_review_day: string | null;
  /** Série de jours consécutifs qui se termine à ce jour-là. */
  streak: number;
}

export function reminderSummary(cards: Card[], reviews: Review[]): ReminderSummary {
  const dueByDay: Record<string, number> = {};
  for (const card of cards) dueByDay[card.progress.dueDay] = (dueByDay[card.progress.dueDay] ?? 0) + 1;

  let lastDay: string | null = null;
  for (const review of reviews) if (lastDay === null || review.studyDay > lastDay) lastDay = review.studyDay;

  // Clés triées : un résumé identique s'écrit toujours de la même façon (comparaison simple).
  const sorted = Object.fromEntries(Object.entries(dueByDay).sort(([a], [b]) => a.localeCompare(b)));
  return { due_by_day: sorted, last_review_day: lastDay, streak: lastDay ? currentStreak(reviews, lastDay) : 0 };
}
