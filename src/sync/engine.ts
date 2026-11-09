import { db } from "../data/db";
import { clearSent, isDeviceSetting, pendingFor } from "../data/outbox";
import { readSetting } from "../data/settingsRepository";
import {
  itemFromRemote,
  itemToRemote,
  reviewFromRemote,
  reviewToRemote,
  settingFromRemote,
  settingToRemote,
  type RemoteItem,
  type RemoteReview,
  type RemoteSetting,
} from "./mapping";
import { itemsToApply, reviewsToApply, settingsToApply } from "./merge";
import { pullAfter, pushItems, pushReviews, pushSettings, type RemoteTable } from "./remote";

/**
 * Une synchronisation complète : envoi de la file locale, puis réception de ce
 * qui a changé sur le serveur depuis la dernière fois.
 */

const BATCH_SIZE = 200;
const PAGE_SIZE = 500;
const ACCOUNT_KEY = "sync.userId";
const cursorKey = (table: RemoteTable) => `sync.cursor.${table}`;

export interface SyncReport {
  sent: number;
  received: number;
}

export async function synchronize(userId: string): Promise<SyncReport> {
  await prepareForAccount(userId);
  const sent = await pushAll();
  const received = await pullAll();
  return { sent, received };
}

/**
 * Premier passage d'un compte sur cet appareil (ou changement de compte) :
 * tout ce qui existe localement est mis en file d'envoi, et la réception repart de zéro.
 */
async function prepareForAccount(userId: string): Promise<void> {
  if ((await readSetting<string>(ACCOUNT_KEY)) === userId) return;
  await db.transaction("rw", [db.items, db.reviews, db.settings, db.outbox], async () => {
    const version = Date.now() * 1000;
    const itemIds = await db.items.toCollection().primaryKeys();
    const reviewIds = await db.reviews.toCollection().primaryKeys();
    const settingKeys = (await db.settings.toCollection().primaryKeys()).filter((key) => !isDeviceSetting(key));
    await db.outbox.bulkPut([
      ...itemIds.map((key) => ({ id: `items:${key}`, table: "items" as const, key, version })),
      ...reviewIds.map((key) => ({ id: `reviews:${key}`, table: "reviews" as const, key, version })),
      ...settingKeys.map((key) => ({ id: `settings:${key}`, table: "settings" as const, key, version })),
    ]);
    await db.settings.bulkPut([
      { key: ACCOUNT_KEY, value: userId },
      { key: cursorKey("items"), value: 0 },
      { key: cursorKey("reviews"), value: 0 },
      { key: cursorKey("settings"), value: 0 },
    ]);
  });
}

/* ---------- Envoi ---------- */

async function pushAll(): Promise<number> {
  // Ordre imposé : une réponse fait référence à sa fiche, qui doit exister côté serveur.
  return (await pushTable("items")) + (await pushTable("reviews")) + (await pushTable("settings"));
}

async function pushTable(table: RemoteTable): Promise<number> {
  const pending = await pendingFor(table);
  let sent = 0;
  for (let start = 0; start < pending.length; start += BATCH_SIZE) {
    const batch = pending.slice(start, start + BATCH_SIZE);
    const keys = batch.map((change) => change.key);
    switch (table) {
      case "items": {
        const items = (await db.items.bulkGet(keys)).filter((item) => item !== undefined);
        if (items.length > 0) await pushItems(items.map(itemToRemote));
        break;
      }
      case "reviews": {
        // Une réponse dont la fiche n'existe pas (donnée ancienne orpheline) n'est pas envoyée.
        const reviews = (await db.reviews.bulkGet(keys)).filter((review) => review !== undefined);
        const itemIds = new Set(await db.items.where("id").anyOf(reviews.map((review) => review.itemId)).primaryKeys());
        const valid = reviews.filter((review) => itemIds.has(review.itemId));
        if (valid.length > 0) await pushReviews(valid.map(reviewToRemote));
        break;
      }
      case "settings": {
        const settings = (await db.settings.bulkGet(keys)).filter((setting) => setting !== undefined);
        if (settings.length > 0) await pushSettings(settings.map(settingToRemote));
        break;
      }
    }
    await clearSent(batch);
    sent += batch.length;
  }
  return sent;
}

/* ---------- Réception ---------- */

async function pullAll(): Promise<number> {
  return (await pullTable("items")) + (await pullTable("reviews")) + (await pullTable("settings"));
}

async function pullTable(table: RemoteTable): Promise<number> {
  let cursor = (await readSetting<number>(cursorKey(table))) ?? 0;
  let received = 0;
  for (;;) {
    const rows = await pullAfter<RemoteItem & RemoteReview & RemoteSetting>(table, cursor, PAGE_SIZE);
    if (rows.length === 0) break;
    await applyRemote(table, rows);
    cursor = Math.max(cursor, ...rows.map((row) => Number(row.server_seq ?? 0)));
    // Écriture directe (pas de file d'envoi) : c'est un réglage de l'appareil.
    await db.settings.put({ key: cursorKey(table), value: cursor });
    received += rows.length;
    if (rows.length < PAGE_SIZE) break;
  }
  return received;
}

/** Fusionne des lignes reçues, sans les remettre dans la file d'envoi. */
async function applyRemote(table: RemoteTable, rows: (RemoteItem & RemoteReview & RemoteSetting)[]): Promise<void> {
  switch (table) {
    case "items":
      await db.transaction("rw", db.items, async () => {
        const remote = rows.map(itemFromRemote);
        const local = await db.items.bulkGet(remote.map((item) => item.id));
        const localById = new Map(local.filter((item) => item !== undefined).map((item) => [item.id, item]));
        await db.items.bulkPut(itemsToApply(remote, localById));
      });
      break;
    case "reviews":
      await db.transaction("rw", db.reviews, async () => {
        const remote = rows.map(reviewFromRemote);
        const existing = new Set(await db.reviews.where("id").anyOf(remote.map((review) => review.id)).primaryKeys());
        await db.reviews.bulkAdd(reviewsToApply(remote, existing));
      });
      break;
    case "settings":
      await db.transaction("rw", db.settings, async () => {
        const remote = rows.map(settingFromRemote).filter((setting) => !isDeviceSetting(setting.key));
        const local = await db.settings.bulkGet(remote.map((setting) => setting.key));
        const localByKey = new Map(local.filter((setting) => setting !== undefined).map((setting) => [setting.key, setting]));
        await db.settings.bulkPut(settingsToApply(remote, localByKey));
      });
      break;
  }
}
