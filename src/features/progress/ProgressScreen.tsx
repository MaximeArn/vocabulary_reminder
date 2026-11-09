import { useState } from "react";
import { Screen } from "../../ui/Screen";
import { Placeholder } from "../../ui/Placeholder";
import { dateOfDay } from "../../ui/format";
import { CardsIcon, ClockIcon, FlameIcon, LaurelIcon } from "../../ui/icons";
import { MASTERY_LABELS, MASTERY_LEVELS, isDue, type MasteryLevel } from "../../domain/srs";
import { activityByDay, countByLevel, currentStreak, type DayActivity } from "../../domain/progress";
import { lastDays } from "../../domain/studyDay";
import type { Card } from "../../domain/card";
import { formatCount, type Unit } from "../../categories/model";
import { presentCategories, unitFor } from "../../categories/registry";
import { useCards } from "../collection/useCards";
import { useReviews } from "../review/useReviews";
import { useToday } from "../review/useToday";
import styles from "./ProgressScreen.module.css";

const HISTORY_DAYS = 14;

/** Gradation d'une seule teinte, du plus clair (nouveau) au plus soutenu (maîtrisé). */
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

  const unit = unitFor(cards);
  const categories = presentCategories(cards);
  const levels = countByLevel(cards);
  const dueCards = cards.filter((card) => isDue(card.progress, today));
  const streak = currentStreak(reviews, today);
  const breakdown =
    categories.length > 1
      ? categories.map((category) => formatCount(cards.filter((card) => card.item.kind === category.kind).length, category.unit)).join(" · ")
      : undefined;

  return (
    <Screen title="Progrès">
      <div className={styles.tiles}>
        <Tile icon={<CardsIcon size={20} />} tone="var(--ink-faint)" value={cards.length} label={cards.length > 1 ? unit.plural : unit.singular} detail={breakdown} />
        <Tile icon={<LaurelIcon size={20} />} tone="var(--success)" value={levels.mastered} label={levels.mastered > 1 ? "maîtrisées" : "maîtrisée"} />
        <Tile icon={<ClockIcon size={20} />} tone="var(--accent)" value={dueCards.length} label="à réviser aujourd’hui" />
        <Tile icon={<FlameIcon size={20} />} tone="var(--gold)" value={streak} label={streak > 1 ? "jours de suite" : "jour de suite"} />
      </div>

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
        <h2 className={styles.heading}>{HISTORY_DAYS} derniers jours</h2>
        <ActivityChart activity={activityByDay(reviews, lastDays(today, HISTORY_DAYS))} />
      </section>

    </Screen>
  );
}

interface TileProps {
  icon: React.ReactNode;
  /** Couleur de l'icône : le sens du chiffre (le chiffre lui-même reste couleur de texte). */
  tone: string;
  value: number;
  label: string;
  detail?: string;
}

function Tile({ icon, tone, value, label, detail }: TileProps) {
  return (
    <div className={styles.tile}>
      <span className={styles.tileIcon} style={{ color: tone }}>
        {icon}
      </span>
      <div className={styles.tileValue}>{value}</div>
      <div className={styles.tileLabel}>{label}</div>
      {detail && <div className={styles.tileDetail}>{detail}</div>}
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
