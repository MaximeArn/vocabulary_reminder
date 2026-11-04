import { describe, expect, it } from "vitest";
import { countDue, nextDueDay, planSession } from "./session";
import { seededRandom } from "./random";
import type { Word } from "./types";

const today = "2026-11-04";
const word = (id: string, box: number, dueDay: string, createdAt = 0): Word => ({
  id,
  term: id,
  termKey: id,
  definition: `déf ${id}`,
  createdAt,
  updatedAt: createdAt,
  box,
  dueDay,
  lapses: 0,
});

const words = [
  word("plus-tard", 3, "2026-11-20"),
  word("nouveau-recent", 0, today, 20),
  word("en-retard", 2, "2026-11-01"),
  word("du-jour", 4, today),
  word("nouveau-ancien", 0, today, 10),
  word("bientot", 1, "2026-11-05"),
];

describe("planSession", () => {
  it("prend les mots à réviser, puis les nouveaux, puis l'entraînement", () => {
    const ids = (size: number) =>
      planSession(words, today, size, "mixed", seededRandom(1))
        .map((item) => item.wordId)
        .sort();
    expect(ids(2)).toEqual(["du-jour", "en-retard"]);
    expect(ids(3)).toEqual(["du-jour", "en-retard", "nouveau-ancien"]);
    expect(ids(5)).toEqual(["bientot", "du-jour", "en-retard", "nouveau-ancien", "nouveau-recent"]);
  });

  it("ne dépasse pas la taille demandée ni le nombre de mots", () => {
    expect(planSession(words, today, 3, "mixed")).toHaveLength(3);
    expect(planSession(words, today, 20, "mixed")).toHaveLength(words.length);
  });

  it("alterne les deux sens en mode mixte", () => {
    const modes = planSession(words, today, 6, "mixed", seededRandom(4)).map((item) => item.mode);
    for (let index = 1; index < modes.length; index++) expect(modes[index]).not.toBe(modes[index - 1]);
  });

  it("respecte un sens imposé", () => {
    const modes = planSession(words, today, 6, "definition-to-word").map((item) => item.mode);
    expect(new Set(modes)).toEqual(new Set(["definition-to-word"]));
  });
});

describe("countDue / nextDueDay", () => {
  it("compte les mots dus, nouveaux compris", () => {
    expect(countDue(words, today)).toBe(4);
  });

  it("trouve le prochain jour de révision", () => {
    expect(nextDueDay(words, today)).toBe("2026-11-05");
    expect(nextDueDay([], today)).toBeUndefined();
  });
});
