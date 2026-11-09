import { db } from "./db";
import { markPending } from "./outbox";
import type { Item, Review } from "../domain/types";

/**
 * Opérations d'écriture sur les fiches. Les lectures passent par `useLiveQuery`.
 * Chaque écriture est notée dans la file d'envoi, dans la même transaction.
 */

export async function addItem<Content>(kind: string, content: Content): Promise<Item<Content>> {
  const now = Date.now();
  const item: Item<Content> = { id: crypto.randomUUID(), kind, content, createdAt: now, updatedAt: now };
  await db.transaction("rw", db.items, db.outbox, async () => {
    await db.items.add(item);
    await markPending("items", [item.id]);
  });
  return item;
}

export async function updateItem<Content>(id: string, content: Content): Promise<void> {
  await changeItem(id, { content, updatedAt: Date.now() });
}

/**
 * Suppression « douce » : la fiche est masquée (et son historique conservé),
 * pour pouvoir annuler et synchroniser la suppression entre appareils.
 */
export async function deleteItem(id: string): Promise<void> {
  const now = Date.now();
  await changeItem(id, { deletedAt: now, updatedAt: now });
}

/** Annule une suppression. */
export async function restoreItem(id: string): Promise<void> {
  // Avec Dexie, une valeur `undefined` retire la propriété.
  await changeItem(id, { deletedAt: undefined, updatedAt: Date.now() });
}

async function changeItem(id: string, changes: Partial<Item>): Promise<void> {
  await db.transaction("rw", db.items, db.outbox, async () => {
    const updated = await db.items.update(id, changes);
    if (updated === 0) throw new Error("Cette fiche n’existe plus.");
    await markPending("items", [id]);
  });
}

/** Une fiche à ajouter par lot : nouvelle (contenu seul) ou venant d'une sauvegarde (avec son historique). */
export interface BatchItem {
  kind: string;
  content: unknown;
  fromBackup?: { item: Item; reviews: Review[] };
}

/** Ajoute un lot de fiches en une seule transaction (tout ou rien), noté pour la synchronisation. */
export async function addItems(entries: BatchItem[]): Promise<number> {
  const now = Date.now();
  const items: Item[] = entries.map((entry, index) =>
    entry.fromBackup
      ? { ...entry.fromBackup.item, deletedAt: undefined }
      : { id: crypto.randomUUID(), kind: entry.kind, content: entry.content, createdAt: now + index, updatedAt: now + index },
  );
  const reviews = entries.flatMap((entry) => entry.fromBackup?.reviews ?? []);
  await db.transaction("rw", [db.items, db.reviews, db.outbox], async () => {
    await db.items.bulkAdd(items);
    const existingReviews = new Set(await db.reviews.where("id").anyOf(reviews.map((review) => review.id)).primaryKeys());
    const newReviews = reviews.filter((review) => !existingReviews.has(review.id));
    await db.reviews.bulkAdd(newReviews);
    await markPending("items", items.map((item) => item.id));
    await markPending("reviews", newReviews.map((review) => review.id));
  });
  return items.length;
}
