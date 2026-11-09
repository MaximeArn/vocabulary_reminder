import { useLiveQuery } from "dexie-react-hooks";
import { readSetting, writeSetting } from "../../data/settingsRepository";
import { DEFAULT_SESSION_SIZE } from "../../domain/session";

/** Réglages de révision, conservés dans la base (et donc dans les sauvegardes). */

const SESSION_SIZE_KEY = "review.sessionSize";
const EXERCISE_KEY = "review.mode";

/** « mixed » : tous les exercices alternent ; sinon, l'identifiant d'un exercice imposé. */
export type ExercisePreference = "mixed" | string;

export function useReviewSettings() {
  const sessionSize = useLiveQuery(() => readSetting<number>(SESSION_SIZE_KEY), []) ?? DEFAULT_SESSION_SIZE;
  const exercisePreference = useLiveQuery(() => readSetting<ExercisePreference>(EXERCISE_KEY), []) ?? "mixed";

  return {
    sessionSize,
    exercisePreference,
    setSessionSize: (size: number) => writeSetting(SESSION_SIZE_KEY, size),
    setExercisePreference: (preference: ExercisePreference) => writeSetting(EXERCISE_KEY, preference),
  };
}
