import { useEffect, useRef } from "react";
import type { Card } from "../../domain/card";
import type { Question } from "../../domain/quiz";
import { findExercise } from "../../categories/registry";
import { Button } from "../../ui/Button";
import { CheckIcon, CrossIcon } from "../../ui/icons";
import styles from "./QuestionCard.module.css";

interface QuestionCardProps {
  question: Question;
  /** La carte demandée, pour afficher l'explication après la réponse. */
  card: Card | undefined;
  isRetry: boolean;
  selectedChoiceId: string | null;
  isLast: boolean;
  onAnswer: (choiceId: string) => void;
  onNext: () => void;
}

export function QuestionCard({ question, card, isRetry, selectedChoiceId, isLast, onAnswer, onNext }: QuestionCardProps) {
  const found = findExercise(question.exercise);
  const answered = selectedChoiceId !== null;
  const correct = selectedChoiceId === question.correctChoiceId;
  const feedbackRef = useRef<HTMLDivElement>(null);

  // Après la réponse, on amène le retour (et le bouton Continuer) à l'écran.
  useEffect(() => {
    if (answered) feedbackRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [answered]);

  if (!found) return null;
  const { category, exercise } = found;

  const choiceClass = (choiceId: string) => {
    const base = `${styles.choice} ${exercise.choiceStyle === "short" ? styles.termChoice : ""}`;
    if (!answered) return base;
    if (choiceId === question.correctChoiceId) return `${base} ${styles.correct}`;
    if (choiceId === selectedChoiceId) return `${base} ${styles.wrong}`;
    return `${base} ${styles.dimmed}`;
  };

  return (
    <div className={styles.card}>
      <p className={styles.instruction}>
        {isRetry && <span className={styles.retry}>Deuxième chance · </span>}
        {exercise.instruction}
      </p>
      <h2 className={exercise.promptStyle === "headline" ? styles.term : styles.definition}>{question.prompt}</h2>

      <div className={styles.choices} role="group" aria-label="Propositions">
        {question.choices.map((choice) => (
          <button
            key={choice.id}
            type="button"
            className={choiceClass(choice.id)}
            onClick={() => onAnswer(choice.id)}
            disabled={answered}
          >
            <span className={styles.label}>{choice.label}</span>
            {answered && choice.id === question.correctChoiceId && (
              <span className={styles.mark} aria-label="Bonne réponse">
                <CheckIcon size={20} />
              </span>
            )}
            {answered && choice.id === selectedChoiceId && !correct && (
              <span className={styles.mark} aria-label="Ta réponse">
                <CrossIcon size={20} />
              </span>
            )}
          </button>
        ))}
      </div>

      {answered && card && (
        <div className={styles.feedback} ref={feedbackRef} aria-live="polite">
          <p className={`${styles.verdict} ${correct ? styles.verdictGood : styles.verdictBad}`}>
            {correct ? <CheckIcon size={20} /> : <CrossIcon size={20} />}
            {correct ? "Bonne réponse" : "Ce n’était pas ça"}
          </p>
          <category.Explanation content={card.item.content} />
          <Button className={styles.next} fullWidth onClick={onNext}>
            {isLast ? "Voir le bilan" : "Continuer"}
          </Button>
        </div>
      )}
    </div>
  );
}
