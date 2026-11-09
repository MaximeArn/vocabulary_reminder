import { useState } from "react";
import { Screen } from "../../ui/Screen";
import { Placeholder } from "../../ui/Placeholder";
import { dateOfDay } from "../../ui/format";
import { CardsIcon, ClockIcon, FlameIcon, LaurelIcon } from "../../ui/icons";
import { MASTERY_LABELS, MASTERY_LEVELS, isDue, type MasteryLevel } from "../../domain/srs";
import { activityByDay, countByLevel, currentStreak, type DayActivity } from "../../domain/progress";
import { lastDays } from "../../domain/studyDay";
import type { Card } from "../../domain/card";
import { formatCount } from "../../categories/model";
import { describeCard, findCategory, presentCategories, unitFor } from "../../categories/registry";
import { useCards } from "../collection/useCards";
import { useReviews } from "../review/useReviews";
import { useToday } from "../review/useToday";
import styles from "./ProgressScreen.module.css";

const HISTORY_DAYS = 14;
const DIFFICULT_SHOWN = 5;

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
  const difficult = cards
    .filter((card) => card.progress.lapses > 0)
    .sort((a, b) => b.progress.lapses - a.progress.lapses)
    .slice(0, DIFFICULT_SHOWN);
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
        <div className={styles.legend} aria-hidden="true">
          {MASTERY_LEVELS.map((level) => (
            <span key={level} className={styles.legendItem}>
              <span className={styles.swatch} style={{ background: LEVEL_COLORS[level] }} />
              {MASTERY_LABELS[level]}
            </span>
          ))}
        </div>
        {categories.map((category) => (
          <LevelBar
            key={category.kind}
            name={category.label}
            color={category.color}
            cards={cards.filter((card) => card.item.kind === category.kind)}
          />
        ))}
      </section>

      <section className={styles.section}>
        <h2 className={styles.heading}>{HISTORY_DAYS} derniers jours</h2>
        <ActivityChart activity={activityByDay(reviews, lastDays(today, HISTORY_DAYS))} />
      </section>

      <CardSection title="À réviser aujourd’hui" cards={dueCards} empty="Rien à réviser aujourd’hui." />
      {difficult.length > 0 && <CardSection title="Les plus oubliées" cards={difficult} empty="" />}
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
 * Répartition des fiches d'une catégorie par niveau : une barre empilée à 100 %,
 * puis le détail en toutes lettres (lisible sans les couleurs).
 */
function LevelBar({ name, color, cards }: { name: string; color: string; cards: Card[] }) {
  const counts = countByLevel(cards);
  const total = cards.length;
  const present = MASTERY_LEVELS.filter((level) => counts[level] > 0);
  return (
    <div className={styles.levelGroup}>
      <div className={styles.levelHeader}>
        <span className={styles.levelName}>
          <span className={styles.dot} style={{ background: color }} aria-hidden="true" />
          {name}
        </span>
        <span className={styles.levelTotal}>{total}</span>
      </div>
      <div className={styles.stack} aria-hidden="true">
        {present.map((level) => (
          <span key={level} className={styles.segment} style={{ flexGrow: counts[level], background: LEVEL_COLORS[level] }} />
        ))}
      </div>
      <p className={styles.levelDetail}>
        {present.map((level) => `${MASTERY_LABELS[level]} ${counts[level]}`).join(" · ")}
      </p>
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

/** Liste de fiches, chacune avec la pastille de sa catégorie. */
function CardSection({ title, cards, empty }: { title: string; cards: Card[]; empty: string }) {
  return (
    <section className={styles.section}>
      <h2 className={styles.heading}>{title}</h2>
      {cards.length === 0 ? (
        <p className={styles.empty}>{empty}</p>
      ) : (
        <ul className={styles.chips}>
          {cards.map((card) => (
            <li key={card.item.id} className={styles.chip}>
              <span className={styles.dot} style={{ background: findCategory(card.item.kind)?.color }} aria-hidden="true" />
              {describeCard.title(card)}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
