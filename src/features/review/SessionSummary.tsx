import { MASTERY_LABELS, masteryLevel } from "../../domain/srs";
import { cardKey, keyOfCard } from "../../domain/card";
import { trackOf } from "../../categories/cards";
import { findCategory, findExercise } from "../../categories/registry";
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
  // Une carte notée deux fois (question et classement) n'apparaît qu'une fois : ratée si elle l'a été une fois.
  // Pour une fiche à volets, chaque volet travaillé est une carte à part.
  const graded = new Map<string, boolean>();
  const tracks = new Set<string | undefined>();
  for (const result of firstAnswers) {
    const track = findExercise(result.exercise)?.exercise.track;
    tracks.add(track);
    for (const grade of result.grades) {
      const key = cardKey(grade.itemId, track);
      graded.set(key, (graded.get(key) ?? true) && grade.correct);
    }
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
        {[...graded].map(([key, correct]) => {
          const card = cards?.find((candidate) => keyOfCard(candidate) === key);
          const category = card && findCategory(card.item.kind);
          if (!card || !category) return null;
          // Le volet n'est précisé que si la session en mélange plusieurs (révision du jour).
          const track = tracks.size > 1 ? trackOf(card) : undefined;
          return (
            <li key={key} className={styles.item}>
              <span className={correct ? styles.good : styles.bad}>
                {correct ? <CheckIcon size={18} /> : <CrossIcon size={18} />}
              </span>
              <span className={styles.term}>
                {category.title(card.item.content)}
                {track && <span className={styles.track}>{track.shortLabel}</span>}
              </span>
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
