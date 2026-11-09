/**
 * Décision du rappel quotidien : faut-il prévenir cet utilisateur maintenant, et
 * avec quel message ? Logique pure, sans dépendance (testée avec Vitest, exécutée
 * par la fonction Deno).
 *
 * L'app publie l'état utile (voir `src/domain/reminder.ts`) : l'heure choisie, son
 * fuseau horaire, le nombre de fiches qui deviennent dues chaque jour, le dernier
 * jour révisé et la série en cours. Le serveur n'a donc pas à rejouer l'historique.
 */

export interface ReminderState {
  /** Heure du rappel, « HH:MM », dans le fuseau `timezone`. */
  time: string;
  timezone: string;
  /** Fiches qui deviennent dues chaque jour d'étude (« AAAA-MM-JJ » → nombre). */
  due_by_day: Record<string, number>;
  /** Dernier jour d'étude avec au moins une réponse. */
  last_review_day: string | null;
  /** Série de jours consécutifs qui se termine à `last_review_day`. */
  streak: number;
  /** Jour d'étude du dernier rappel envoyé (un seul par jour). */
  last_sent_day: string | null;
}

export interface ReminderMessage {
  title: string;
  body: string;
}

/** Le jour d'étude commence à 4 h (comme dans l'app : réviser à 1 h compte pour la veille). */
const DAY_STARTS_AT_HOUR = 4;
/** Après l'heure choisie, on peut encore envoyer pendant une heure (tâche planifiée en retard). */
const SENDING_WINDOW_MINUTES = 60;
const FALLBACK_TIMEZONE = "Europe/Paris";

/** Date et heure locales dans un fuseau : jour « AAAA-MM-JJ » et minutes depuis minuit. */
export function localClock(instant: Date, timeZone: string): { day: string; minutes: number } {
  let format: Intl.DateTimeFormat;
  try {
    format = new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    });
  } catch {
    return localClock(instant, FALLBACK_TIMEZONE);
  }
  const parts = Object.fromEntries(format.formatToParts(instant).map((part) => [part.type, part.value]));
  return { day: `${parts.year}-${parts.month}-${parts.day}`, minutes: Number(parts.hour) * 60 + Number(parts.minute) };
}

/** Jour d'étude en cours dans ce fuseau. */
export function studyDayIn(instant: Date, timeZone: string): string {
  return localClock(new Date(instant.getTime() - DAY_STARTS_AT_HOUR * 3_600_000), timeZone).day;
}

/** Jour précédent (calcul en UTC, sans effet d'heure d'été). */
export function previousDay(day: string): string {
  const date = new Date(`${day}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
}

function minutesOf(time: string): number | null {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(time);
  return match ? Number(match[1]) * 60 + Number(match[2]) : null;
}

/** Fiches à réviser ce jour-là : toutes celles devenues dues ce jour ou avant. */
export function dueOn(dueByDay: Record<string, number>, day: string): number {
  return Object.entries(dueByDay).reduce((total, [dueDay, count]) => (dueDay <= day ? total + count : total), 0);
}

export function reminderMessage(due: number, streak: number): ReminderMessage {
  const cards = due > 1 ? `${due} fiches t’attendent` : "1 fiche t’attend";
  const series = streak > 0 ? ` Ta série de ${streak} ${streak > 1 ? "jours" : "jour"} continue si tu révises aujourd’hui.` : "";
  return { title: "Révision du jour", body: `${cards}.${series}` };
}

/**
 * Rappel à envoyer maintenant, ou `null`. On prévient une seule fois par jour,
 * à partir de l'heure choisie, s'il reste des fiches à réviser et que l'utilisateur
 * n'a pas encore révisé ce jour-là.
 */
export function reminderToSend(state: ReminderState, now: Date): { day: string; message: ReminderMessage } | null {
  const target = minutesOf(state.time);
  if (target === null) return null;
  const clock = localClock(now, state.timezone);
  if (clock.minutes < target || clock.minutes >= target + SENDING_WINDOW_MINUTES) return null;

  const day = studyDayIn(now, state.timezone);
  if (state.last_sent_day === day || state.last_review_day === day) return null;
  const due = dueOn(state.due_by_day, day);
  if (due === 0) return null;

  // La série n'est en jeu que si la dernière révision date d'hier.
  const streak = state.last_review_day === previousDay(day) ? state.streak : 0;
  return { day, message: reminderMessage(due, streak) };
}
