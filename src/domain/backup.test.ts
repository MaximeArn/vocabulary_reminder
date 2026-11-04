import { describe, expect, it } from "vitest";
import { backupFileName, createBackup, parseBackup } from "./backup";
import { createWord } from "./word";

const word = createWord({ term: "Alacrité", definition: "Vivacité.", example: "" }, "w1", 1000);
const review = {
  id: "r1",
  wordId: "w1",
  answeredAt: 2000,
  mode: "word-to-definition" as const,
  correct: true,
  boxBefore: 0,
  boxAfter: 1,
};

function serialized(content: object) {
  return JSON.stringify(content);
}

describe("createBackup / parseBackup", () => {
  it("relit à l'identique une sauvegarde qu'il a produite", () => {
    const backup = createBackup({ words: [word], reviews: [review], settings: [] }, new Date(2026, 10, 4));
    const result = parseBackup(serialized(backup));
    expect(result).toEqual({ ok: true, backup: JSON.parse(serialized(backup)) });
  });

  it("refuse un texte qui n'est pas du JSON", () => {
    expect(parseBackup("pas du json")).toEqual({ ok: false, error: "Ce fichier n’est pas un fichier JSON valide." });
  });

  it("refuse un JSON qui ne vient pas de Lexique", () => {
    expect(parseBackup(serialized({ words: [] })).ok).toBe(false);
  });

  it("refuse une sauvegarde d'une version future", () => {
    const result = parseBackup(serialized({ app: "lexique", schemaVersion: 99, words: [] }));
    expect(result.ok).toBe(false);
  });

  it("indique précisément le mot invalide", () => {
    const broken = { ...word, definition: undefined };
    const result = parseBackup(serialized({ app: "lexique", schemaVersion: 1, words: [word, broken] }));
    expect(result).toEqual({
      ok: false,
      error: "Le champ « definition » du mot n° 2 est absent ou invalide.",
    });
  });

  it("refuse deux mots avec le même identifiant", () => {
    const result = parseBackup(serialized({ app: "lexique", schemaVersion: 1, words: [word, word] }));
    expect(result.ok).toBe(false);
  });

  it("recalcule la clé de comparaison et ignore les révisions orphelines", () => {
    const orphan = { ...review, id: "r2", wordId: "inconnu" };
    const result = parseBackup(
      serialized({ app: "lexique", schemaVersion: 1, words: [{ ...word, termKey: "faux" }], reviews: [review, orphan] }),
    );
    if (!result.ok) throw new Error(result.error);
    expect(result.backup.words[0]?.termKey).toBe("alacrite");
    expect(result.backup.reviews.map((r) => r.id)).toEqual(["r1"]);
  });
});

describe("backupFileName", () => {
  it("contient la date du jour", () => {
    expect(backupFileName(new Date(2026, 0, 9))).toBe("lexique-2026-01-09.backup.json");
  });
});
