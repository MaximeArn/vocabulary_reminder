import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../../data/db";
import type { Card } from "../../domain/card";
import { buildCards } from "../../categories/cards";
import { findCategory } from "../../categories/registry";

/**
 * Toutes les cartes actives (fiches + progression), mises à jour automatiquement
 * à chaque modification de la base. `undefined` pendant le premier chargement.
 * Une fiche à volets (géographie) donne une carte par volet.
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

/**
 * Les cartes d'une fiche (une par volet, ou une seule), ou `undefined` si elle est
 * en cours de chargement ou supprimée.
 */
export function useItemCards(id: string): Card[] | undefined {
  return useLiveQuery(async () => {
    const item = await db.items.get(id);
    if (!item || item.deletedAt !== undefined) return undefined;
    const reviews = await db.reviews.where("itemId").equals(id).toArray();
    return buildCards([item], reviews);
  }, [id]);
}
