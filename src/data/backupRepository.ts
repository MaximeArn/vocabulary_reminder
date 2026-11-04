import { db } from "./db";
import type { BackupContent } from "../domain/backup";

/**
 * Lecture et remplacement de l'ensemble des données, pour la sauvegarde.
 * Les réglages techniques propres à l'appareil (diagnostic) ne sont pas exportés.
 */

const DEVICE_SETTING_PREFIX = "diagnostic.";

const isPortableSetting = (key: string) => !key.startsWith(DEVICE_SETTING_PREFIX);

export async function readAllData(): Promise<BackupContent> {
  return db.transaction("r", db.words, db.reviews, db.settings, async () => ({
    words: await db.words.toArray(),
    reviews: await db.reviews.toArray(),
    settings: (await db.settings.toArray()).filter((setting) => isPortableSetting(setting.key)),
  }));
}

/**
 * Remplace toutes les données par celles de la sauvegarde.
 * Tout se fait dans une seule transaction : en cas d'erreur, rien n'est modifié.
 */
export async function replaceAllData(content: BackupContent): Promise<void> {
  await db.transaction("rw", db.words, db.reviews, db.settings, async () => {
    await db.words.clear();
    await db.reviews.clear();
    const portableKeys = (await db.settings.toCollection().primaryKeys()).filter(isPortableSetting);
    await db.settings.bulkDelete(portableKeys);

    await db.words.bulkAdd(content.words);
    await db.reviews.bulkAdd(content.reviews);
    await db.settings.bulkPut(content.settings.filter((setting) => isPortableSetting(setting.key)));
  });
}
