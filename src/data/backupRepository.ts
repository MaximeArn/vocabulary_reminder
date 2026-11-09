import { db } from "./db";
import { isDeviceSetting, markPending } from "./outbox";
import type { BackupContent } from "../domain/backup";

/**
 * Lecture et remplacement de l'ensemble des données, pour la sauvegarde.
 * Les réglages propres à l'appareil ne sont pas exportés, ni les fiches
 * supprimées et leur historique.
 */

export async function readAllData(): Promise<BackupContent> {
  return db.transaction("r", db.items, db.reviews, db.settings, async () => {
    const items = (await db.items.toArray()).filter((item) => item.deletedAt === undefined);
    const ids = new Set(items.map((item) => item.id));
    return {
      items,
      reviews: (await db.reviews.toArray()).filter((review) => ids.has(review.itemId)),
      settings: (await db.settings.toArray()).filter((setting) => !isDeviceSetting(setting.key)),
    };
  });
}

/**
 * Remplace les fiches et les réglages par ceux de la sauvegarde, de façon
 * compatible avec la synchronisation :
 * - les fiches absentes de la sauvegarde sont supprimées « en douceur » (sinon le
 *   serveur les renverrait) ;
 * - les fiches et réglages restaurés sont datés de maintenant : restaurer est un
 *   choix explicite, il doit l'emporter sur les autres appareils ;
 * - l'historique des réponses est réuni avec celui de la sauvegarde (jamais effacé).
 * Tout se fait dans une seule transaction : en cas d'erreur, rien n'est modifié.
 */
export async function replaceAllData(content: BackupContent): Promise<void> {
  const now = Date.now();
  await db.transaction("rw", [db.items, db.reviews, db.settings, db.outbox], async () => {
    const restoredIds = new Set(content.items.map((item) => item.id));
    const removed = (await db.items.toArray()).filter((item) => !restoredIds.has(item.id) && item.deletedAt === undefined);
    await db.items.bulkPut(removed.map((item) => ({ ...item, deletedAt: now, updatedAt: now })));
    await db.items.bulkPut(content.items.map((item) => ({ ...item, updatedAt: now })));

    const existingReviews = new Set(await db.reviews.toCollection().primaryKeys());
    const newReviews = content.reviews.filter((review) => !existingReviews.has(review.id));
    await db.reviews.bulkAdd(newReviews);

    const settings = content.settings.filter((setting) => !isDeviceSetting(setting.key));
    await db.settings.bulkPut(settings.map((setting) => ({ ...setting, updatedAt: now })));

    await markPending("items", [...removed.map((item) => item.id), ...restoredIds]);
    await markPending("reviews", newReviews.map((review) => review.id));
    await markPending("settings", settings.map((setting) => setting.key));
  });
}
