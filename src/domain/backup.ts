import { itemFromLegacyWord, reviewFromLegacy, settingFromLegacy, type LegacyReview, type LegacyWord } from "./legacy";
import type { Item, Review, Setting } from "./types";

/**
 * Format du fichier de sauvegarde (JSON).
 *
 * v1 : vocabulaire seul (mots + progression). v2 : fiches de toutes catégories,
 * progression recalculée à partir de l'historique. Les sauvegardes v1 restent
 * importables. Un fichier plus récent que l'app est refusé plutôt qu'importé à moitié.
 */

export const BACKUP_APP_ID = "lexique";
export const BACKUP_SCHEMA_VERSION = 2;

export interface BackupContent {
  items: Item[];
  reviews: Review[];
  settings: Setting[];
}

export interface BackupFile extends BackupContent {
  app: typeof BACKUP_APP_ID;
  schemaVersion: number;
  exportedAt: string;
}

export function createBackup(content: BackupContent, now: Date): BackupFile {
  return {
    app: BACKUP_APP_ID,
    schemaVersion: BACKUP_SCHEMA_VERSION,
    exportedAt: now.toISOString(),
    ...content,
  };
}

/** Nom du fichier exporté, par exemple « lexique-2026-11-04.backup.json ». */
export function backupFileName(now: Date): string {
  const day = [now.getFullYear(), now.getMonth() + 1, now.getDate()]
    .map((part) => String(part).padStart(2, "0"))
    .join("-");
  return `lexique-${day}.backup.json`;
}

/* ---------- Lecture et validation ---------- */

/**
 * Valide le contenu d'une fiche selon sa catégorie. Renvoie `undefined` pour une
 * catégorie inconnue de cette version de l'app : la fiche est alors conservée telle quelle.
 */
export type ContentValidator = (kind: string, raw: unknown) => unknown;

export type ParseResult = { ok: true; backup: BackupFile } | { ok: false; error: string };

/** Erreur de validation, avec un message destiné à l'utilisateur. */
class InvalidBackupError extends Error {}

export function parseBackup(text: string, validateContent: ContentValidator): ParseResult {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return { ok: false, error: "Ce fichier n’est pas un fichier JSON valide." };
  }

  try {
    return { ok: true, backup: readBackup(json, validateContent) };
  } catch (error) {
    if (error instanceof InvalidBackupError) return { ok: false, error: error.message };
    // Erreur de contenu levée par une catégorie (InvalidContentError…)
    if (error instanceof Error) return { ok: false, error: error.message };
    throw error;
  }
}

function readBackup(json: unknown, validateContent: ContentValidator): BackupFile {
  if (!isRecord(json) || json.app !== BACKUP_APP_ID) {
    throw new InvalidBackupError("Ce fichier n’est pas une sauvegarde de Lexique.");
  }
  const version = json.schemaVersion;
  if (typeof version !== "number" || version < 1) {
    throw new InvalidBackupError("La version de cette sauvegarde est illisible.");
  }
  if (version > BACKUP_SCHEMA_VERSION) {
    throw new InvalidBackupError("Cette sauvegarde vient d’une version plus récente de l’app. Mets l’app à jour.");
  }

  const content = version === 1 ? readVersion1(json) : readVersion2(json, validateContent);

  const ids = new Set(content.items.map((item) => item.id));
  if (ids.size !== content.items.length) {
    throw new InvalidBackupError("La sauvegarde contient plusieurs fiches avec le même identifiant.");
  }

  return {
    app: BACKUP_APP_ID,
    schemaVersion: BACKUP_SCHEMA_VERSION,
    exportedAt: typeof json.exportedAt === "string" ? json.exportedAt : "",
    items: content.items,
    // On ignore les réponses de fiches absentes : elles ne serviraient à rien.
    reviews: content.reviews.filter((review) => ids.has(review.itemId)),
    settings: content.settings,
  };
}

