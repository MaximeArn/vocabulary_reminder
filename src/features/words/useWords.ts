import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../../data/db";
import type { Word } from "../../domain/types";

/**
 * Tous les mots de la collection, mis à jour automatiquement à chaque
 * modification de la base. `undefined` pendant le premier chargement.
 */
export function useWords(): Word[] | undefined {
  return useLiveQuery(() => db.words.toArray(), []);
}

/** Un mot précis, ou `undefined` s'il est en cours de chargement ou supprimé. */
export function useWord(id: string): Word | undefined {
  return useLiveQuery(() => db.words.get(id), [id]);
}
