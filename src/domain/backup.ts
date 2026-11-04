import { comparisonKey } from "./text";
import type { QuizMode, Review, Setting, Word } from "./types";

/**
 * Format du fichier de sauvegarde (JSON).
 *
 * `schemaVersion` augmentera si le format change ; `parseBackup` devra alors
 * savoir convertir les anciennes versions. Un fichier plus récent que l'app
 * est refusé plutôt qu'importé à moitié.
 */

export const BACKUP_APP_ID = "lexique";
export const BACKUP_SCHEMA_VERSION = 1;

export interface BackupFile {
  app: typeof BACKUP_APP_ID;
  schemaVersion: number;
  exportedAt: string;
  words: Word[];
  reviews: Review[];
  settings: Setting[];
}

export interface BackupContent {
  words: Word[];
  reviews: Review[];
  settings: Setting[];
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

export type ParseResult = { ok: true; backup: BackupFile } | { ok: false; error: string };

/** Erreur de validation, avec un message destiné à l'utilisateur. */
class InvalidBackupError extends Error {}

export function parseBackup(text: string): ParseResult {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return { ok: false, error: "Ce fichier n’est pas un fichier JSON valide." };
  }

  try {
    return { ok: true, backup: readBackup(json) };
  } catch (error) {
    if (error instanceof InvalidBackupError) return { ok: false, error: error.message };
    throw error;
  }
}

function readBackup(json: unknown): BackupFile {
  if (!isRecord(json) || json.app !== BACKUP_APP_ID) {
    throw new InvalidBackupError("Ce fichier n’est pas une sauvegarde de Lexique.");
  }
  if (typeof json.schemaVersion !== "number" || json.schemaVersion < 1) {
    throw new InvalidBackupError("La version de cette sauvegarde est illisible.");
  }
  if (json.schemaVersion > BACKUP_SCHEMA_VERSION) {
    throw new InvalidBackupError("Cette sauvegarde vient d’une version plus récente de l’app. Mets l’app à jour.");
  }

  const words = readArray(json.words, "words").map(readWord);
  const reviews = readArray(json.reviews ?? [], "reviews").map(readReview);
  const settings = readArray(json.settings ?? [], "settings").map(readSetting);

  const ids = new Set(words.map((word) => word.id));
  if (ids.size !== words.length) {
    throw new InvalidBackupError("La sauvegarde contient plusieurs mots avec le même identifiant.");
  }

  return {
    app: BACKUP_APP_ID,
    schemaVersion: BACKUP_SCHEMA_VERSION,
    exportedAt: typeof json.exportedAt === "string" ? json.exportedAt : "",
    words,
    // On ignore les révisions de mots absents : elles ne serviraient à rien.
    reviews: reviews.filter((review) => ids.has(review.wordId)),
    settings,
  };
}

function readWord(value: unknown, index: number): Word {
  const where = `du mot n° ${index + 1}`;
  const record = expectRecord(value, where);
  const term = expectString(record, "term", where);
  return {
    id: expectString(record, "id", where),
    term,
    // Recalculée plutôt que lue : elle dépend de l'algorithme de cette version.
    termKey: comparisonKey(term),
    definition: expectString(record, "definition", where),
    example: optionalString(record, "example", where),
    source: optionalString(record, "source", where),
    createdAt: expectNumber(record, "createdAt", where),
    updatedAt: expectNumber(record, "updatedAt", where),
    box: expectNumber(record, "box", where),
    dueDay: expectString(record, "dueDay", where),
    lapses: expectNumber(record, "lapses", where),
  };
}

const QUIZ_MODES: QuizMode[] = ["word-to-definition", "definition-to-word"];

function readReview(value: unknown, index: number): Review {
  const where = `de la révision n° ${index + 1}`;
  const record = expectRecord(value, where);
  const mode = record.mode;
  if (!QUIZ_MODES.includes(mode as QuizMode)) {
    throw new InvalidBackupError(`Le mode ${where} est inconnu.`);
  }
  if (typeof record.correct !== "boolean") {
    throw new InvalidBackupError(`Le champ « correct » ${where} est invalide.`);
  }
  return {
    id: expectString(record, "id", where),
    wordId: expectString(record, "wordId", where),
    answeredAt: expectNumber(record, "answeredAt", where),
    mode: mode as QuizMode,
    correct: record.correct,
    boxBefore: expectNumber(record, "boxBefore", where),
    boxAfter: expectNumber(record, "boxAfter", where),
  };
}

function readSetting(value: unknown, index: number): Setting {
  const where = `du réglage n° ${index + 1}`;
  const record = expectRecord(value, where);
  return { key: expectString(record, "key", where), value: record.value };
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
