import { useRef, useState } from "react";
import type { Outcome, QuestionResponse, TypedQuestion } from "../../domain/quiz";
import { Button } from "../../ui/Button";
import { SegmentedControl } from "../../ui/SegmentedControl";
import styles from "./TypedAnswer.module.css";

interface TypedAnswerProps {
  question: TypedQuestion;
  outcome: Outcome | null;
  onSubmit: (response: QuestionResponse) => void;
}

type Era = "ad" | "bc";
const ERA_LABELS: Record<Era, string> = { ad: "apr. J.-C.", bc: "av. J.-C." };

/**
 * Réponse à taper : un mot (sans correction automatique du clavier, qui
 * fausserait l'exercice), ou une année avec son ère. « Je ne sais pas » compte
 * comme une erreur et montre la réponse.
 */
export function TypedAnswer({ question, outcome, onSubmit }: TypedAnswerProps) {
  const [text, setText] = useState("");
  const [era, setEra] = useState<Era>("ad");
  const inputRef = useRef<HTMLInputElement>(null);
  const answered = outcome !== null;
  const isYear = question.input === "year";

  const response = isYear ? (text === "" ? "" : `${era === "bc" ? "-" : ""}${text}`) : text;
  const submit = (value: string) => {
    // Le clavier se ferme : il cacherait la correction et le bouton « Continuer ».
    inputRef.current?.blur();
    onSubmit({ type: "typed", text: value });
  };

  const stateClass = !outcome ? "" : outcome.correct ? styles.good : styles.bad;

  return (
    <form
      className={styles.form}
      onSubmit={(event) => {
        event.preventDefault();
        if (!answered && text.trim() !== "") submit(response);
      }}
    >
      <div className={isYear ? styles.yearRow : undefined}>
        <input
          ref={inputRef}
          className={`${styles.input} ${isYear ? styles.year : ""} ${stateClass}`}
          aria-label={isYear ? "Année" : "Ta réponse"}
          // Le clavier s'ouvre dès la question (le focus suit le toucher sur « Continuer »).
          autoFocus
          value={text}
          onChange={(event) => setText(isYear ? event.target.value.replace(/\D/g, "").slice(0, 5) : event.target.value)}
          readOnly={answered}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="none"
          spellCheck={false}
          enterKeyHint="done"
          {...(isYear ? { inputMode: "numeric" as const, pattern: "[0-9]*", placeholder: "Année" } : { placeholder: "Le mot" })}
        />
        {isYear && (
          <SegmentedControl<Era>
            label="Ère"
            options={ERA_LABELS}
            value={era}
            onChange={(value) => !answered && setEra(value)}
          />
        )}
      </div>

      {!answered && (
        <div className={styles.actions}>
          <Button type="submit" fullWidth disabled={text.trim() === ""}>
            Valider
          </Button>
          <Button variant="quiet" fullWidth onClick={() => submit("")}>
            Je ne sais pas
          </Button>
        </div>
      )}
    </form>
  );
}
