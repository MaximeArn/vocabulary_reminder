import { useEffect, useState } from "react";
import { studyDayOf } from "../../domain/studyDay";

/**
 * Jour d'étude courant. Recalculé quand l'app revient au premier plan :
 * une app iOS peut rester ouverte en arrière-plan d'un jour à l'autre.
 */
export function useToday(): string {
  const [today, setToday] = useState(() => studyDayOf(new Date()));

  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState === "visible") setToday(studyDayOf(new Date()));
    };
    document.addEventListener("visibilitychange", refresh);
    return () => document.removeEventListener("visibilitychange", refresh);
  }, []);

  return today;
}
