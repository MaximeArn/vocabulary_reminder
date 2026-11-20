import { useState } from "react";
import { Page } from "../../ui/Page";
import { Button } from "../../ui/Button";
import { formatLongDate, formatRelativeDay } from "../../ui/format";
import { MASTERY_LABELS, masteryLevel, type Progress } from "../../domain/srs";
import { addDays } from "../../domain/studyDay";
import { findCategory } from "../../categories/registry";
import { trackOf } from "../../categories/cards";
import { useToday } from "../review/useToday";
import { useItemCards } from "./useCards";
import { useDeleteItem } from "./useDeleteItem";
import { ItemFormSheet } from "./ItemFormSheet";
import styles from "./CardDetailPage.module.css";

interface CardDetailPageProps {
  itemId: string;
  onClose: () => void;
}

/** Fiche détaillée : contenu (selon la catégorie), progression, modification, suppression. */
export function CardDetailPage({ itemId, onClose }: CardDetailPageProps) {
  const cards = useItemCards(itemId);
  const card = cards?.[0];
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
        {/* Fiche à volets (géographie) : la progression de chaque volet. */}
        {card.track !== undefined ? (
          <dl className={styles.tracks}>
            {cards.map((trackCard) => (
              <div key={trackCard.track} className={styles.track}>
                <dt>{trackOf(trackCard)?.shortLabel}</dt>
                <dd>{describeProgress(trackCard.progress, today)}</dd>
              </div>
            ))}
          </dl>
        ) : (
          <p className={styles.meta}>
            {describeProgress(card.progress, today)}
            {/* Une fiche intégrée n'a pas été « ajoutée » : elle fait partie de l'app. */}
            {!category.builtIn && (
              <>
                <br />
                Ajouté le {formatLongDate(card.item.createdAt)}
              </>
            )}
          </p>
        )}
      </article>

      {/* Une fiche intégrée (département) ne se modifie ni ne se supprime : elle fait partie de l'app. */}
      {!category.builtIn && (
        <div className={styles.actions}>
          <Button variant="secondary" fullWidth onClick={() => setEditing(true)}>
            Modifier
          </Button>
          <Button variant="quiet" fullWidth className={styles.delete} onClick={remove}>
            Supprimer
          </Button>
        </div>
      )}

      {editing && <ItemFormSheet kind={card.item.kind} item={card.item} onClose={() => setEditing(false)} />}
    </Page>
  );
}

/** « En apprentissage · révision demain ». */
function describeProgress(progress: Progress, today: string): string {
  return `${MASTERY_LABELS[masteryLevel(progress.box)]} · révision ${formatRelativeDay(progress.dueDay, today, addDays(today, 1))}`;
}
