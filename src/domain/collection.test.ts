import { describe, expect, it } from "vitest";
import { searchCards, sortCards, type Describer } from "./collection";
import { card } from "../test/factories";
import type { Card } from "./card";

const named = (id: string, term: string, definition: string, createdAt: number): Card => {
  const base = card(id, {}, createdAt);
  return { ...base, item: { ...base.item, content: { term, definition } } };
};
const describe_: Describer = {
  title: (c) => (c.item.content as { term: string }).term,
  searchTexts: (c) => Object.values(c.item.content as Record<string, string>),
};

const cards = [
  named("1", "Écot", "Quote-part d’une dépense commune.", 2),
  named("2", "alacrité", "Vivacité et enjouement.", 3),
  named("3", "Dilection", "Amour pur et spirituel.", 1),
];
const titles = (list: Card[]) => list.map(describe_.title);

describe("searchCards", () => {
  it("cherche sans tenir compte des accents ni de la casse", () => {
    expect(titles(searchCards(cards, "ALACRITE", describe_))).toEqual(["alacrité"]);
  });

  it("cherche dans tous les textes de la fiche", () => {
    expect(titles(searchCards(cards, "spirituel", describe_))).toEqual(["Dilection"]);
  });

  it("renvoie tout pour une recherche vide", () => {
    expect(searchCards(cards, "  ", describe_)).toHaveLength(3);
  });
});

describe("sortCards", () => {
  it("trie par date d'ajout", () => {
    expect(titles(sortCards(cards, "recent", describe_))).toEqual(["alacrité", "Écot", "Dilection"]);
    expect(titles(sortCards(cards, "oldest", describe_))).toEqual(["Dilection", "Écot", "alacrité"]);
  });

  it("trie alphabétiquement à la française (accents et casse ignorés)", () => {
    expect(titles(sortCards(cards, "alphabetical", describe_))).toEqual(["alacrité", "Dilection", "Écot"]);
  });
});
