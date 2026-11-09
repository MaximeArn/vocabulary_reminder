import type { Card } from "./card";
import { MASTERY_LEVELS, masteryLevel, type MasteryLevel } from "./srs";
import { addDays } from "./studyDay";
import type { Review } from "./types";

/** Statistiques de progression, calculées à partir des cartes et de l'historique. */

/** Nombre de cartes par niveau de maîtrise. */
export function countByLevel(cards: Card[]): Record<MasteryLevel, number> {
  const counts = Object.fromEntries(MASTERY_LEVELS.map((level) => [level, 0])) as Record<MasteryLevel, number>;
  for (const card of cards) counts[masteryLevel(card.progress.box)] += 1;
  return counts;
}

export interface DayActivity {
  day: string;
  answered: number;
  correct: number;
}

/** Réponses données chaque jour, pour la liste de jours demandée. */
export function activityByDay(reviews: Review[], days: string[]): DayActivity[] {
  const byDay = new Map(days.map((day) => [day, { day, answered: 0, correct: 0 }]));
  for (const review of reviews) {
    const activity = byDay.get(review.studyDay);
    if (!activity) continue;
    activity.answered += 1;
    if (review.correct) activity.correct += 1;
  }
  return days.map((day) => byDay.get(day)!);
}

/**
 * Série de jours consécutifs avec au moins une révision.
 * Tant que la journée n'est pas finie, une série qui s'arrête hier compte encore.
 */
export function currentStreak(reviews: Review[], today: string): number {
  const activeDays = new Set(reviews.map((review) => review.studyDay));
  let day = activeDays.has(today) ? today : addDays(today, -1);
  let streak = 0;
  while (activeDays.has(day)) {
    streak += 1;
    day = addDays(day, -1);
  }
  return streak;
}
