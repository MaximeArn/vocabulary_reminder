import { describe, expect, it } from "vitest";
import { seededRandom } from "../../domain/random";
import { vocabularyItem } from "../../test/factories";
import { findSameTerm, maskTerm, vocabularyModel } from "./model";

const [wordToDefinition, definitionToWord] = vocabularyModel.exercises;

const collection = [
  vocabularyItem("dextre", "Droite."),
  vocabularyItem("senestre", "Gauche."),
  vocabularyItem("alacrité", "Vivacité et enjouement."),
  vocabularyItem("férule", "Être sous la férule de quelqu’un : être dans l’obligation de lui obéir."),
  vocabularyItem("fruste", "Qui manque de finesse."),
];

describe("exercices de vocabulaire", () => {
  it("proposent 4 choix distincts dont la bonne réponse, sur de nombreux tirages", () => {
    for (let seed = 1; seed <= 200; seed++) {
      for (const exercise of [wordToDefinition!, definitionToWord!]) {
        const target = collection[seed % collection.length]!;
        const question = exercise.build(target, collection, seededRandom(seed))!;
        const ids = question.choices.map((choice) => choice.id);
        expect(ids).toHaveLength(4);
        expect(new Set(ids).size).toBe(4);
        expect(new Set(question.choices.map((choice) => choice.label)).size).toBe(4);
        expect(ids.filter((id) => id === question.correctChoiceId)).toHaveLength(1);
        expect(question.correctChoiceId).toBe(target.id);
      }
    }
  });

  it("affichent le mot ou la définition selon l'exercice", () => {
    const target = collection[2]!;
    expect(wordToDefinition!.build(target, collection, seededRandom(1))!.prompt).toBe("alacrité");
    expect(definitionToWord!.build(target, collection, seededRandom(1))!.prompt).toBe("Vivacité et enjouement.");
  });

  it("masquent le mot dans sa propre définition", () => {
    const ferule = collection[3]!;
    expect(definitionToWord!.build(ferule, collection, seededRandom(3))!.prompt).not.toMatch(/férule/i);
    const question = wordToDefinition!.build(ferule, collection, seededRandom(3))!;
    const correct = question.choices.find((choice) => choice.id === ferule.id)!;
    expect(correct.label).not.toMatch(/férule/i);
  });

  it("ne proposent jamais un homonyme comme mauvaise réponse", () => {
    const avocat1 = vocabularyItem("avocat", "Fruit de l’avocatier.");
    const avocat2 = vocabularyItem("Avocat", "Personne qui défend en justice.");
    const items = [...collection, avocat1, avocat2];
    for (let seed = 1; seed <= 100; seed++) {
      const question = wordToDefinition!.build(avocat1, items, seededRandom(seed))!;
      expect(question.choices.map((choice) => choice.id)).not.toContain(avocat2.id);
    }
  });

  it("évitent deux définitions identiques parmi les choix", () => {
    const items = [...collection, vocabularyItem("dexter", "Droite.")];
    for (let seed = 1; seed <= 100; seed++) {
      const question = wordToDefinition!.build(items[1]!, items, seededRandom(seed))!;
      expect(new Set(question.choices.map((choice) => choice.label)).size).toBe(4);
    }
  });

  it("renvoient null s'il n'y a pas assez de fiches", () => {
    expect(wordToDefinition!.build(collection[0]!, collection.slice(0, 3))).toBeNull();
  });
});

describe("canBuildQuestions", () => {
  it("exige au moins 4 mots et 4 définitions distincts", () => {
    expect(vocabularyModel.canBuildQuestions(collection.slice(0, 3))).toBe(false);
    expect(vocabularyModel.canBuildQuestions(collection.slice(0, 4))).toBe(true);
  });
});

describe("formulaire", () => {
  it("exige le mot et la définition", () => {
    expect(vocabularyModel.validateDraft({ term: " ", definition: "", example: "" })).toEqual({
      term: "Indique le mot.",
      definition: "Indique sa définition.",
    });
    expect(vocabularyModel.validateDraft({ term: "a", definition: "b", example: "" })).toEqual({
      term: undefined,
      definition: undefined,
    });
  });

  it("nettoie la saisie et retire les guillemets de l'exemple", () => {
    expect(vocabularyModel.contentFrom({ term: " Alacrité ", definition: "Vivacité.", example: "« Avec alacrité »" })).toEqual({
      term: "Alacrité",
      definition: "Vivacité.",
      example: "Avec alacrité",
    });
    expect(vocabularyModel.contentFrom({ term: "a", definition: "b", example: "  " }).example).toBeUndefined();
  });
});

describe("validateContent", () => {
  it("accepte un contenu valide et refuse un contenu incomplet", () => {
    expect(vocabularyModel.validateContent({ term: "a", definition: "b" })).toEqual({ term: "a", definition: "b", example: undefined });
    expect(() => vocabularyModel.validateContent({ term: "a" })).toThrow("« definition »");
  });
});

describe("findSameTerm", () => {
  it("détecte un mot déjà présent, sans accents, en ignorant la fiche modifiée", () => {
    const ecot = vocabularyItem("Écot", "Quote-part.");
    expect(findSameTerm([ecot], "ecot")?.id).toBe(ecot.id);
    expect(findSameTerm([ecot], "Écot", ecot.id)).toBeUndefined();
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
