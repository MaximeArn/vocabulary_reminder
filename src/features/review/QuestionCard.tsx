import { useEffect, useRef } from "react";
import type { Card } from "../../domain/card";
import type { Outcome, Question, QuestionResponse } from "../../domain/quiz";
import { findExercise } from "../../categories/registry";
import { Button } from "../../ui/Button";
import { CheckIcon, CrossIcon } from "../../ui/icons";
import { ChoiceAnswer } from "./ChoiceAnswer";
import { TypedAnswer } from "./TypedAnswer";
import { OrderAnswer } from "./OrderAnswer";
import styles from "./QuestionCard.module.css";

interface QuestionCardProps {
  question: Question;
  /** La carte demandée, pour afficher l'explication après la réponse. */
  card: Card | undefined;
  isRetry: boolean;
  outcome: Outcome | null;
  isLast: boolean;
  onSubmit: (response: QuestionResponse) => void;
  onNext: () => void;
}

export function QuestionCard({ question, card, isRetry, outcome, isLast, onSubmit, onNext }: QuestionCardProps) {
  const found = findExercise(question.exercise);
  const feedbackRef = useRef<HTMLDivElement>(null);
  const answered = outcome !== null;

  // Après la réponse, on amène le retour (et le bouton Continuer) à l'écran.
  useEffect(() => {
    if (answered) feedbackRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [answered]);

  if (!found) return null;
  const { category, exercise } = found;

  return (
    <div className={styles.card}>
      <div className={styles.category} style={{ color: category.color }}>
        {category.label}
      </div>
      <p className={styles.instruction}>
        {isRetry && <span className={styles.retry}>Deuxième chance · </span>}
        {question.instruction ?? exercise.instruction}
      </p>
      <h2 className={question.type === "order" ? styles.orderPrompt : exercise.promptStyle === "headline" ? styles.term : styles.definition}>
        {question.prompt}
      </h2>

      {question.type === "choice" && (
        <ChoiceAnswer question={question} longChoices={exercise.choiceStyle === "long"} outcome={outcome} onSubmit={onSubmit} />
      )}
      {question.type === "typed" && <TypedAnswer question={question} outcome={outcome} onSubmit={onSubmit} />}
      {question.type === "order" && <OrderAnswer question={question} outcome={outcome} onSubmit={onSubmit} />}

      {outcome && card && (
        <div className={styles.feedback} ref={feedbackRef} aria-live="polite">
          <Verdict question={question} outcome={outcome} />
          {/* Un classement montre déjà les dates : pas d'explication d'une seule fiche. */}
          {question.type !== "order" && <category.Explanation content={card.item.content} />}
          <Button className={styles.next} fullWidth onClick={onNext}>
            {isLast ? "Voir le bilan" : "Continuer"}
          </Button>
        </div>
      )}
    </div>
  );
}

/** Verdict, et pour une réponse tapée : l'orthographe exacte ou la bonne réponse. */
function Verdict({ question, outcome }: { question: Question; outcome: Outcome }) {
  let title = outcome.correct ? "Bonne réponse" : "Ce n’était pas ça";
  let detail: React.ReactNode = null;

  if (question.type === "typed") {
    const typed = outcome.typed;
    if (outcome.correct && typed && !typed.exact) {
      title = "Juste, à l’orthographe près";
      detail = (
        <>
          On écrit <strong>{question.expected}</strong>
        </>
      );
    } else if (!outcome.correct) {
      detail = (
        <>
          Réponse : <strong>{question.expected}</strong>
          {typed?.detail && <span className={styles.gap}> · {typed.detail}</span>}
        </>
      );
    }
  }
  if (question.type === "order") {
    const misplaced = outcome.grades.filter((grade) => !grade.correct).length;
    title = outcome.correct ? "Bon ordre" : `${misplaced} ${misplaced > 1 ? "événements mal placés" : "événement mal placé"}`;
  }

  return (
    <>
      <p className={`${styles.verdict} ${outcome.correct ? styles.verdictGood : styles.verdictBad}`}>
        {outcome.correct ? <CheckIcon size={20} /> : <CrossIcon size={20} />}
        {title}
      </p>
      {detail && <p className={styles.expected}>{detail}</p>}
    </>
  );
}
