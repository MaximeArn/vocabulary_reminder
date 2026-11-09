import { describe, expect, it } from "vitest";
import { countDue, nextDueDay, planSession } from "./session";
import { seededRandom } from "./random";
import { card } from "../test/factories";

const today = "2026-11-04";
const cards = [
  card("plus-tard", { box: 3, dueDay: "2026-11-20" }),
  card("nouveau-recent", { box: 0, dueDay: today }, 20),
  card("en-retard", { box: 2, dueDay: "2026-11-01" }),
  card("du-jour", { box: 4, dueDay: today }),
  card("nouveau-ancien", { box: 0, dueDay: today }, 10),
  card("bientot", { box: 1, dueDay: "2026-11-05" }),
];
const bothDirections = () => ["vocabulary.word-to-definition", "vocabulary.definition-to-word"];

describe("planSession", () => {
  it("prend les cartes à réviser, puis les nouvelles, puis l'entraînement", () => {
    const ids = (size: number) =>
      planSession(cards, today, size, bothDirections, seededRandom(1))
        .map((item) => item.itemId)
        .sort();
    expect(ids(2)).toEqual(["du-jour", "en-retard"]);
    expect(ids(3)).toEqual(["du-jour", "en-retard", "nouveau-ancien"]);
    expect(ids(5)).toEqual(["bientot", "du-jour", "en-retard", "nouveau-ancien", "nouveau-recent"]);
  });

  it("ne dépasse pas la taille demandée ni le nombre de cartes", () => {
    expect(planSession(cards, today, 3, bothDirections)).toHaveLength(3);
    expect(planSession(cards, today, 20, bothDirections)).toHaveLength(cards.length);
  });

  it("alterne les types d'exercice d'une question à l'autre", () => {
    const exercises = planSession(cards, today, 6, bothDirections, seededRandom(4)).map((item) => item.exercise);
    for (let index = 1; index < exercises.length; index++) expect(exercises[index]).not.toBe(exercises[index - 1]);
  });

  it("respecte un exercice imposé", () => {
    const exercises = planSession(cards, today, 6, () => ["vocabulary.definition-to-word"]).map((item) => item.exercise);
    expect(new Set(exercises)).toEqual(new Set(["vocabulary.definition-to-word"]));
  });

  it("écarte une carte sans exercice possible", () => {
    expect(planSession(cards, today, 6, () => [])).toEqual([]);
  });
});

describe("countDue / nextDueDay", () => {
  it("compte les cartes dues, nouvelles comprises", () => {
    expect(countDue(cards, today)).toBe(4);
  });

  it("trouve le prochain jour de révision", () => {
    expect(nextDueDay(cards, today)).toBe("2026-11-05");
    expect(nextDueDay([], today)).toBeUndefined();
  });
});
