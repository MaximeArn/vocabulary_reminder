import { useState } from "react";
import { Screen } from "../../ui/Screen";
import { Panel } from "../../ui/Panel";
import { Button } from "../../ui/Button";
import { CategoryToggle } from "../../ui/CategoryToggle";
import { ChevronRightIcon, RepeatIcon, ShuffleIcon, SparkIcon } from "../../ui/icons";
import { formatCardCount, formatRelativeDay } from "../../ui/format";
import { InstallHint } from "../../pwa/InstallHint";
import { CHOICE_COUNT } from "../../domain/quiz";
import type { Card } from "../../domain/card";
import {
  RECENT_DAYS,
  countDue,
  nextDueDay,
  planPractice,
  planSession,
  practiceCandidates,
  type PracticeKind,
  type SessionItem,
} from "../../domain/session";
import { activityByDay, currentStreak } from "../../domain/progress";
import { addDays } from "../../domain/studyDay";
import { CATEGORIES, findCategory, presentCategories, unitFor } from "../../categories/registry";
import { useCards } from "../collection/useCards";
import { useReviews } from "../review/useReviews";
import { useToday } from "../review/useToday";
import { useReviewSettings } from "../review/useReviewSettings";
import { ReviewSession } from "../review/ReviewSession";
import styles from "./ReviseScreen.module.css";

const dateFormatter = new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long" });

interface RunningSession {
  id: number;
  cards: Card[];
  plan: SessionItem[];
  /** « Encore une session » relance le même type de révision. */
  restart: () => void;
}

/** Les entraînements proposés en accès rapide. */
const PRACTICES: {
  kind: PracticeKind;
  title: string;
  Icon: (props: { size?: number }) => React.ReactNode;
  /** Détail sous le titre ; `count` est déjà mis en forme (« 3 mots »), sans accord à faire. */
  describe: (count: string) => string;
  empty: string;
}[] = [
  {
    kind: "forgotten",
    title: "Les plus oubliées",
    Icon: RepeatIcon,
    describe: (count) => `À retravailler : ${count}`,
    empty: "Rien d’oublié pour l’instant.",
  },
  {
    kind: "recent",
    title: "Nouveautés",
    Icon: SparkIcon,
    describe: (count) => `Ajouts des ${RECENT_DAYS} derniers jours : ${count}`,
    empty: `Rien d’ajouté ces ${RECENT_DAYS} derniers jours.`,
  },
  {
    kind: "random",
    title: "Tout en vrac",
    Icon: ShuffleIcon,
    describe: (count) => `Au hasard parmi ${count}`,
    empty: "",
  },
];

/** Cartes des catégories qui ont assez de fiches pour composer des questions. */
function reviewableCards(cards: Card[]): Card[] {
  const reviewableKinds = new Set(
    CATEGORIES.filter((category) =>
      category.canBuildQuestions(cards.filter((card) => card.item.kind === category.kind).map((card) => card.item)),
    ).map((category) => category.kind),
  );
  return cards.filter((card) => reviewableKinds.has(card.item.kind));
}

