import { useState } from "react";
import { Sheet } from "../../ui/Sheet";
import { useToast } from "../../ui/Toast";
import { addItem, updateItem } from "../../data/itemsRepository";
import { hasDraftErrors, type DraftErrors } from "../../categories/model";
import { findCategory } from "../../categories/registry";
import type { Item } from "../../domain/types";
import { useCards } from "./useCards";
import styles from "./ItemFormSheet.module.css";

interface ItemFormSheetProps {
  kind: string;
  /** Fiche à modifier ; absente pour un ajout. */
  item?: Item;
  onClose: () => void;
}

/**
 * Formulaire d'ajout ou de modification, commun à toutes les catégories :
 * la feuille, la validation et l'enregistrement sont ici ; les champs
 * viennent de la catégorie.
 */
export function ItemFormSheet({ kind, item, onClose }: ItemFormSheetProps) {
  const category = findCategory(kind);
  if (!category) throw new Error(`Catégorie inconnue : ${kind}`);

  const isEditing = item !== undefined;
  const initialDraft: unknown = isEditing ? category.draftFrom(item.content) : category.emptyDraft();

  const cards = useCards() ?? [];
  const showToast = useToast();
  const [draft, setDraft] = useState(initialDraft);
  const [errors, setErrors] = useState<DraftErrors>({});
  const [saving, setSaving] = useState(false);

  const sameKindItems = cards.filter((card) => card.item.kind === kind).map((card) => card.item);

  const change = (next: unknown) => {
    setDraft(next);
    setErrors({}); // les erreurs disparaissent dès que l'on corrige la saisie
  };

  const save = async () => {
    const found = category.validateDraft(draft);
    if (hasDraftErrors(found)) {
      setErrors(found);
      return;
    }
    setSaving(true);
    try {
      const content = category.contentFrom(draft);
      if (isEditing) {
        await updateItem(item.id, content);
        showToast({ message: "Modifications enregistrées" });
      } else {
        await addItem(kind, content);
        showToast({ message: `« ${category.title(content)} » ajouté à ta collection` });
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
        <category.Fields draft={draft} onChange={change} errors={errors} items={sameKindItems} editedId={item?.id} />
      </div>
    </Sheet>
  );
}
