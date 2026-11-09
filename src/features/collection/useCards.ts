import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../../data/db";
import { buildCards, type Card } from "../../domain/card";
import { replayProgress } from "../../domain/srs";
import { findCategory } from "../../categories/registry";

/**
 * Toutes les cartes actives (fiches + progression), mises à jour automatiquement
 * à chaque modification de la base. `undefined` pendant le premier chargement.
 * Les fiches d'une catégorie inconnue (version plus récente de l'app) sont ignorées.
 */
export function useCards(): Card[] | undefined {
  return useLiveQuery(async () => {
    const [items, reviews] = await Promise.all([db.items.toArray(), db.reviews.toArray()]);
    return buildCards(
      items.filter((item) => findCategory(item.kind)),
      reviews,
    );
  }, []);
}

/** Une carte précise, ou `undefined` si elle est en cours de chargement ou supprimée. */
export function useCard(id: string): Card | undefined {
  return useLiveQuery(async () => {
    const item = await db.items.get(id);
    if (!item || item.deletedAt !== undefined) return undefined;
    const reviews = await db.reviews.where("itemId").equals(id).toArray();
    return { item, progress: replayProgress(item.createdAt, reviews) };
  }, [id]);
}
