import { useState } from "react";
import { Page } from "../../ui/Page";
import { Button } from "../../ui/Button";
import { formatLongDate, formatRelativeDay } from "../../ui/format";
import { MASTERY_LABELS, masteryLevel } from "../../domain/srs";
import { addDays } from "../../domain/studyDay";
import { findCategory } from "../../categories/registry";
import { useToday } from "../review/useToday";
import { useCard } from "./useCards";
import { useDeleteItem } from "./useDeleteItem";
import { ItemFormSheet } from "./ItemFormSheet";
import styles from "./CardDetailPage.module.css";

interface CardDetailPageProps {
  itemId: string;
  onClose: () => void;
}

/** Fiche détaillée : contenu (selon la catégorie), progression, modification, suppression. */
export function CardDetailPage({ itemId, onClose }: CardDetailPageProps) {
  const card = useCard(itemId);
  const today = useToday();
  const deleteWithUndo = useDeleteItem();
  const [editing, setEditing] = useState(false);

  const category = card && findCategory(card.item.kind);
  if (!card || !category) return null;

  const remove = async () => {
    if (await deleteWithUndo(card.item)) onClose();
  };

  return (
    <Page backLabel="Collection" onBack={onClose}>
      <article>
        <p className={styles.category} style={{ color: category.color }}>
          {category.label}
        </p>
        <category.Detail content={card.item.content} />
        <p className={styles.meta}>
          {MASTERY_LABELS[masteryLevel(card.progress.box)]} · révision{" "}
          {formatRelativeDay(card.progress.dueDay, today, addDays(today, 1))}
          <br />
          Ajouté le {formatLongDate(card.item.createdAt)}
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

      {editing && <ItemFormSheet kind={card.item.kind} item={card.item} onClose={() => setEditing(false)} />}
    </Page>
  );
}
