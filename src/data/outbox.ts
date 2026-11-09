import { db, type PendingChange, type SyncedTable } from "./db";

/**
 * File d'envoi : ce qui a été modifié localement et doit partir vers le serveur.
 *
 * Les dépôts appellent `markPending` dans la même transaction que l'écriture :
 * une modification ne peut donc pas être enregistrée sans être notée pour l'envoi.
 */

/** Réglages propres à l'appareil : jamais synchronisés ni exportés. */
const DEVICE_SETTING_PREFIXES = ["diagnostic.", "sync."];

export function isDeviceSetting(key: string): boolean {
  return DEVICE_SETTING_PREFIXES.some((prefix) => key.startsWith(prefix));
}

let versionCounter = 0;

/** Note des lignes à envoyer. À appeler dans une transaction qui inclut `db.outbox`. */
export async function markPending(table: SyncedTable, keys: string[]): Promise<void> {
  const keysToSend = table === "settings" ? keys.filter((key) => !isDeviceSetting(key)) : keys;
  if (keysToSend.length === 0) return;
  const version = Date.now() * 1000 + (versionCounter++ % 1000);
  await db.outbox.bulkPut(keysToSend.map((key) => ({ id: `${table}:${key}`, table, key, version })));
  notifyPendingChange();
}

/** Entrées en attente pour une table. */
export function pendingFor(table: SyncedTable): Promise<PendingChange[]> {
  return db.outbox.where("table").equals(table).toArray();
}

/** Retire les entrées envoyées, sauf celles modifiées entre-temps (nouvelle version). */
export async function clearSent(sent: PendingChange[]): Promise<void> {
  await db.transaction("rw", db.outbox, async () => {
    for (const change of sent) {
      const current = await db.outbox.get(change.id);
      if (current?.version === change.version) await db.outbox.delete(change.id);
    }
  });
}

/* ---------- Signal « il y a du nouveau à envoyer » ---------- */

type Listener = () => void;
const listeners = new Set<Listener>();

export function onPendingChange(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function notifyPendingChange() {
  // Après la fin de la transaction en cours : la synchronisation lira des données validées.
  setTimeout(() => listeners.forEach((listener) => listener()), 0);
}
