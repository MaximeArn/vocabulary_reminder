import { useState } from "react";
import { Page } from "../../ui/Page";
import { Button } from "../../ui/Button";
import { formatLongDate, formatRelativeDay } from "../../ui/format";
import { MASTERY_LABELS, masteryLevel } from "../../domain/srs";
import { addDays } from "../../domain/studyDay";
import { useToday } from "../review/useToday";
import { useWord } from "./useWords";
import { useDeleteWord } from "./useDeleteWord";
import { WordFormSheet } from "./WordFormSheet";
import styles from "./WordDetailPage.module.css";

interface WordDetailPageProps {
  wordId: string;
  onClose: () => void;
}

/** Fiche d'un mot : lecture, modification, suppression. */
export function WordDetailPage({ wordId, onClose }: WordDetailPageProps) {
  const word = useWord(wordId);
  const today = useToday();
  const deleteWithUndo = useDeleteWord();
  const [editing, setEditing] = useState(false);

  if (!word) return null;

  const remove = async () => {
    if (await deleteWithUndo(word)) onClose();
  };

  return (
    <Page backLabel="Collection" onBack={onClose}>
      <article>
        <h1 className={styles.term}>{word.term}</h1>
        <p className={styles.definition}>{word.definition}</p>
        {word.example && <p className={styles.example}>« {word.example} »</p>}
        <p className={styles.meta}>
          {MASTERY_LABELS[masteryLevel(word.box)]} · révision {formatRelativeDay(word.dueDay, today, addDays(today, 1))}
          <br />
          Ajouté le {formatLongDate(word.createdAt)}
        </p>
      </article>

      <div className={styles.actions}>
        <Button variant="secondary" fullWidth onClick={() => setEditing(true)}>
          Modifier
        </Button>
        <Button variant="quiet" fullWidth className={styles.delete} onClick={remove}>
          Supprimer
        </Button>
      </div>

      {editing && <WordFormSheet word={word} onClose={() => setEditing(false)} />}
    </Page>
  );
}
