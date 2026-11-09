import { TextField } from "../../ui/TextField";
import type { FieldsProps } from "../views";
import { findSameTerm, type VocabularyContent, type VocabularyDraft } from "./model";
import styles from "./Vocabulary.module.css";

/** Champs du formulaire : mot, définition, exemple. */
export function VocabularyFields({
  draft,
  onChange,
  errors,
  items,
  editedId,
}: FieldsProps<VocabularyContent, VocabularyDraft>) {
  const sameTerm = findSameTerm(items, draft.term, editedId);
  const update = (field: keyof VocabularyDraft) => (value: string) => onChange({ ...draft, [field]: value });

  return (
    <>
      <TextField
        label="Mot"
        value={draft.term}
        onChange={update("term")}
        serif
        autoFocus={editedId === undefined}
        autoCapitalize="off"
        error={errors.term}
        hint={
          sameTerm &&
          `« ${sameTerm.content.term} » est déjà dans ta collection. Ajoute-le seulement s’il s’agit d’un autre sens.`
        }
      />
      <TextField
        label="Définition"
        value={draft.definition}
        onChange={update("definition")}
        multiline
        serif
        error={errors.definition}
      />
      <TextField label="Exemple" value={draft.example} onChange={update("example")} multiline optional />
    </>
  );
}

export function VocabularyDetail({ content }: { content: VocabularyContent }) {
  return (
    <>
      <h1 className={styles.term}>{content.term}</h1>
      <p className={styles.definition}>{content.definition}</p>
      {content.example && <p className={styles.example}>« {content.example} »</p>}
    </>
  );
}

export function VocabularyExplanation({ content }: { content: VocabularyContent }) {
  return (
    <>
      <p className={styles.answerTerm}>{content.term}</p>
      <p className={styles.answerDefinition}>{content.definition}</p>
      {content.example && <p className={styles.answerExample}>« {content.example} »</p>}
    </>
  );
}
