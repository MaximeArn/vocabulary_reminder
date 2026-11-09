import { describe, expect, it } from "vitest";
import { activityByDay, countByLevel, currentStreak } from "./progress";
import { card } from "../test/factories";
import type { Review } from "./types";

const review = (studyDay: string, correct = true, suffix = ""): Review => ({
  id: `${studyDay}-${correct}-${suffix}`,
  itemId: "x",
  answeredAt: 0,
  studyDay,
  exercise: "vocabulary.word-to-definition",
  correct,
});

describe("countByLevel", () => {
  it("compte les cartes par niveau", () => {
    const cards = [0, 1, 2, 3, 5, 6].map((box, index) => card(String(index), { box }));
    expect(countByLevel(cards)).toEqual({ new: 1, learning: 2, progressing: 1, mastered: 2 });
  });
});

describe("activityByDay", () => {
  it("regroupe les réponses par jour d'étude", () => {
    const reviews = [review("2026-11-03"), review("2026-11-03", false), review("2026-11-03", true, "b")];
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
