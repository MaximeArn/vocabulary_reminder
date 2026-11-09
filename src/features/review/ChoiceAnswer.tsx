import type { ChoiceQuestion, Outcome, QuestionResponse } from "../../domain/quiz";
import { CheckIcon, CrossIcon } from "../../ui/icons";
import styles from "./QuestionCard.module.css";

interface ChoiceAnswerProps {
  question: ChoiceQuestion;
  /** Propositions longues (des définitions) ou courtes (des mots, des dates). */
  longChoices: boolean;
  outcome: Outcome | null;
  onSubmit: (response: QuestionResponse) => void;
}

/** Quatre propositions ; après la réponse, la bonne et la mauvaise sont marquées. */
export function ChoiceAnswer({ question, longChoices, outcome, onSubmit }: ChoiceAnswerProps) {
  const selected = outcome?.response.type === "choice" ? outcome.response.choiceId : null;
  const answered = outcome !== null;

  const choiceClass = (choiceId: string) => {
    const base = `${styles.choice} ${longChoices ? "" : styles.termChoice}`;
    if (!answered) return base;
    if (choiceId === question.correctChoiceId) return `${base} ${styles.correct}`;
    if (choiceId === selected) return `${base} ${styles.wrong}`;
    return `${base} ${styles.dimmed}`;
  };

  return (
    <div className={styles.choices} role="group" aria-label="Propositions">
      {question.choices.map((choice) => (
        <button
          key={choice.id}
          type="button"
          className={choiceClass(choice.id)}
          onClick={() => onSubmit({ type: "choice", choiceId: choice.id })}
          disabled={answered}
        >
          <span className={styles.label}>{choice.label}</span>
          {answered && choice.id === question.correctChoiceId && (
            <span className={styles.mark} aria-label="Bonne réponse">
              <CheckIcon size={20} />
            </span>
          )}
          {answered && choice.id === selected && selected !== question.correctChoiceId && (
            <span className={styles.mark} aria-label="Ta réponse">
              <CrossIcon size={20} />
            </span>
          )}
        </button>
      ))}
    </div>
  );
}
