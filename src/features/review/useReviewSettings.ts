import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../../data/db";
import { writeSetting } from "../../data/settingsRepository";
import { DEFAULT_SESSION_SIZE } from "../../domain/session";

/** Réglages de révision, conservés dans la base (et donc dans les sauvegardes). */

const SESSION_SIZE_KEY = "review.sessionSize";
const CATEGORY_KEY = "review.category";
const exercisesKey = (kind: string) => `review.exercises.${kind}`;
/** Ancien réglage (vocabulaire seul), encore lu tant que le nouveau n'est pas défini. */
const LEGACY_VOCABULARY_KEY = "review.mode";

/** « mixed » : tous les exercices de la catégorie alternent ; sinon, l'identifiant d'un exercice imposé. */
export type ExercisePreference = "mixed" | string;

export function useReviewSettings() {
  const settings = useLiveQuery(() => db.settings.where("key").startsWith("review.").toArray(), []);
  const read = (key: string) => settings?.find((setting) => setting.key === key)?.value;

  const exercisePreference = (kind: string): ExercisePreference => {
    const value = read(exercisesKey(kind)) ?? (kind === "vocabulary" ? read(LEGACY_VOCABULARY_KEY) : undefined);
    return typeof value === "string" ? value : "mixed";
  };

  return {
    sessionSize: (read(SESSION_SIZE_KEY) as number | undefined) ?? DEFAULT_SESSION_SIZE,
    /** Catégorie révisée : « all » ou une catégorie. */
    categoryFilter: (read(CATEGORY_KEY) as string | undefined) ?? "all",
    exercisePreference,
    setSessionSize: (size: number) => writeSetting(SESSION_SIZE_KEY, size),
    setCategoryFilter: (kind: string) => writeSetting(CATEGORY_KEY, kind),
    setExercisePreference: (kind: string, preference: ExercisePreference) => writeSetting(exercisesKey(kind), preference),
  };
}
