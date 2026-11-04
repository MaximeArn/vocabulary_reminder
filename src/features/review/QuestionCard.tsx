import { useEffect, useRef } from "react";
import type { Question } from "../../domain/quiz";
import type { Word } from "../../domain/types";
import { Button } from "../../ui/Button";
import { CheckIcon, CrossIcon } from "../../ui/icons";
import styles from "./QuestionCard.module.css";

interface QuestionCardProps {
  question: Question;
  /** Le mot demandé, pour afficher sa définition complète après la réponse. */
  word: Word | undefined;
  isRetry: boolean;
  selectedWordId: string | null;
  isLast: boolean;
  onAnswer: (wordId: string) => void;
  onNext: () => void;
}

const INSTRUCTIONS = {
  "word-to-definition": "Quelle est la définition ?",
  "definition-to-word": "Quel est ce mot ?",
};

export function QuestionCard({ question, word, isRetry, selectedWordId, isLast, onAnswer, onNext }: QuestionCardProps) {
  const answered = selectedWordId !== null;
  const correct = selectedWordId === question.wordId;
  const asksDefinition = question.mode === "word-to-definition";
  const feedbackRef = useRef<HTMLDivElement>(null);

  // Après la réponse, on amène le retour (et le bouton Continuer) à l'écran.
  useEffect(() => {
    if (answered) feedbackRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [answered]);

  const choiceClass = (wordId: string) => {
    if (!answered) return styles.choice;
    if (wordId === question.wordId) return `${styles.choice} ${styles.correct}`;
    if (wordId === selectedWordId) return `${styles.choice} ${styles.wrong}`;
    return `${styles.choice} ${styles.dimmed}`;
  };

  return (
    <div className={styles.card}>
      <p className={styles.instruction}>
        {isRetry && <span className={styles.retry}>Deuxième chance · </span>}
        {INSTRUCTIONS[question.mode]}
      </p>
      <h2 className={asksDefinition ? styles.term : styles.definition}>{question.prompt}</h2>

      <div className={styles.choices} role="group" aria-label="Propositions">
        {question.choices.map((choice) => (
          <button
            key={choice.wordId}
            type="button"
            className={`${choiceClass(choice.wordId)} ${asksDefinition ? "" : styles.termChoice}`}
            onClick={() => onAnswer(choice.wordId)}
            disabled={answered}
          >
            <span className={styles.label}>{choice.label}</span>
            {answered && choice.wordId === question.wordId && (
              <span className={styles.mark} aria-label="Bonne réponse">
                <CheckIcon size={20} />
              </span>
            )}
            {answered && choice.wordId === selectedWordId && !correct && (
              <span className={styles.mark} aria-label="Ta réponse">
                <CrossIcon size={20} />
              </span>
            )}
          </button>
        ))}
      </div>

      {answered && word && (
        <div className={styles.feedback} ref={feedbackRef} aria-live="polite">
          <p className={`${styles.verdict} ${correct ? styles.verdictGood : styles.verdictBad}`}>
            {correct ? <CheckIcon size={20} /> : <CrossIcon size={20} />}
            {correct ? "Bonne réponse" : "Ce n’était pas ça"}
          </p>
          <p className={styles.answerTerm}>{word.term}</p>
          <p className={styles.answerDefinition}>{word.definition}</p>
          {word.example && <p className={styles.example}>« {word.example} »</p>}
          <Button className={styles.next} fullWidth onClick={onNext}>
            {isLast ? "Voir le bilan" : "Continuer"}
          </Button>
        </div>
      )}
    </div>
  );
}
