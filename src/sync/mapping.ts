import type { Item, Review, Setting } from "../domain/types";

/**
 * Conversion entre le format local (IndexedDB) et les lignes PostgreSQL.
 * Les horodatages sont des millisecondes des deux côtés : aucune perte de précision.
 */

export interface RemoteItem {
  id: string;
  kind: string;
  content: unknown;
  created_at: number;
  updated_at: number;
  deleted_at: number | null;
  server_seq?: number;
}

export interface RemoteReview {
  id: string;
  item_id: string;
  answered_at: number;
  study_day: string;
  exercise: string;
  correct: boolean;
  server_seq?: number;
}

export interface RemoteSetting {
  key: string;
  value: unknown;
  updated_at: number;
  server_seq?: number;
}

export function itemToRemote(item: Item): RemoteItem {
  return {
    id: item.id,
    kind: item.kind,
    content: item.content,
    created_at: item.createdAt,
    updated_at: item.updatedAt,
    deleted_at: item.deletedAt ?? null,
  };
}

export function itemFromRemote(row: RemoteItem): Item {
  const item: Item = {
    id: row.id,
    kind: row.kind,
    content: row.content,
    createdAt: Number(row.created_at),
    updatedAt: Number(row.updated_at),
  };
  if (row.deleted_at !== null && row.deleted_at !== undefined) item.deletedAt = Number(row.deleted_at);
  return item;
}

export function reviewToRemote(review: Review): RemoteReview {
  return {
    id: review.id,
    item_id: review.itemId,
    answered_at: review.answeredAt,
    study_day: review.studyDay,
    exercise: review.exercise,
    correct: review.correct,
  };
}

export function reviewFromRemote(row: RemoteReview): Review {
  return {
    id: row.id,
    itemId: row.item_id,
    answeredAt: Number(row.answered_at),
    studyDay: row.study_day,
    exercise: row.exercise,
    correct: row.correct,
  };
}

export function settingToRemote(setting: Setting): RemoteSetting {
  return { key: setting.key, value: setting.value ?? null, updated_at: setting.updatedAt ?? 0 };
}

export function settingFromRemote(row: RemoteSetting): Setting {
  return { key: row.key, value: row.value, updatedAt: Number(row.updated_at) };
}
