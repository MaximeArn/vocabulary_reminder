import { describe, expect, it } from "vitest";
import { countDue, nextDueDay, planPractice, planSession, practiceCandidates } from "./session";
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

describe("entraînements", () => {
  const now = new Date(2026, 10, 9, 12).getTime();
  const day = 24 * 60 * 60 * 1000;
  const pool = [
    card("souvent-oublie", { lapses: 3, lastReviewedAt: 5 }, now - 30 * day),
    card("oublie-une-fois", { lapses: 1 }, now - 20 * day),
    card("jamais-oublie", { lapses: 0 }, now - 10 * day),
    card("ajoute-hier", { lapses: 0 }, now - day),
    card("ajoute-il-y-a-6-jours", { lapses: 1 }, now - 6 * day),
  ];
  const ids = (cards: { item: { id: string } }[]) => cards.map((c) => c.item.id);

  it("« Les plus oubliées » : les fiches ratées, les plus souvent ratées d'abord", () => {
    expect(ids(practiceCandidates(pool, "forgotten", now))).toEqual(["souvent-oublie", "oublie-une-fois", "ajoute-il-y-a-6-jours"]);
  });

  it("« Nouveautés » : les fiches ajoutées ces 7 derniers jours, les plus récentes d'abord", () => {
    expect(ids(practiceCandidates(pool, "recent", now))).toEqual(["ajoute-hier", "ajoute-il-y-a-6-jours"]);
  });

  it("« Tout en vrac » : un tirage au hasard dans toute la collection, sans doublon", () => {
    const plan = planPractice(pool, "random", 3, now, () => ["e"], seededRandom(2));
    expect(plan).toHaveLength(3);
    expect(new Set(plan.map((item) => item.itemId)).size).toBe(3);
  });

  it("respecte la taille de session et les exercices possibles", () => {
    const plan = planPractice(pool, "forgotten", 2, now, () => ["a", "b"], seededRandom(1));
    expect(plan.map((item) => item.itemId).sort()).toEqual(["oublie-une-fois", "souvent-oublie"]);
    expect(plan[0]!.exercise).not.toBe(plan[1]!.exercise);
  });
});