/** Réviser : la révision du jour, puis des entraînements ciblés en accès rapide. */
export function ReviseScreen() {
  const cards = useCards();
  const reviews = useReviews();
  const today = useToday();
  const settings = useReviewSettings();
  const [session, setSession] = useState<RunningSession | null>(null);

  if (cards === undefined || reviews === undefined) {
    return <Screen eyebrow={dateFormatter.format(new Date())} title="Réviser" />;
  }

  // Catégorie révisée : proposée seulement si plusieurs catégories ont des fiches.
  const categories = presentCategories(cards);
  const kind = categories.some((category) => category.kind === settings.categoryFilter) ? settings.categoryFilter : "all";
  const selected = kind === "all" ? cards : cards.filter((card) => card.item.kind === kind);
  const reviewable = reviewableCards(selected);
  const dueCount = countDue(reviewable, today);
  const streak = currentStreak(reviews, today);
  const answeredToday = activityByDay(reviews, [today])[0]?.answered ?? 0;

  // Exercices possibles pour une carte : ceux de sa catégorie, ou celui imposé dans les réglages.
  const exercisesFor = (card: Card) => {
    const ids = findCategory(card.item.kind)?.exercises.map((exercise) => exercise.id) ?? [];
    const preference = settings.exercisePreference(card.item.kind);
    return ids.includes(preference) ? [preference] : ids;
  };

  // Une session part d'un instantané de la collection : elle reste stable pendant les réponses.
  // Toutes les cartes sont transmises : les mauvaises réponses se tirent dans toute la catégorie.
  const start = (makePlan: () => SessionItem[]) => {
    const launch = () => setSession({ id: Date.now(), cards, plan: makePlan(), restart: launch });
    launch();
  };
  const startDaily = () => start(() => planSession(reviewable, today, settings.sessionSize, exercisesFor));
  const startPractice = (practice: PracticeKind) =>
    start(() => planPractice(reviewable, practice, settings.sessionSize, Date.now(), exercisesFor));

  return (
    <Screen eyebrow={dateFormatter.format(new Date())} title="Réviser">
      <InstallHint />

      {categories.length > 1 && (
        <div className={styles.filter}>
          <CategoryToggle
            label="Réviser"
            options={[
              { value: "all", label: "Tout" },
              ...categories.map((category) => ({
                value: category.kind,
                label: category.label,
                fill: category.fillColor,
                onFill: category.onFillColor,
              })),
            ]}
            value={kind}
            onChange={settings.setCategoryFilter}
          />
        </div>
      )}

      <Panel>
        <p className={styles.eyebrow}>Révision du jour</p>
        <DailyMessage cards={selected} reviewable={reviewable} dueCount={dueCount} today={today} sessionSize={settings.sessionSize} />
        {dueCount > 0 && (
          <Button fullWidth onClick={startDaily}>
            Commencer la révision
          </Button>
        )}
      </Panel>

      {reviewable.length > 0 && (
        <section className={styles.practices}>
          <h2 className={styles.heading}>Entraînements</h2>
          <ul className={styles.list}>
            {PRACTICES.map(({ kind: practice, title, Icon, describe, empty }) => {
              const count = practiceCandidates(reviewable, practice, Date.now()).length;
              const counted = formatCardCount(count, unitFor(reviewable)).toLowerCase();
              return (
                <li key={practice}>
                  <button
                    type="button"
                    className={styles.practice}
                    onClick={() => startPractice(practice)}
                    disabled={count === 0}
                    aria-label={title}
                    aria-describedby={`practice-${practice}`}
                  >
                    <span className={styles.practiceIcon}>
                      <Icon size={22} />
                    </span>
                    <span className={styles.practiceText}>
                      <span className={styles.practiceTitle}>{title}</span>
                      <span className={styles.practiceDetail} id={`practice-${practice}`}>
                        {count === 0 ? empty : describe(counted)}
                      </span>
                    </span>
                    <ChevronRightIcon size={18} />
                  </button>
                </li>
              );
            })}
          </ul>
          <p className={styles.footnote}>
            En entraînement, une bonne réponse n’avance pas ton planning ; une erreur, si.
          </p>
        </section>
      )}

      {reviews.length > 0 && (
        <div className={styles.stats}>
          <div className={styles.stat}>
            <span className={styles.statValue}>{streak}</span>
            <span className={styles.statLabel}>{streak > 1 ? "jours de suite" : "jour de suite"}</span>
          </div>
          <div className={styles.stat}>
            <span className={styles.statValue}>{answeredToday}</span>
            <span className={styles.statLabel}>{answeredToday > 1 ? "réponses aujourd’hui" : "réponse aujourd’hui"}</span>
          </div>
        </div>
      )}

      {session && (
        <ReviewSession
          key={session.id}
          cards={session.cards}
          plan={session.plan}
          today={today}
          onClose={() => setSession(null)}
          onRestart={session.restart}
        />
      )}
    </Screen>
  );
}

interface DailyMessageProps {
  cards: Card[];
  reviewable: Card[];
  dueCount: number;
  today: string;
  sessionSize: number;
}

/** Message de la révision du jour, selon l'état de la collection. */
function DailyMessage({ cards, reviewable, dueCount, today, sessionSize }: DailyMessageProps) {
  if (cards.length === 0) {
    return (
      <>
        <p className={styles.lead}>Ton carnet est encore vide.</p>
        <p className={styles.text}>
          Ajoute les mots et les dates rencontrés au fil de tes lectures avec le bouton +, puis reviens chaque jour les
          réviser.
        </p>
      </>
    );
  }

  if (reviewable.length === 0) {
    const missing = Math.max(CHOICE_COUNT - cards.length, 1);
    return (
      <>
        <p className={styles.lead}>Encore un peu de patience.</p>
        <p className={styles.text}>
          Il faut au moins {CHOICE_COUNT} mots, avec des définitions différentes, pour composer les questions. Ajoute-en
          encore {missing === 1 ? "un" : missing}.
        </p>
      </>
    );
  }

  if (dueCount > 0) {
    const questions = Math.min(sessionSize, reviewable.length);
    const dueCards = reviewable.filter((card) => card.progress.dueDay <= today);
    return (
      <>
        <p className={styles.lead}>{formatCardCount(dueCount, unitFor(dueCards))} à réviser.</p>
        <p className={styles.text}>Une session de {questions} questions, quelques minutes à peine.</p>
      </>
    );
  }

  const nextDay = nextDueDay(reviewable, today);
  return (
    <>
      <p className={styles.lead}>Tout est révisé pour aujourd’hui.</p>
      <p className={styles.text}>
        {nextDay ? `Prochaine révision ${formatRelativeDay(nextDay, today, addDays(today, 1))}.` : ""} Un entraînement
        ci-dessous, en attendant ?
      </p>
    </>
  );
}
