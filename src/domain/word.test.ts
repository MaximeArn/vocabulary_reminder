import { describe, expect, it } from "vitest";
import { createWord, editWord, validateDraft, type WordDraft } from "./word";

const draft: WordDraft = {
  term: " Alacrité ",
  definition: "Vivacité et enjouement.",
  example: "",
};
const now = new Date(2026, 10, 4, 15, 0).getTime();

describe("validateDraft", () => {
  it("exige le mot et la définition", () => {
    expect(validateDraft({ term: " ", definition: "", example: "" })).toEqual({
      term: "Indique le mot.",
      definition: "Indique sa définition.",
    });
    expect(validateDraft(draft)).toEqual({});
  });
});

describe("createWord", () => {
  it("nettoie la saisie et initialise la progression", () => {
    const word = createWord(draft, "id-1", now);
    expect(word).toMatchObject({
      id: "id-1",
      term: "Alacrité",
      termKey: "alacrite",
      box: 0,
      lapses: 0,
      dueDay: "2026-11-04",
      createdAt: now,
      updatedAt: now,
    });
    expect(word.example).toBeUndefined();
  });
});

describe("editWord", () => {
  it("modifie le contenu sans toucher à la progression", () => {
    const word = { ...createWord(draft, "id-1", now), box: 3, dueDay: "2026-12-01", lapses: 2 };
    const later = now + 1000;
    const edited = editWord(word, { ...draft, example: "Avec alacrité." }, later);
    expect(edited).toMatchObject({ box: 3, dueDay: "2026-12-01", lapses: 2, createdAt: now, updatedAt: later });
    expect(edited.example).toBe("Avec alacrité.");
  });
});
