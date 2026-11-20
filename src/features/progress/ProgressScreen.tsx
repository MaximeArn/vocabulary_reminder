import { useState } from "react";
import { Screen } from "../../ui/Screen";
import { Placeholder } from "../../ui/Placeholder";
import { dateOfDay } from "../../ui/format";
import { MASTERY_LABELS, MASTERY_LEVELS, levelBoxes, type MasteryLevel } from "../../domain/srs";
import { activityByDay, countByLevel, type DayActivity } from "../../domain/progress";
import { lastDays } from "../../domain/studyDay";
import type { Card } from "../../domain/card";
import { formatCount, type Unit } from "../../categories/model";
import { presentCategories, type AnyCategory } from "../../categories/registry";
import { categoryBorder } from "../../ui/categoryBorder";
import { CategoryFilter, chosenCategory } from "../revise/CategoryFilter";
import { useReviewSettings } from "../review/useReviewSettings";
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
  const settings = useReviewSettings();

  if (cards === undefined || reviews === undefined) return <Screen title="Progrès" />;

  if (cards.length === 0) {
    return (
      <Screen title="Progrès">
        <Placeholder>Ta progression apparaîtra ici dès tes premières fiches.</Placeholder>
      </Screen>
    );
  }

  // Même choix de catégorie que sur Réviser : l'activité et les niveaux de cette catégorie, ou de toutes.
  const categories = presentCategories(cards);
  const { kind, category } = chosenCategory(categories, settings.categoryFilter);
  const shown = category ? [category] : categories;
  const shownItems = new Set(cards.filter((card) => card.item.kind === category?.kind).map((card) => card.item.id));
  const shownReviews = category ? reviews.filter((review) => shownItems.has(review.itemId)) : reviews;

  return (
    <Screen title="Progrès">
      <CategoryFilter label="Progrès" categories={categories} value={kind} onChange={settings.setCategoryFilter} />

      <section className={styles.section}>
        <h2 className={styles.heading}>{HISTORY_DAYS} derniers jours</h2>
        <ActivityChart
          activity={activityByDay(shownReviews, lastDays(today, HISTORY_DAYS))}
          color={category?.color ?? "var(--ink)"}
        />
      </section>

      <section className={styles.section}>
        <h2 className={styles.heading}>Niveaux</h2>
        <div className={styles.levelCards}>
          {shown.flatMap((shownCategory) => levelCards(shownCategory, cards.filter((card) => card.item.kind === shownCategory.kind)))}
        </div>
      </section>

      <section className={styles.section}>
        <h2 className={styles.heading}>Règles</h2>
        <LevelRules />
      </section>
    </Screen>
  );
}

/**
 * Les cartes de niveaux d'une catégorie, dans sa couleur : une seule, ou une par volet
 * (géographie : les mêmes révisions que sur Réviser, avec leur icône).
 */
function levelCards(category: AnyCategory, cards: Card[]) {
  if (!category.tracks) {
    return [<LevelCard key={category.kind} name={category.label} color={category.color} unit={category.unit} cards={cards} />];
  }
  return category.tracks.map((track) => {
    const Icon = category.trackIcons?.[track.id];
    return (
      <LevelCard
        key={`${category.kind}#${track.id}`}
        name={track.label}
        icon={Icon && <Icon size={24} />}
        color={category.color}
        unit={category.unit}
        cards={cards.filter((card) => card.track === track.id)}
      />
    );
  });
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
 * Niveaux d'une catégorie (ou d'un volet) : une carte au contour de sa couleur, comme
 * le bloc des révisions, avec la barre de répartition, puis les quatre niveaux alignés
 * dessous (nuance, nombre, libellé), qui servent aussi de légende.
 */
function LevelCard({ name, icon, color, unit, cards }: { name: string; icon?: React.ReactNode; color: string; unit: Unit; cards: Card[] }) {
  const counts = countByLevel(cards);
  const total = cards.length;
  return (
    <div className={styles.levelCard} style={{ background: categoryBorder([color], "var(--paper-raised)") }}>
      {/* Comme une ligne de Réviser : l'icône du volet, le nom, puis le nombre de fiches. */}
      <div className={styles.levelHeader}>
        {icon && (
          <span className={styles.levelIcon} style={{ color }} aria-hidden="true">
            {icon}
          </span>
        )}
        <span className={styles.levelText}>
          <span className={styles.levelName}>{name}</span>
          <span className={styles.levelTotal}>{formatCount(total, unit)}</span>
        </span>
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
 * Réponses par jour. Une seule série, dans la couleur de la catégorie choisie (neutre pour « Tout »), sans légende.
 * Toucher une colonne affiche le détail du jour (aujourd'hui par défaut).
 */
function ActivityChart({ activity, color }: { activity: DayActivity[]; color: string }) {
  const [selectedDay, setSelectedDay] = useState(activity[activity.length - 1]?.day);
  const max = Math.max(...activity.map((day) => day.answered), 1);
  const selected = activity.find((day) => day.day === selectedDay);
  const first = activity[0];

  return (
    <>
      <div className={styles.chart} style={{ "--bar": color } as React.CSSProperties}>
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
