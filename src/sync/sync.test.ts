import { describe, expect, it } from "vitest";
import type { Item, Review } from "../domain/types";
import { itemFromRemote, itemToRemote, reviewFromRemote, reviewToRemote, settingFromRemote, settingToRemote } from "./mapping";
import { itemsToApply, reviewsToApply, settingsToApply } from "./merge";

const item = (id: string, updatedAt: number, extra: Partial<Item> = {}): Item => ({
  id,
  kind: "vocabulary",
  content: { term: id, definition: "d" },
  createdAt: 1,
  updatedAt,
  ...extra,
});

describe("conversion local ⇄ serveur", () => {
  it("fait l'aller-retour sans perte, suppression douce comprise", () => {
    const original = item("a", 5, { deletedAt: 6 });
    expect(itemFromRemote(itemToRemote(original))).toEqual(original);
    const active = item("b", 5);
    expect(itemToRemote(active).deleted_at).toBeNull();
    expect(itemFromRemote(itemToRemote(active))).toEqual(active);
  });

  it("convertit les réponses et les réglages", () => {
    const review: Review = { id: "r", itemId: "a", answeredAt: 9, studyDay: "2026-11-09", exercise: "vocabulary.word-to-definition", correct: false };
    expect(reviewFromRemote(reviewToRemote(review))).toEqual(review);
    expect(settingFromRemote(settingToRemote({ key: "review.sessionSize", value: 10, updatedAt: 3 }))).toEqual({
      key: "review.sessionSize",
      value: 10,
      updatedAt: 3,
    });
  });

  it("accepte des nombres renvoyés sous forme de texte par PostgreSQL (bigint)", () => {
    const row = { ...itemToRemote(item("a", 5)), created_at: "1" as unknown as number, updated_at: "5" as unknown as number };
    expect(itemFromRemote(row)).toEqual(item("a", 5));
  });
});

describe("fusion à la réception", () => {
  it("n'applique une fiche distante que si elle est nouvelle ou plus récente", () => {
    const local = new Map([
      ["a", item("a", 10)],
      ["b", item("b", 10)],
    ]);
    const remote = [item("a", 5), item("b", 20), item("c", 1)];
    expect(itemsToApply(remote, local).map((i) => i.id)).toEqual(["b", "c"]);
  });

  it("propage une suppression plus récente", () => {
    const local = new Map([["a", item("a", 10)]]);
    expect(itemsToApply([item("a", 11, { deletedAt: 11 })], local)[0]?.deletedAt).toBe(11);
  });

  it("additionne les historiques sans doublon", () => {
    const review = (id: string): Review => ({ id, itemId: "a", answeredAt: 1, studyDay: "2026-11-09", exercise: "e", correct: true });
    expect(reviewsToApply([review("1"), review("2")], new Set(["1"])).map((r) => r.id)).toEqual(["2"]);
  });

  it("garde le réglage le plus récent", () => {
    const local = new Map([["k", { key: "k", value: 1, updatedAt: 10 }]]);
    expect(settingsToApply([{ key: "k", value: 2, updatedAt: 5 }], local)).toEqual([]);
    expect(settingsToApply([{ key: "k", value: 3, updatedAt: 15 }], local)).toHaveLength(1);
    expect(settingsToApply([{ key: "n", value: 4, updatedAt: 1 }], local)).toHaveLength(1);
  });
});
