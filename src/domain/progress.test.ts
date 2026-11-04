import { describe, expect, it } from "vitest";
import { activityByDay, countByLevel, currentStreak } from "./progress";
import type { Review, Word } from "./types";

const at = (day: string, hour = 12) => {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(y!, m! - 1, d!, hour).getTime();
};
const review = (day: string, correct = true, hour = 12): Review => ({
  id: `${day}-${hour}-${correct}`,
  wordId: "w",
  answeredAt: at(day, hour),
  mode: "word-to-definition",
  correct,
  boxBefore: 0,
  boxAfter: 1,
});

describe("countByLevel", () => {
  it("compte les mots par niveau", () => {
    const words = [0, 1, 2, 3, 5, 6].map((box) => ({ box }) as Word);
    expect(countByLevel(words)).toEqual({ new: 1, learning: 2, progressing: 1, mastered: 2 });
  });
});

describe("activityByDay", () => {
  it("regroupe les réponses par jour d'étude (une nuit compte pour la veille)", () => {
    const reviews = [review("2026-11-03"), review("2026-11-03", false), review("2026-11-04", true, 2)];
    expect(activityByDay(reviews, ["2026-11-03", "2026-11-04"])).toEqual([
      { day: "2026-11-03", answered: 3, correct: 2 },
      { day: "2026-11-04", answered: 0, correct: 0 },
    ]);
  });
});

describe("currentStreak", () => {
  it("compte les jours consécutifs jusqu'à aujourd'hui", () => {
    const reviews = ["2026-11-01", "2026-11-02", "2026-11-03", "2026-11-04"].map((day) => review(day));
    expect(currentStreak(reviews, "2026-11-04")).toBe(4);
  });

  it("conserve la série d'hier tant qu'aujourd'hui n'est pas fini", () => {
    expect(currentStreak([review("2026-11-02"), review("2026-11-03")], "2026-11-04")).toBe(2);
  });

  it("repart de zéro après un jour sans révision", () => {
    expect(currentStreak([review("2026-11-01"), review("2026-11-04")], "2026-11-04")).toBe(1);
    expect(currentStreak([review("2026-11-01")], "2026-11-04")).toBe(0);
  });
});
