import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../../data/db";
import { MASTERY_LABELS, masteryLevel } from "../../domain/srs";
import type { Word } from "../../domain/types";
import { Button } from "../../ui/Button";
import { CheckIcon, CrossIcon } from "../../ui/icons";
import type { AnswerResult } from "./useReviewSession";
import styles from "./SessionSummary.module.css";

interface SessionSummaryProps {
  words: Word[];
  results: AnswerResult[];
  onRestart: () => void;
  onClose: () => void;
}

/** Bilan de fin de session : score (premières réponses) et niveau de chaque mot. */
export function SessionSummary({ words, results, onRestart, onClose }: SessionSummaryProps) {
  const firstAnswers = results.filter((result) => !result.isRetry);
  const score = firstAnswers.filter((result) => result.correct).length;
  // Niveaux à jour (après enregistrement des réponses), lus dans la base.
  const updatedWords = useLiveQuery(() => db.words.bulkGet(firstAnswers.map((result) => result.wordId)), [results]);

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
        {firstAnswers.map((result, index) => {
          const word = updatedWords?.[index] ?? words.find((candidate) => candidate.id === result.wordId);
          if (!word) return null;
          return (
            <li key={result.wordId} className={styles.item}>
              <span className={result.correct ? styles.good : styles.bad}>
                {result.correct ? <CheckIcon size={18} /> : <CrossIcon size={18} />}
              </span>
              <span className={styles.term}>{word.term}</span>
              <span className={styles.level}>{MASTERY_LABELS[masteryLevel(word.box)]}</span>
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
  if (ratio >= 0.6) return "Belle session. Les mots manqués reviendront demain.";
  return "Ces mots reviendront dès demain pour être retravaillés.";
}
