import { useState } from "react";
import { Screen } from "../../ui/Screen";
import { Panel } from "../../ui/Panel";
import { Button } from "../../ui/Button";
import { SegmentedControl } from "../../ui/SegmentedControl";
import { formatCardCount, formatRelativeDay } from "../../ui/format";
import { InstallHint } from "../../pwa/InstallHint";
import { CHOICE_COUNT } from "../../domain/quiz";
import type { Card } from "../../domain/card";
import { countDue, nextDueDay, planSession, type SessionItem } from "../../domain/session";
import { activityByDay, currentStreak } from "../../domain/progress";
import { addDays } from "../../domain/studyDay";
import { CATEGORIES, categoryFilterOptions, filterByKind, findCategory, unitFor } from "../../categories/registry";
import { useCards } from "../collection/useCards";
import { useReviews } from "../review/useReviews";
import { useToday } from "../review/useToday";
import { useReviewSettings } from "../review/useReviewSettings";
import { ReviewSession } from "../review/ReviewSession";
import styles from "./TodayScreen.module.css";

const dateFormatter = new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long" });

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
  const settings = useReviewSettings();
  const [session, setSession] = useState<RunningSession | null>(null);

  if (cards === undefined || reviews === undefined) {
    return <Screen eyebrow={dateFormatter.format(new Date())} title="Aujourd’hui" />;
  }

  // Filtre « Réviser » : proposé seulement si plusieurs catégories ont des fiches.
  const filterOptions = categoryFilterOptions(cards);
  const kind = filterOptions && settings.categoryFilter in filterOptions ? settings.categoryFilter : "all";
  const selected = filterByKind(cards, kind);
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

  // La session part d'un instantané de la collection : elle reste stable pendant les réponses.
  // Toutes les cartes sont transmises : les mauvaises réponses se tirent dans toute la catégorie.
  const startSession = () => {
    setSession({
      id: Date.now(),
      cards,
      plan: planSession(reviewable, today, settings.sessionSize, exercisesFor),
    });
  };

  return (
    <Screen eyebrow={dateFormatter.format(new Date())} title="Aujourd’hui">
      <InstallHint />
      <Panel>
        {filterOptions && (
          <div className={styles.filter}>
            <SegmentedControl label="Réviser" options={filterOptions} value={kind} onChange={settings.setCategoryFilter} />
          </div>
        )}
        <TodayMessage
          cards={selected}
          reviewable={reviewable}
          dueCount={dueCount}
          today={today}
          sessionSize={settings.sessionSize}
        />
        {reviewable.length > 0 && (
          <Button fullWidth variant={dueCount > 0 ? "primary" : "secondary"} onClick={startSession}>
            {dueCount > 0 ? "Commencer la révision" : "S’entraîner"}
          </Button>
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
  reviewable: Card[];
  dueCount: number;
  today: string;
  sessionSize: number;
}

/** Message principal, selon l'état de la collection. */
function TodayMessage({ cards, reviewable, dueCount, today, sessionSize }: TodayMessageProps) {
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
        {nextDay && `Prochaine révision ${formatRelativeDay(nextDay, today, addDays(today, 1))}. `}
        Tu peux t’entraîner en attendant : cela n’avance pas ton planning.
      </p>
    </>
  );
}
