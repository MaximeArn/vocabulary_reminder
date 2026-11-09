import { db } from "./db";

/**
 * Efface les données de l'appareil (fiches, historique, réglages, file d'envoi),
 * après une déconnexion ou avant d'accueillir un autre compte.
 * Les compteurs techniques du Diagnostic sont conservés.
 */
export async function clearLocalData(): Promise<void> {
  await db.transaction("rw", [db.items, db.reviews, db.settings, db.outbox], async () => {
    await db.items.clear();
    await db.reviews.clear();
    await db.outbox.clear();
    const keys = (await db.settings.toCollection().primaryKeys()).filter((key) => !key.startsWith("diagnostic."));
    await db.settings.bulkDelete(keys);
  });
}
