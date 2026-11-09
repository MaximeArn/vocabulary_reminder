import { useState } from "react";
import { Screen } from "../../ui/Screen";
import { Panel } from "../../ui/Panel";
import { Button } from "../../ui/Button";
import { SegmentedControl } from "../../ui/SegmentedControl";
import { formatRelativeDay, formatWordCount } from "../../ui/format";
import { InstallHint } from "../../pwa/InstallHint";
import { CHOICE_COUNT } from "../../domain/quiz";
import type { Card } from "../../domain/card";
import { countDue, nextDueDay, planSession, type SessionItem } from "../../domain/session";
import { activityByDay, currentStreak } from "../../domain/progress";
import { addDays } from "../../domain/studyDay";
import { CATEGORIES, findCategory } from "../../categories/registry";
import { vocabulary } from "../../categories/vocabulary";
import { useCards } from "../collection/useCards";
import { useReviews } from "../review/useReviews";
import { useToday } from "../review/useToday";
import { useReviewSettings } from "../review/useReviewSettings";
import { ReviewSession } from "../review/ReviewSession";
import styles from "./TodayScreen.module.css";

const dateFormatter = new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long" });

/** Choix du type de question : tous en alternance, ou un exercice imposé. */
const EXERCISE_OPTIONS: Record<string, string> = {
  mixed: "Les deux",
  ...Object.fromEntries(vocabulary.exercises.map((exercise) => [exercise.id, exercise.label])),
};

interface RunningSession {
  id: number;
  cards: Card[];
  plan: SessionItem[];
}

/** Cartes des catégories qui ont assez de fiches pour composer des questions. */
function reviewableCards(cards: Card[]): Card[] {
  const reviewableKinds = new Set(
    CATEGORIES.filter((category) =>
      category.canBuildQuestions(cards.filter((card) => card.item.kind === category.kind).map((card) => card.item)),
    ).map((category) => category.kind),
  );
  return cards.filter((card) => reviewableKinds.has(card.item.kind));
}

export function TodayScreen() {
  const cards = useCards();
  const reviews = useReviews();
  const today = useToday();
  const { sessionSize, exercisePreference, setExercisePreference } = useReviewSettings();
  const [session, setSession] = useState<RunningSession | null>(null);

  if (cards === undefined || reviews === undefined) {
    return <Screen eyebrow={dateFormatter.format(new Date())} title="Aujourd’hui" />;
  }

  const reviewable = reviewableCards(cards);
  const dueCount = countDue(cards, today);
  const streak = currentStreak(reviews, today);
  const answeredToday = activityByDay(reviews, [today])[0]?.answered ?? 0;

  // Exercices possibles pour une carte : ceux de sa catégorie, ou l'exercice imposé.
  const exercisesFor = (card: Card) => {
    const ids = findCategory(card.item.kind)?.exercises.map((exercise) => exercise.id) ?? [];
    return ids.includes(exercisePreference) ? [exercisePreference] : ids;
  };

  // La session part d'un instantané de la collection : elle reste stable pendant les réponses.
  const startSession = () => {
    setSession({
      id: Date.now(),
      cards,
      plan: planSession(reviewable, today, sessionSize, exercisesFor),
    });
  };

  return (
    <Screen eyebrow={dateFormatter.format(new Date())} title="Aujourd’hui">
      <InstallHint />
      <Panel>
        <TodayMessage cards={cards} canReview={reviewable.length > 0} dueCount={dueCount} today={today} sessionSize={sessionSize} />
        {reviewable.length > 0 && (
          <>
            <Button fullWidth variant={dueCount > 0 ? "primary" : "secondary"} onClick={startSession}>
              {dueCount > 0 ? "Commencer la révision" : "S’entraîner"}
            </Button>
            <div className={styles.mode}>
              <span>Retrouver</span>
              <SegmentedControl
                label="Retrouver"
                options={EXERCISE_OPTIONS}
                value={exercisePreference in EXERCISE_OPTIONS ? exercisePreference : "mixed"}
                onChange={setExercisePreference}
              />
            </div>
          </>
        )}
      </Panel>

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
          onRestart={startSession}
        />
      )}
    </Screen>
  );
}

interface TodayMessageProps {
  cards: Card[];
  canReview: boolean;
  dueCount: number;
  today: string;
  sessionSize: number;
}

/** Message principal, selon l'état de la collection. */
function TodayMessage({ cards, canReview, dueCount, today, sessionSize }: TodayMessageProps) {
  if (cards.length === 0) {
    return (
      <>
        <p className={styles.lead}>Ton carnet est encore vide.</p>
        <p className={styles.text}>
          Ajoute les mots rencontrés au fil de tes lectures avec le bouton +, puis reviens chaque jour les réviser.
        </p>
      </>
    );
  }

  if (!canReview) {
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
    const questions = Math.min(sessionSize, cards.length);
    return (
      <>
        <p className={styles.lead}>{formatWordCount(dueCount)} à réviser.</p>
        <p className={styles.text}>Une session de {questions} questions, quelques minutes à peine.</p>
      </>
    );
  }

  const nextDay = nextDueDay(cards, today);
  return (
    <>
      <p className={styles.lead}>Tout est révisé pour aujourd’hui.</p>
      <p className={styles.text}>
        {nextDay && `Prochaine révision ${formatRelativeDay(nextDay, today, addDays(today, 1))}. `}
        Tu peux t’entraîner en attendant : cela n’avance pas ton planning.
      </p>
    </>
  );
}
