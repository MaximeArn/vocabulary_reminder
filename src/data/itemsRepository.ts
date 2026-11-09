import { db } from "./db";
import { markPending } from "./outbox";
import type { Item } from "../domain/types";

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
