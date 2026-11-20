import { useState, type ComponentType } from "react";
import type { LocateQuestion, Outcome, QuestionResponse } from "../../domain/quiz";
import type { MapViewProps, ZoneTone } from "../../categories/views";
import { Button } from "../../ui/Button";
import styles from "./LocateAnswer.module.css";

interface LocateAnswerProps {
  question: LocateQuestion;
  Map: ComponentType<MapViewProps>;
  outcome: Outcome | null;
  onSubmit: (response: QuestionResponse) => void;
}

/**
 * « Touche ce département » : on choisit une zone sur la carte (zoom possible),
 * puis on valide. Après la réponse, la bonne zone est en vert, la mauvaise en rouge.
 */
export function LocateAnswer({ question, Map, outcome, onSubmit }: LocateAnswerProps) {
  const [selected, setSelected] = useState<string | null>(null);
  const touched = outcome?.response.type === "locate" ? outcome.response.zone : null;

  const tones: Record<string, ZoneTone> = {};
  if (outcome) {
    if (touched && touched !== question.target) tones[touched] = "bad";
    tones[question.target] = "good";
  } else if (selected) {
    tones[selected] = "selected";
  }

  return (
    <>
      <div className={styles.map}>
        <Map
          tones={tones}
          onSelect={outcome ? undefined : setSelected}
          label="Carte de France : touche la zone demandée"
        />
      </div>
      {!outcome && (
        <div className={styles.actions}>
          <Button fullWidth disabled={selected === null} onClick={() => selected && onSubmit({ type: "locate", zone: selected })}>
            Valider
          </Button>
          <p className={styles.hint}>Pince la carte ou utilise + et − pour zoomer ; Paris et l’outre-mer sont en encarts.</p>
        </div>
      )}
    </>
  );
}
