import Dexie, { type EntityTable } from "dexie";
import type { Review, Setting, Word } from "../domain/types";

/**
 * Base IndexedDB de l'application.
 *
 * Règle d'évolution : on ne modifie JAMAIS une version existante.
 * Pour changer le schéma, on ajoute `db.version(n + 1)` avec, si besoin,
 * une fonction `.upgrade()` qui migre les données.
 *
 * Seuls les champs indexés sont déclarés ici ; les autres champs sont
 * stockés tels quels avec chaque objet.
 */
export type LexiqueDatabase = Dexie & {
  words: EntityTable<Word, "id">;
  reviews: EntityTable<Review, "id">;
  settings: EntityTable<Setting, "key">;
};

export const db = new Dexie("lexique") as LexiqueDatabase;

db.version(1).stores({
  words: "id, termKey, createdAt, dueDay, box, source",
  reviews: "id, wordId, answeredAt",
  settings: "key",
});

// v2 : la notion de source (livre d'origine) est abandonnée, son index est supprimé.
db.version(2).stores({
  words: "id, termKey, createdAt, dueDay, box",
});
