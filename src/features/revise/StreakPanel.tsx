import { activityByDay, currentStreak } from "../../domain/progress";
import { lastDays } from "../../domain/studyDay";
import type { Review } from "../../domain/types";
import { FlameIcon } from "../../ui/icons";
import { dateOfDay } from "../../ui/format";
import styles from "./StreakPanel.module.css";

const WEEK = 7;
const initialFormatter = new Intl.DateTimeFormat("fr-FR", { weekday: "narrow" });
const weekdayFormatter = new Intl.DateTimeFormat("fr-FR", { weekday: "long" });

interface StreakPanelProps {
  reviews: Review[];
  today: string;
}

/**
 * La série en cours, en tête de la page Réviser : nombre de jours consécutifs,
 * réponses du jour, et les sept derniers jours d'un coup d'œil.
 */
export function StreakPanel({ reviews, today }: StreakPanelProps) {
  const streak = currentStreak(reviews, today);
  const week = activityByDay(reviews, lastDays(today, WEEK));
  const answeredToday = week[WEEK - 1]?.answered ?? 0;

  const title = streak > 0 ? `${streak} ${streak > 1 ? "jours" : "jour"} de suite` : "Pas de série en cours";
  const detail =
    answeredToday > 0
      ? `${answeredToday} ${answeredToday > 1 ? "réponses" : "réponse"} aujourd’hui`
      : streak > 0
        ? "Révise aujourd’hui pour la prolonger"
        : "Révise aujourd’hui pour en commencer une";

  return (
    <section className={styles.panel} aria-label="Série">
      <div className={styles.header}>
        <span className={`${styles.flame} ${streak > 0 ? styles.lit : ""}`} aria-hidden="true">
          <FlameIcon size={26} />
        </span>
        <div className={styles.text}>
          <p className={styles.title}>{title}</p>
          <p className={styles.detail}>{detail}</p>
        </div>
      </div>
      <ol className={styles.week} aria-label="Les 7 derniers jours">
        {week.map(({ day, answered }) => {
          const date = dateOfDay(day);
          const isToday = day === today;
          return (
            <li
              key={day}
              className={`${styles.day} ${answered > 0 ? styles.done : ""} ${isToday ? styles.today : ""}`}
              aria-label={`${isToday ? "Aujourd’hui" : weekdayFormatter.format(date)} : ${answered > 0 ? "révisé" : "pas de révision"}`}
            >
              <span className={styles.dot} />
              <span className={styles.initial} aria-hidden="true">
                {initialFormatter.format(date)}
              </span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
