import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../../data/db";
import type { Review } from "../../domain/types";

/** Historique complet des réponses, mis à jour automatiquement. */
export function useReviews(): Review[] | undefined {
  return useLiveQuery(() => db.reviews.toArray(), []);
}
