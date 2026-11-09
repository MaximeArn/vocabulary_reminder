import { MASTERY_LABELS, masteryLevel } from "../../domain/srs";
import { findCategory } from "../../categories/registry";
import { Button } from "../../ui/Button";
import { CheckIcon, CrossIcon } from "../../ui/icons";
import { useCards } from "../collection/useCards";
import type { AnswerResult } from "./useReviewSession";
import styles from "./SessionSummary.module.css";

interface SessionSummaryProps {
  results: AnswerResult[];
  onRestart: () => void;
  onClose: () => void;
}

/**
 * Bilan de fin de session : score (premières réponses, une par question) et
 * niveau de chaque fiche interrogée (un classement en note plusieurs).
 */
export function SessionSummary({ results, onRestart, onClose }: SessionSummaryProps) {
  const firstAnswers = results.filter((result) => !result.isRetry);
  const score = firstAnswers.filter((result) => result.correct).length;
  // Une fiche notée deux fois (question et classement) n'apparaît qu'une fois : ratée si elle l'a été une fois.
  const graded = new Map<string, boolean>();
  for (const grade of firstAnswers.flatMap((result) => result.grades)) {
    graded.set(grade.itemId, (graded.get(grade.itemId) ?? true) && grade.correct);
  }
  // Cartes à jour : leur progression tient compte des réponses de la session.
  const cards = useCards();

  if (firstAnswers.length === 0) {
    return (
      <div className={styles.summary}>
        <p className={styles.message}>Aucune question n’a pu être préparée.</p>
        <div className={styles.actions}>
          <Button fullWidth onClick={onClose}>
            Fermer
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.summary}>
      <p className={styles.eyebrow}>Session terminée</p>
      <p className={styles.score}>
        {score}
        <span className={styles.scoreTotal}> / {firstAnswers.length}</span>
      </p>
      <p className={styles.message}>{encouragement(score, firstAnswers.length)}</p>

      <ul className={styles.list}>
        {[...graded].map(([itemId, correct]) => {
          const card = cards?.find((candidate) => candidate.item.id === itemId);
          const category = card && findCategory(card.item.kind);
          if (!card || !category) return null;
          return (
            <li key={itemId} className={styles.item}>
              <span className={correct ? styles.good : styles.bad}>
                {correct ? <CheckIcon size={18} /> : <CrossIcon size={18} />}
              </span>
              <span className={styles.term}>{category.title(card.item.content)}</span>
              <span className={styles.level}>{MASTERY_LABELS[masteryLevel(card.progress.box)]}</span>
            </li>
          );
        })}
      </ul>

      <div className={styles.actions}>
        <Button fullWidth onClick={onClose}>
          Terminer
        </Button>
        <Button variant="quiet" fullWidth onClick={onRestart}>
          Encore une session
        </Button>
      </div>
    </div>
  );
}

function encouragement(score: number, total: number): string {
  const ratio = score / total;
  if (ratio === 1) return "Sans faute. Bravo !";
  if (ratio >= 0.6) return "Belle session. Ce que tu as manqué reviendra demain.";
  return "Ce que tu as manqué reviendra dès demain pour être retravaillé.";
}