/** Format v1 : mots de vocabulaire, convertis en fiches. */
function readVersion1(json: Record<string, unknown>): BackupContent {
  const items = readArray(json.words, "words").map((value, index) => {
    const where = `du mot n° ${index + 1}`;
    const record = expectRecord(value, where);
    const word: LegacyWord = {
      id: expectString(record, "id", where),
      term: expectString(record, "term", where),
      definition: expectString(record, "definition", where),
      example: optionalString(record, "example", where),
      createdAt: expectNumber(record, "createdAt", where),
      updatedAt: expectNumber(record, "updatedAt", where),
    };
    return itemFromLegacyWord(word);
  });
  const reviews = readArray(json.reviews ?? [], "reviews").map((value, index) => {
    const where = `de la révision n° ${index + 1}`;
    const record = expectRecord(value, where);
    const mode = record.mode;
    if (mode !== "word-to-definition" && mode !== "definition-to-word") {
      throw new InvalidBackupError(`Le mode ${where} est inconnu.`);
    }
    const review: LegacyReview = {
      id: expectString(record, "id", where),
      wordId: expectString(record, "wordId", where),
      answeredAt: expectNumber(record, "answeredAt", where),
      mode,
      correct: expectBoolean(record, "correct", where),
    };
    return reviewFromLegacy(review);
  });
  const settings = readSettings(json).map(settingFromLegacy);
  return { items, reviews, settings };
}

/** Format v2 : fiches génériques, contenu validé par sa catégorie. */
function readVersion2(json: Record<string, unknown>, validateContent: ContentValidator): BackupContent {
  const items = readArray(json.items, "items").map((value, index): Item => {
    const where = `de la fiche n° ${index + 1}`;
    const record = expectRecord(value, where);
    const kind = expectString(record, "kind", where);
    const item: Item = {
      id: expectString(record, "id", where),
      kind,
      content: validateContent(kind, record.content) ?? record.content,
      createdAt: expectNumber(record, "createdAt", where),
      updatedAt: expectNumber(record, "updatedAt", where),
    };
    if (record.deletedAt !== undefined) item.deletedAt = expectNumber(record, "deletedAt", where);
    return item;
  });
  const reviews = readArray(json.reviews ?? [], "reviews").map((value, index): Review => {
    const where = `de la révision n° ${index + 1}`;
    const record = expectRecord(value, where);
    return {
      id: expectString(record, "id", where),
      itemId: expectString(record, "itemId", where),
      answeredAt: expectNumber(record, "answeredAt", where),
      studyDay: expectString(record, "studyDay", where),
      exercise: expectString(record, "exercise", where),
      correct: expectBoolean(record, "correct", where),
    };
  });
  return { items, reviews, settings: readSettings(json) };
}

function readSettings(json: Record<string, unknown>): Setting[] {
  return readArray(json.settings ?? [], "settings").map((value, index) => {
    const where = `du réglage n° ${index + 1}`;
    const record = expectRecord(value, where);
    return { key: expectString(record, "key", where), value: record.value };
  });
}

/* ---------- Petits outils de validation ---------- */

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readArray(value: unknown, field: string): unknown[] {
  if (!Array.isArray(value)) throw new InvalidBackupError(`La liste « ${field} » est absente ou invalide.`);
  return value;
}

function expectRecord(value: unknown, where: string): Record<string, unknown> {
  if (!isRecord(value)) throw new InvalidBackupError(`Le contenu ${where} est invalide.`);
  return value;
}

function expectString(record: Record<string, unknown>, field: string, where: string): string {
  const value = record[field];
  if (typeof value !== "string" || value.trim() === "") {
    throw new InvalidBackupError(`Le champ « ${field} » ${where} est absent ou invalide.`);
  }
  return value;
}

function optionalString(record: Record<string, unknown>, field: string, where: string): string | undefined {
  const value = record[field];
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value !== "string") throw new InvalidBackupError(`Le champ « ${field} » ${where} est invalide.`);
  return value;
}

function expectNumber(record: Record<string, unknown>, field: string, where: string): number {
  const value = record[field];
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new InvalidBackupError(`Le champ « ${field} » ${where} est absent ou invalide.`);
  }
  return value;
}

function expectBoolean(record: Record<string, unknown>, field: string, where: string): boolean {
  if (typeof record[field] !== "boolean") {
    throw new InvalidBackupError(`Le champ « ${field} » ${where} est invalide.`);
  }
  return record[field] as boolean;
}
