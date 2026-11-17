import { useState } from "react";
import { Screen } from "../../ui/Screen";
import { Placeholder } from "../../ui/Placeholder";
import { dateOfDay } from "../../ui/format";
import { MASTERY_LABELS, MASTERY_LEVELS, levelBoxes, type MasteryLevel } from "../../domain/srs";
import { activityByDay, countByLevel, type DayActivity } from "../../domain/progress";
import { lastDays } from "../../domain/studyDay";
import type { Card } from "../../domain/card";
import { formatCount, type Unit } from "../../categories/model";
import { presentCategories } from "../../categories/registry";
import { TYPING_FROM_BOX } from "../../categories/exercisePlan";
import { useCards } from "../collection/useCards";
import { useReviews } from "../review/useReviews";
import { useToday } from "../review/useToday";
import styles from "./ProgressScreen.module.css";

const HISTORY_DAYS = 14;

/** Du rouge (nouveau) au vert (maîtrisé) : la progression se lit d'un coup d'œil. */
const LEVEL_COLORS: Record<MasteryLevel, string> = {
  new: "var(--level-new)",
  learning: "var(--level-learning)",
  progressing: "var(--level-progressing)",
  mastered: "var(--level-mastered)",
};

export function ProgressScreen() {
  const cards = useCards();
  const reviews = useReviews();
  const today = useToday();

  if (cards === undefined || reviews === undefined) return <Screen title="Progrès" />;

  if (cards.length === 0) {
    return (
      <Screen title="Progrès">
        <Placeholder>Ta progression apparaîtra ici dès tes premières fiches.</Placeholder>
      </Screen>
    );
  }

  const categories = presentCategories(cards);

  return (
    <Screen title="Progrès">
      <section className={styles.section}>
        <h2 className={styles.heading}>{HISTORY_DAYS} derniers jours</h2>
        <ActivityChart activity={activityByDay(reviews, lastDays(today, HISTORY_DAYS))} />
      </section>

      <section className={styles.section}>
        <h2 className={styles.heading}>Niveaux</h2>
        <div className={styles.levelCards}>
          {categories.map((category) => (
            <LevelCard
              key={category.kind}
              name={category.label}
              color={category.color}
              unit={category.unit}
              cards={cards.filter((card) => card.item.kind === category.kind)}
            />
          ))}
        </div>
      </section>

      <section className={styles.section}>
        <h2 className={styles.heading}>Règles</h2>
        <LevelRules />
      </section>
    </Screen>
  );
}

/** « 1 », « 1 et 2 » : les marches d'un niveau. */
const listSteps = (steps: number[]) =>
  steps.length > 1 ? `${steps.slice(0, -1).join(", ")} et ${steps[steps.length - 1]}` : String(steps[0]);

/** « 1 jour », « 7, puis 15 jours ». */
const listIntervals = (days: number[]) =>
  `${days.join(", puis ")} ${days[days.length - 1]! > 1 ? "jours" : "jour"}`;

/**
 * Les règles de progression, tirées des paramètres du moteur (intervalles,
 * seuils) : elles ne peuvent pas contredire ce que fait l'app.
 */
function LevelRules() {
  const describe = (level: MasteryLevel): string => {
    const boxes = levelBoxes(level);
    if (level === "new") return "Pas encore révisée.";
    const steps = boxes.map(({ box }) => box);
    const typed = steps[0] === TYPING_FROM_BOX ? " On tape désormais la réponse." : "";
    return `Marches ${listSteps(steps)} : revue après ${listIntervals(boxes.map(({ interval }) => interval))}.${typed}`;
  };
  return (
    <div className={styles.rulesCard}>
      <p className={styles.rulesIntro}>
        Chaque bonne réponse fait monter la fiche d’une marche, au plus une fois par jour, et espace sa prochaine
        révision. Une erreur la renvoie sur la première marche : elle revient le lendemain.
      </p>
      <dl className={styles.rules}>
        {MASTERY_LEVELS.map((level) => (
          <div key={level} className={styles.rule}>
            <dt className={styles.ruleLevel}>
              <span className={styles.swatch} style={{ background: LEVEL_COLORS[level] }} aria-hidden="true" />
              {MASTERY_LABELS[level]}
            </dt>
            <dd className={styles.ruleText}>{describe(level)}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

/**
 * Niveaux d'une catégorie : une carte avec la barre de répartition, puis les
 * quatre niveaux alignés dessous (nuance, nombre, libellé), qui servent aussi de légende.
 */
function LevelCard({ name, color, unit, cards }: { name: string; color: string; unit: Unit; cards: Card[] }) {
  const counts = countByLevel(cards);
  const total = cards.length;
  return (
    <div className={styles.levelCard}>
      <div className={styles.levelHeader}>
        <span className={styles.levelName}>
          <span className={styles.dot} style={{ background: color }} aria-hidden="true" />
          {name}
        </span>
        <span className={styles.levelTotal}>{formatCount(total, unit)}</span>
      </div>
      <div className={styles.stack} aria-hidden="true">
        {MASTERY_LEVELS.filter((level) => counts[level] > 0).map((level) => (
          <span key={level} className={styles.segment} style={{ flexGrow: counts[level], background: LEVEL_COLORS[level] }} />
        ))}
      </div>
      <dl className={styles.levelGrid}>
        {MASTERY_LEVELS.map((level) => (
          <div key={level} className={`${styles.levelCell} ${counts[level] === 0 ? styles.levelEmpty : ""}`}>
            <dt className={styles.levelLabel}>{MASTERY_LABELS[level]}</dt>
            <dd className={styles.levelCount}>
              <span className={styles.swatch} style={{ background: LEVEL_COLORS[level] }} aria-hidden="true" />
              {counts[level]}
            </dd>
          </div>
        ))}
      </dl>
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
