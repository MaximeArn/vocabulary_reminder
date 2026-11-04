import { describe, expect, it } from "vitest";
import { buildQuestion, canBuildQuestions, maskTerm } from "./quiz";
import { seededRandom } from "./random";
import { createWord } from "./word";
import type { Word } from "./types";

let nextId = 0;
const make = (term: string, definition: string): Word =>
  createWord({ term, definition, example: "" }, `id-${nextId++}`, 0);

const collection = [
  make("dextre", "Droite."),
  make("senestre", "Gauche."),
  make("alacrité", "Vivacité et enjouement."),
  make("férule", "Être sous la férule de quelqu’un : être dans l’obligation de lui obéir."),
  make("fruste", "Qui manque de finesse."),
];

describe("buildQuestion", () => {
  it("propose 4 choix distincts dont la bonne réponse, sur de nombreux tirages", () => {
    for (let seed = 1; seed <= 200; seed++) {
      for (const mode of ["word-to-definition", "definition-to-word"] as const) {
        const target = collection[seed % collection.length]!;
        const question = buildQuestion(target, collection, mode, seededRandom(seed));
        expect(question).not.toBeNull();
        const ids = question!.choices.map((choice) => choice.wordId);
        expect(ids).toHaveLength(4);
        expect(new Set(ids).size).toBe(4);
        expect(new Set(question!.choices.map((choice) => choice.label)).size).toBe(4);
        expect(ids.filter((id) => id === target.id)).toHaveLength(1);
      }
    }
  });

  it("affiche le mot ou la définition selon le mode", () => {
    const target = collection[2]!;
    expect(buildQuestion(target, collection, "word-to-definition", seededRandom(1))!.prompt).toBe("alacrité");
    expect(buildQuestion(target, collection, "definition-to-word", seededRandom(1))!.prompt).toBe(
      "Vivacité et enjouement.",
    );
  });

  it("masque le mot dans sa propre définition", () => {
    const ferule = collection[3]!;
    const question = buildQuestion(ferule, collection, "definition-to-word", seededRandom(3))!;
    expect(question.prompt).not.toMatch(/férule/i);
    const asChoice = buildQuestion(ferule, collection, "word-to-definition", seededRandom(3))!;
    const correct = asChoice.choices.find((choice) => choice.wordId === ferule.id)!;
    expect(correct.label).not.toMatch(/férule/i);
  });

  it("ne propose jamais un homonyme comme mauvaise réponse", () => {
    const avocat1 = make("avocat", "Fruit de l’avocatier.");
    const avocat2 = make("Avocat", "Personne qui défend en justice.");
    const words = [...collection, avocat1, avocat2];
    for (let seed = 1; seed <= 100; seed++) {
      const question = buildQuestion(avocat1, words, "word-to-definition", seededRandom(seed))!;
      expect(question.choices.map((choice) => choice.wordId)).not.toContain(avocat2.id);
    }
  });

  it("évite deux définitions identiques parmi les choix", () => {
    const words = [...collection, make("dexter", "Droite.")];
    for (let seed = 1; seed <= 100; seed++) {
      const question = buildQuestion(words[1]!, words, "word-to-definition", seededRandom(seed))!;
      expect(new Set(question.choices.map((choice) => choice.label)).size).toBe(4);
    }
  });

  it("renvoie null s'il n'y a pas assez de mots", () => {
    expect(buildQuestion(collection[0]!, collection.slice(0, 3), "word-to-definition")).toBeNull();
  });
});

describe("canBuildQuestions", () => {
  it("exige au moins 4 mots et 4 définitions distincts", () => {
    expect(canBuildQuestions(collection.slice(0, 3))).toBe(false);
    expect(canBuildQuestions(collection.slice(0, 4))).toBe(true);
  });
});

describe("maskTerm", () => {
  it("masque toutes les occurrences, sans tenir compte de la casse", () => {
    expect(maskTerm("Férule : sous la férule.", "férule")).toBe("… : sous la ….");
  });

  it("supporte les caractères spéciaux d'expression régulière", () => {
    expect(maskTerm("a (b) c", "(b)")).toBe("a … c");
  });
});
