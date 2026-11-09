import { db } from "./db";
import { markPending } from "./outbox";

/** Lecture et écriture des réglages (table clé / valeur). */

export async function readSetting<T>(key: string): Promise<T | undefined> {
  const setting = await db.settings.get(key);
  return setting?.value as T | undefined;
}

export async function writeSetting(key: string, value: unknown): Promise<void> {
  await db.transaction("rw", db.settings, db.outbox, async () => {
    await db.settings.put({ key, value, updatedAt: Date.now() });
    await markPending("settings", [key]);
  });
}
