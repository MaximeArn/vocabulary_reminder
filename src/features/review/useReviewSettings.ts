import { useLiveQuery } from "dexie-react-hooks";
import { readSetting, writeSetting } from "../../data/settingsRepository";
import { DEFAULT_SESSION_SIZE, type SessionMode } from "../../domain/session";

/** Réglages de révision, conservés dans la base (et donc dans les sauvegardes). */

const SESSION_SIZE_KEY = "review.sessionSize";
const SESSION_MODE_KEY = "review.mode";

export function useReviewSettings() {
  const sessionSize = useLiveQuery(() => readSetting<number>(SESSION_SIZE_KEY), []) ?? DEFAULT_SESSION_SIZE;
  const sessionMode = useLiveQuery(() => readSetting<SessionMode>(SESSION_MODE_KEY), []) ?? "mixed";

  return {
    sessionSize,
    sessionMode,
    setSessionSize: (size: number) => writeSetting(SESSION_SIZE_KEY, size),
    setSessionMode: (mode: SessionMode) => writeSetting(SESSION_MODE_KEY, mode),
  };
}
