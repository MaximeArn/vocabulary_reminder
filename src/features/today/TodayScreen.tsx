import { useState } from "react";
import { Screen } from "../../ui/Screen";
import { Card } from "../../ui/Card";
import { Button } from "../../ui/Button";
import { SegmentedControl } from "../../ui/SegmentedControl";
import { formatRelativeDay, formatWordCount } from "../../ui/format";
import { InstallHint } from "../../pwa/InstallHint";
import { CHOICE_COUNT, canBuildQuestions } from "../../domain/quiz";
import { SESSION_MODE_LABELS, countDue, nextDueDay, planSession, type SessionItem } from "../../domain/session";
import { activityByDay, currentStreak } from "../../domain/progress";
import { addDays } from "../../domain/studyDay";
import type { Word } from "../../domain/types";
import { useWords } from "../words/useWords";
import { useReviews } from "../review/useReviews";
import { useToday } from "../review/useToday";
import { useReviewSettings } from "../review/useReviewSettings";
import { ReviewSession } from "../review/ReviewSession";
import styles from "./TodayScreen.module.css";

const dateFormatter = new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long" });

interface RunningSession {
  id: number;
  words: Word[];
  plan: SessionItem[];
}

export function TodayScreen() {
  const words = useWords();
  const reviews = useReviews();
  const today = useToday();
  const { sessionSize, sessionMode, setSessionMode } = useReviewSettings();
  const [session, setSession] = useState<RunningSession | null>(null);

  if (words === undefined || reviews === undefined) {
    return <Screen eyebrow={dateFormatter.format(new Date())} title="Aujourd’hui" />;
  }

  const dueCount = countDue(words, today);
  const streak = currentStreak(reviews, today);
  const answeredToday = activityByDay(reviews, [today])[0]?.answered ?? 0;

  // La session part d'un instantané de la collection : elle reste stable pendant les réponses.
  const startSession = () => {
    setSession({
      id: Date.now(),
      words,
      plan: planSession(words, today, sessionSize, sessionMode),
    });
  };

  return (
    <Screen eyebrow={dateFormatter.format(new Date())} title="Aujourd’hui">
      <InstallHint />
      <Card>
        <TodayMessage words={words} dueCount={dueCount} today={today} sessionSize={sessionSize} />
        {canBuildQuestions(words) && (
          <>
            <Button fullWidth variant={dueCount > 0 ? "primary" : "secondary"} onClick={startSession}>
              {dueCount > 0 ? "Commencer la révision" : "S’entraîner"}
            </Button>
            <div className={styles.mode}>
              <span>Retrouver</span>
              <SegmentedControl
                label="Retrouver"
                options={SESSION_MODE_LABELS}
                value={sessionMode}
                onChange={setSessionMode}
              />
            </div>
          </>
        )}
      </Card>

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
          words={session.words}
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
  words: Word[];
  dueCount: number;
  today: string;
  sessionSize: number;
}

/** Message principal, selon l'état de la collection. */
function TodayMessage({ words, dueCount, today, sessionSize }: TodayMessageProps) {
  if (words.length === 0) {
    return (
      <>
        <p className={styles.lead}>Ton carnet est encore vide.</p>
        <p className={styles.text}>
          Ajoute les mots rencontrés au fil de tes lectures avec le bouton +, puis reviens chaque jour les réviser.
        </p>
      </>
    );
  }

  if (!canBuildQuestions(words)) {
    const missing = Math.max(CHOICE_COUNT - words.length, 1);
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
    const questions = Math.min(sessionSize, words.length);
    return (
      <>
        <p className={styles.lead}>{formatWordCount(dueCount)} à réviser.</p>
        <p className={styles.text}>Une session de {questions} questions, quelques minutes à peine.</p>
      </>
    );
  }

  const nextDay = nextDueDay(words, today);
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
