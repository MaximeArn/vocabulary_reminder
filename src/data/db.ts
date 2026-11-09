import Dexie, { type EntityTable, type Transaction } from "dexie";
import { itemFromLegacyWord, reviewFromLegacy, settingFromLegacy, type LegacyReview, type LegacyWord } from "../domain/legacy";
import { progressByItem } from "../domain/srs";
import type { Item, Review, Setting } from "../domain/types";

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
  items: EntityTable<Item, "id">;
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

// v3 : modèle générique. Les mots deviennent des fiches de la catégorie « vocabulary »,
// la progression n'est plus stockée mais recalculée à partir de l'historique.
db.version(3)
  .stores({
    items: "id, kind, createdAt",
    reviews: "id, itemId, answeredAt, studyDay",
  })
  .upgrade(migrateToGenericModel);

// v4 : suppression de l'ancienne table des mots, une fois la migration faite.
db.version(4).stores({
  words: null,
});

/** Résultat de la vérification de la migration v3, affiché dans le Diagnostic. */
export const MIGRATION_V3_KEY = "diagnostic.migrationV3";

export interface MigrationReport {
  checkedItems: number;
  /** Fiches dont la progression rejouée diffère de l'ancienne progression stockée. */
  mismatches: { id: string; term: string; stored: string; replayed: string }[];
}

async function migrateToGenericModel(tx: Transaction): Promise<void> {
  const words = (await tx.table("words").toArray()) as LegacyWord[];
  const items = words.map(itemFromLegacyWord);
  await tx.table("items").bulkAdd(items);

  const reviews: Review[] = [];
  await tx
    .table("reviews")
    .toCollection()
    .modify((legacy: LegacyReview, ref: { value: unknown }) => {
      const review = reviewFromLegacy(legacy);
      reviews.push(review);
      ref.value = review;
    });

  await tx
    .table("settings")
    .toCollection()
    .modify((setting: Setting, ref: { value: unknown }) => {
      ref.value = settingFromLegacy(setting);
    });

  // Vérification : le rejeu de l'historique doit redonner la progression stockée.
  const replayed = progressByItem(items, reviews);
  const describe = (box: number | undefined, dueDay: string | undefined, lapses: number | undefined) =>
    `boîte ${box ?? 0}, ${dueDay ?? "?"}, ${lapses ?? 0} oubli(s)`;
  const report: MigrationReport = { checkedItems: words.length, mismatches: [] };
  for (const word of words) {
    const progress = replayed.get(word.id);
    const stored = describe(word.box, word.dueDay, word.lapses);
    const computed = describe(progress?.box, progress?.dueDay, progress?.lapses);
    if (stored !== computed) report.mismatches.push({ id: word.id, term: word.term, stored, replayed: computed });
  }
  await tx.table("settings").put({ key: MIGRATION_V3_KEY, value: report });
}
