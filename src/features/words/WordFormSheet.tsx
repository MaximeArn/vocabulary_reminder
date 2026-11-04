import { useId, useState } from "react";
import { Sheet } from "../../ui/Sheet";
import { TextField } from "../../ui/TextField";
import { useToast } from "../../ui/Toast";
import { addWord, updateWord } from "../../data/wordsRepository";
import { distinctSources, findSameTerm } from "../../domain/collection";
import {
  EMPTY_DRAFT,
  draftFromWord,
  hasErrors,
  validateDraft,
  type DraftErrors,
  type WordDraft,
} from "../../domain/word";
import type { Word } from "../../domain/types";
import { useWords } from "./useWords";
import styles from "./WordFormSheet.module.css";

interface WordFormSheetProps {
  /** Mot à modifier ; absent pour un ajout. */
  word?: Word;
  onClose: () => void;
}

/** Formulaire d'ajout ou de modification d'un mot. */
export function WordFormSheet({ word, onClose }: WordFormSheetProps) {
  const isEditing = word !== undefined;
  const initialDraft = isEditing ? draftFromWord(word) : EMPTY_DRAFT;

  const words = useWords() ?? [];
  const showToast = useToast();
  const sourcesListId = useId();
  const [draft, setDraft] = useState<WordDraft>(initialDraft);
  const [errors, setErrors] = useState<DraftErrors>({});
  const [saving, setSaving] = useState(false);

  const sameTerm = findSameTerm(words, draft.term, word?.id);

  const updateField = (field: keyof WordDraft) => (value: string) => {
    setDraft((current) => ({ ...current, [field]: value }));
    if (field in errors) setErrors((current) => ({ ...current, [field]: undefined }));
  };

  const save = async () => {
    const found = validateDraft(draft);
    if (hasErrors(found)) {
      setErrors(found);
      return;
    }
    setSaving(true);
    try {
      if (isEditing) {
        await updateWord(word.id, draft);
        showToast({ message: "Modifications enregistrées" });
      } else {
        const added = await addWord(draft);
        showToast({ message: `« ${added.term} » ajouté à ta collection` });
      }
      onClose();
    } catch {
      setSaving(false);
      showToast({ message: "L’enregistrement a échoué. Réessaie." });
    }
  };

  const cancel = () => {
    const changed = JSON.stringify(draft) !== JSON.stringify(initialDraft);
    if (changed && !window.confirm("Abandonner les modifications ?")) return;
    onClose();
  };

  return (
    <Sheet
      title={isEditing ? "Modifier" : "Nouveau mot"}
      confirmLabel={isEditing ? "Enregistrer" : "Ajouter"}
      onConfirm={save}
      onCancel={cancel}
      confirmDisabled={saving}
    >
      <div className={styles.form}>
        <TextField
          label="Mot"
          value={draft.term}
          onChange={updateField("term")}
          serif
          autoFocus={!isEditing}
          autoCapitalize="off"
          error={errors.term}
          hint={sameTerm && `« ${sameTerm.term} » est déjà dans ta collection. Ajoute-le seulement s’il s’agit d’un autre sens.`}
        />
        <TextField
          label="Définition"
          value={draft.definition}
          onChange={updateField("definition")}
          multiline
          serif
          error={errors.definition}
        />
        <TextField label="Exemple" value={draft.example} onChange={updateField("example")} multiline optional />
        <TextField
          label="Source"
          value={draft.source}
          onChange={updateField("source")}
          optional
          autoCapitalize="words"
          suggestionsId={sourcesListId}
          hint="Le livre où tu l’as rencontré."
        />
        <datalist id={sourcesListId}>
          {distinctSources(words).map((source) => (
            <option key={source} value={source} />
          ))}
        </datalist>
      </div>
    </Sheet>
  );
}
