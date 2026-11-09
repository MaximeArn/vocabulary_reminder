import { useState } from "react";
import type { OrderQuestion, Outcome, QuestionResponse } from "../../domain/quiz";
import { Button } from "../../ui/Button";
import { CheckIcon, CrossIcon } from "../../ui/icons";
import styles from "./OrderAnswer.module.css";

interface OrderAnswerProps {
  question: OrderQuestion;
  outcome: Outcome | null;
  onSubmit: (response: QuestionResponse) => void;
}

/**
 * Remettre dans l'ordre : on touche les événements du plus ancien au plus récent ;
 * chacun prend son numéro (le dernier se place seul), un nouveau toucher le retire.
 * Après validation, la liste se range dans le bon ordre, avec les dates.
 */
export function OrderAnswer({ question, outcome, onSubmit }: OrderAnswerProps) {
  const [picked, setPicked] = useState<string[]>([]);
  const all = question.entries.map((entry) => entry.itemId);

  if (outcome) {
    const placed = outcome.response.type === "order" ? outcome.response.itemIds : [];
    const gradeOf = new Map(outcome.grades.map((grade) => [grade.itemId, grade.correct]));
    const chronological = [...question.entries].sort((a, b) => a.rank - b.rank);
    return (
      <ol className={styles.list} aria-label="Ordre chronologique">
        {chronological.map((entry) => {
          const correct = gradeOf.get(entry.itemId) ?? false;
          const yours = placed.indexOf(entry.itemId) + 1;
          return (
            <li key={entry.itemId} className={`${styles.entry} ${correct ? styles.good : styles.bad}`}>
              <span className={styles.number}>{entry.rank + 1}</span>
              <span className={styles.text}>
                <span className={styles.label}>{entry.label}</span>
                <span className={styles.date}>
                  {entry.detail}
                  {!correct && yours > 0 && <span className={styles.yours}> · tu l’avais mis en {yours}ᵉ</span>}
                </span>
              </span>
              <span className={styles.mark} aria-label={correct ? "Bien placé" : "Mal placé"}>
                {correct ? <CheckIcon size={20} /> : <CrossIcon size={20} />}
              </span>
            </li>
          );
        })}
      </ol>
    );
  }

  const toggle = (itemId: string) => {
    if (picked.includes(itemId)) {
      setPicked(picked.filter((id) => id !== itemId));
      return;
    }
    const next = [...picked, itemId];
    // Le dernier événement n'a plus qu'une place possible.
    const remaining = all.filter((id) => !next.includes(id));
    setPicked(remaining.length === 1 ? [...next, remaining[0]!] : next);
  };

  return (
    <>
      <div className={styles.list} role="group" aria-label="Événements à classer">
        {question.entries.map((entry) => {
          const position = picked.indexOf(entry.itemId) + 1;
          return (
            <button
              key={entry.itemId}
              type="button"
              className={`${styles.entry} ${styles.pickable} ${position > 0 ? styles.picked : ""}`}
              aria-pressed={position > 0}
              aria-label={position > 0 ? `${entry.label}, en position ${position}` : entry.label}
              onClick={() => toggle(entry.itemId)}
            >
              <span className={styles.number} aria-hidden="true">
                {position > 0 ? position : ""}
              </span>
              <span className={styles.label}>{entry.label}</span>
            </button>
          );
        })}
      </div>
      <div className={styles.actions}>
        <Button fullWidth disabled={picked.length < all.length} onClick={() => onSubmit({ type: "order", itemIds: picked })}>
          Valider
        </Button>
        {picked.length > 0 && (
          <Button variant="quiet" fullWidth onClick={() => setPicked([])}>
            Recommencer
          </Button>
        )}
      </div>
    </>
  );
}
