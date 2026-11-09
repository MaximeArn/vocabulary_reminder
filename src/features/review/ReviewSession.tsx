import { createPortal } from "react-dom";
import type { SessionItem } from "../../domain/session";
import type { Card } from "../../domain/card";
import { useReviewSession } from "./useReviewSession";
import { QuestionCard } from "./QuestionCard";
import { SessionSummary } from "./SessionSummary";
import styles from "./ReviewSession.module.css";

interface ReviewSessionProps {
  /** Instantané de la collection au lancement de la session. */
  cards: Card[];
  plan: SessionItem[];
  today: string;
  onClose: () => void;
  onRestart: () => void;
}

export function ReviewSession({ cards, plan, today, onClose, onRestart }: ReviewSessionProps) {
  const session = useReviewSession(cards, plan, today);
  const progress = session.total === 0 ? 1 : (session.position + (session.answered ? 1 : 0)) / session.total;

  return createPortal(
    <div className={styles.session} role="dialog" aria-modal="true" aria-label="Révision">
      <header className={styles.header}>
        <button type="button" className={styles.quit} onClick={onClose}>
          {session.finished ? "Fermer" : "Quitter"}
        </button>
        {!session.finished && (
          <span className={styles.counter}>
            {session.position + 1} / {session.total}
          </span>
        )}
      </header>
      <div className={styles.track} aria-hidden="true">
        <div className={styles.bar} style={{ width: `${progress * 100}%` }} />
      </div>

      <div className={styles.body}>
        <div className={styles.content}>
          {session.finished || !session.question ? (
            <SessionSummary results={session.results} onRestart={onRestart} onClose={onClose} />
          ) : (
            <QuestionCard
              // La clé remonte la carte à chaque question : animation d'entrée, défilement remis en haut.
              key={session.position}
              question={session.question}
              card={cards.find((card) => card.item.id === session.question?.itemId)}
              isRetry={session.isRetry}
              outcome={session.outcome}
              isLast={session.position === session.total - 1}
              onSubmit={session.submit}
              onNext={session.next}
            />
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
