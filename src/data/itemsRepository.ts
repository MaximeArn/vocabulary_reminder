import { db } from "./db";
import type { Item } from "../domain/types";

/** Opérations d'écriture sur les fiches. Les lectures passent par `useLiveQuery`. */

export async function addItem<Content>(kind: string, content: Content): Promise<Item<Content>> {
  const now = Date.now();
  const item: Item<Content> = { id: crypto.randomUUID(), kind, content, createdAt: now, updatedAt: now };
  await db.items.add(item);
  return item;
}

export async function updateItem<Content>(id: string, content: Content): Promise<void> {
  const updated = await db.items.update(id, { content, updatedAt: Date.now() });
  if (updated === 0) throw new Error("Cette fiche n’existe plus.");
}

/**
 * Suppression « douce » : la fiche est masquée (et son historique conservé),
 * pour pouvoir annuler et, plus tard, synchroniser la suppression.
 */
export async function deleteItem(id: string): Promise<void> {
  const now = Date.now();
  const updated = await db.items.update(id, { deletedAt: now, updatedAt: now });
  if (updated === 0) throw new Error("Cette fiche n’existe plus.");
}

/** Annule une suppression. */
export async function restoreItem(id: string): Promise<void> {
  // Avec Dexie, une valeur `undefined` retire la propriété.
  await db.items.update(id, { deletedAt: undefined, updatedAt: Date.now() });
}
