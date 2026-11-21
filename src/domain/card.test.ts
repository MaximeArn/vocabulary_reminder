import { describe, expect, it } from "vitest";
import { buildCards, keyOfCard, oneCardPerItem, type Tracks } from "./card";
import type { Item, Review } from "./types";

const item = (id: string, kind: string, content: object = {}): Item => ({ id, kind, content, createdAt: 0, updatedAt: 0 });
let counter = 0;
const review = (itemId: string, exercise: string, studyDay: string, correct = true): Review => ({
  id: `r${++counter}`,
  itemId,
  answeredAt: new Date(`${studyDay}T12:00:00`).getTime(),
  studyDay,
  exercise,
  correct,
});

// Un lieu « river » n'a que le volet de la carte.
const placeTracks: Tracks = {
  of: (place) => ((place.content as { river?: boolean }).river ? ["map"] : ["map", "number"]),
  forExercise: (exercise) => ({ "place.on-map": "map", "place.number": "number" })[exercise],
};
const tracksOf = (kind: string) => (kind === "place" ? placeTracks : undefined);

describe("cartes à volets", () => {
  it("une carte par volet, chacune avec les réponses de ses exercices", () => {
    const reviews = [
      review("p", "place.on-map", "2026-11-01"),
      review("p", "place.on-map", "2026-11-02"),
      review("p", "place.number", "2026-11-02", false),
    ];
    const cards = buildCards([item("p", "place")], reviews, tracksOf);
    expect(cards.map(keyOfCard)).toEqual(["p#map", "p#number"]);
    expect(cards.find((card) => card.track === "map")!.progress.box).toBe(2);
    expect(cards.find((card) => card.track === "number")!.progress).toMatchObject({ box: 1, lapses: 1 });
  });

  it("seulement les volets qui concernent la fiche", () => {
    const cards = buildCards([item("r", "place", { river: true })], [review("r", "place.on-map", "2026-11-01")], tracksOf);
    expect(cards.map(keyOfCard)).toEqual(["r#map"]);
    expect(cards[0]!.progress.box).toBe(1);
  });

  it("ignore une réponse dont l'exercice n'appartient à aucun volet", () => {
    const cards = buildCards([item("p", "place")], [review("p", "place.unknown", "2026-11-01")], tracksOf);
    expect(cards.every((card) => card.progress.box === 0)).toBe(true);
  });

  it("une seule carte, sans volet, pour les autres catégories", () => {
    const cards = buildCards([item("w", "word")], [review("w", "word.any", "2026-11-01")], tracksOf);
    expect(cards).toHaveLength(1);
    expect(cards[0]!.track).toBeUndefined();
    expect(cards[0]!.progress.box).toBe(1);
  });

  it("dans la collection, une ligne par fiche : le volet le moins avancé", () => {
    const cards = buildCards([item("p", "place"), item("w", "word")], [review("p", "place.number", "2026-11-01")], tracksOf);
    const listed = oneCardPerItem(cards);
    expect(listed.map((card) => card.item.id)).toEqual(["p", "w"]);
    expect(listed[0]!.track).toBe("map");
  });
});
