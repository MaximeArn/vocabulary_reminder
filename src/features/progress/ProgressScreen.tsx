import { useState } from "react";
import { Screen } from "../../ui/Screen";
import { Placeholder } from "../../ui/Placeholder";
import { dateOfDay } from "../../ui/format";
import { MASTERY_LABELS, MASTERY_LEVELS, isDue } from "../../domain/srs";
import { activityByDay, countByLevel, currentStreak, type DayActivity } from "../../domain/progress";
import { lastDays } from "../../domain/studyDay";
import type { Card } from "../../domain/card";
import { describeCard } from "../../categories/registry";
import { useCards } from "../collection/useCards";
import { useReviews } from "../review/useReviews";
import { useToday } from "../review/useToday";
import styles from "./ProgressScreen.module.css";

const HISTORY_DAYS = 14;
const DIFFICULT_WORDS_SHOWN = 5;

export function ProgressScreen() {
  const cards = useCards();
  const reviews = useReviews();
  const today = useToday();

  if (cards === undefined || reviews === undefined) return <Screen title="Progrès" />;

  if (cards.length === 0) {
    return (
      <Screen title="Progrès">
        <Placeholder>Ta progression apparaîtra ici dès tes premiers mots.</Placeholder>
      </Screen>
    );
  }

  const levels = countByLevel(cards);
  const dueCards = cards.filter((card) => isDue(card.progress, today));
  const streak = currentStreak(reviews, today);
  const difficult = cards
    .filter((card) => card.progress.lapses > 0)
    .sort((a, b) => b.progress.lapses - a.progress.lapses)
    .slice(0, DIFFICULT_WORDS_SHOWN);

  return (
    <Screen title="Progrès">
      <div className={styles.tiles}>
        <Tile value={cards.length} label={cards.length > 1 ? "mots" : "mot"} />
        <Tile value={levels.mastered} label={levels.mastered > 1 ? "maîtrisés" : "maîtrisé"} />
        <Tile value={dueCards.length} label="à réviser aujourd’hui" />
        <Tile value={streak} label={streak > 1 ? "jours de suite" : "jour de suite"} />
      </div>

      <section className={styles.section}>
        <h2 className={styles.heading}>Niveaux</h2>
        <div className={styles.levels}>
          {MASTERY_LEVELS.map((level) => (
            <div key={level} className={styles.levelRow}>
              <span className={styles.levelLabel}>{MASTERY_LABELS[level]}</span>
              <div className={styles.rail} aria-hidden="true">
                <div className={styles.fill} style={{ width: `${(levels[level] / cards.length) * 100}%` }} />
              </div>
              <span className={styles.levelCount}>{levels[level]}</span>
            </div>
          ))}
        </div>
      </section>

      <section className={styles.section}>
        <h2 className={styles.heading}>{HISTORY_DAYS} derniers jours</h2>
        <ActivityChart activity={activityByDay(reviews, lastDays(today, HISTORY_DAYS))} />
      </section>

      <CardSection title="À réviser aujourd’hui" cards={dueCards} empty="Rien à réviser aujourd’hui." />
      {difficult.length > 0 && <CardSection title="Les plus oubliés" cards={difficult} empty="" />}
    </Screen>
  );
}

function Tile({ value, label }: { value: number; label: string }) {
  return (
    <div className={styles.tile}>
      <div className={styles.tileValue}>{value}</div>
      <div className={styles.tileLabel}>{label}</div>
    </div>
  );
}

const shortDayFormatter = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short" });
const longDayFormatter = new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long" });

/**
 * Réponses par jour. Une seule série : la couleur d'accent suffit, sans légende.
 * Toucher une colonne affiche le détail du jour (aujourd'hui par défaut).
 */
function ActivityChart({ activity }: { activity: DayActivity[] }) {
  const [selectedDay, setSelectedDay] = useState(activity[activity.length - 1]?.day);
  const max = Math.max(...activity.map((day) => day.answered), 1);
  const selected = activity.find((day) => day.day === selectedDay);
  const first = activity[0];

  return (
    <>
      <div className={styles.chart}>
        {activity.map((day) => (
          <button
            key={day.day}
            type="button"
            className={`${styles.column} ${day.day === selectedDay ? styles.columnSelected : ""}`}
            onClick={() => setSelectedDay(day.day)}
            aria-label={`${longDayFormatter.format(dateOfDay(day.day))} : ${day.answered} réponses`}
          >
            <span
              className={`${styles.columnBar} ${day.answered === 0 ? styles.columnEmpty : ""}`}
              style={{ height: `${(day.answered / max) * 100}%` }}
            />
          </button>
        ))}
      </div>
      <div className={styles.axis}>
        <span>{first && shortDayFormatter.format(dateOfDay(first.day))}</span>
        <span>Aujourd’hui</span>
      </div>
      {selected && (
        <p className={styles.dayDetail}>
          <strong>{longDayFormatter.format(dateOfDay(selected.day))}</strong> :{" "}
          {selected.answered === 0
            ? "aucune révision."
            : `${selected.answered} réponse${selected.answered > 1 ? "s" : ""}, dont ${selected.correct} juste${selected.correct > 1 ? "s" : ""}.`}
        </p>
      )}
    </>
  );
}

function CardSection({ title, cards, empty }: { title: string; cards: Card[]; empty: string }) {
  return (
    <section className={styles.section}>
      <h2 className={styles.heading}>{title}</h2>
      {cards.length === 0 ? (
        <p className={styles.empty}>{empty}</p>
      ) : (
        <p className={styles.terms}>{cards.map(describeCard.title).join(" · ")}</p>
      )}
    </section>
  );
}
