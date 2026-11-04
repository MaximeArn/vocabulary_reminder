import { describe, expect, it } from "vitest";
import { findSameTerm, searchWords, sortWords } from "./collection";
import { createWord } from "./word";

const make = (term: string, definition: string, createdAt: number) =>
  createWord({ term, definition, example: "" }, term, createdAt);

const words = [
  make("Écot", "Quote-part d’une dépense commune.", 2),
  make("alacrité", "Vivacité et enjouement.", 3),
  make("Dilection", "Amour pur et spirituel.", 1),
];

describe("searchWords", () => {
  it("cherche sans tenir compte des accents ni de la casse", () => {
    expect(searchWords(words, "ALACRITE").map((w) => w.term)).toEqual(["alacrité"]);
  });

  it("cherche aussi dans la définition", () => {
    expect(searchWords(words, "spirituel").map((w) => w.term)).toEqual(["Dilection"]);
  });

  it("renvoie tout pour une recherche vide", () => {
    expect(searchWords(words, "  ")).toHaveLength(3);
  });
});

describe("sortWords", () => {
  it("trie par date d'ajout", () => {
    expect(sortWords(words, "recent").map((w) => w.term)).toEqual(["alacrité", "Écot", "Dilection"]);
    expect(sortWords(words, "oldest").map((w) => w.term)).toEqual(["Dilection", "Écot", "alacrité"]);
  });

  it("trie alphabétiquement à la française (accents et casse ignorés)", () => {
    expect(sortWords(words, "alphabetical").map((w) => w.term)).toEqual(["alacrité", "Dilection", "Écot"]);
  });
});

describe("findSameTerm", () => {
  it("détecte un terme déjà présent, en ignorant le mot en cours de modification", () => {
    expect(findSameTerm(words, "ecot")?.term).toBe("Écot");
    expect(findSameTerm(words, "Écot", "Écot")).toBeUndefined();
    expect(findSameTerm(words, "inconnu")).toBeUndefined();
  });
});
