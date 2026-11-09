import { describe, expect, it } from "vitest";
import { backupFileName, createBackup, parseBackup, type ContentValidator } from "./backup";
import { vocabularyModel } from "../categories/vocabulary/model";
import { vocabularyItem } from "../test/factories";
import type { Review } from "./types";

const validate: ContentValidator = (kind, raw) => (kind === "vocabulary" ? vocabularyModel.validateContent(raw) : undefined);

const item = vocabularyItem("Alacrité", "Vivacité.", 1000);
const review: Review = {
  id: "r1",
  itemId: item.id,
  answeredAt: 2000,
  studyDay: "2026-11-04",
  exercise: "vocabulary.word-to-definition",
  correct: true,
};
const serialized = (content: object) => JSON.stringify(content);

describe("sauvegarde v2", () => {
  it("relit à l'identique une sauvegarde qu'elle a produite", () => {
    const backup = createBackup({ items: [item], reviews: [review], settings: [] }, new Date(2026, 10, 4));
    expect(parseBackup(serialized(backup), validate)).toEqual({ ok: true, backup: JSON.parse(serialized(backup)) });
  });

  it("refuse un texte qui n'est pas du JSON", () => {
    expect(parseBackup("pas du json", validate)).toEqual({ ok: false, error: "Ce fichier n’est pas un fichier JSON valide." });
  });

  it("refuse un JSON qui ne vient pas de Mnémé, ou d'une version future", () => {
    expect(parseBackup(serialized({ items: [] }), validate).ok).toBe(false);
    expect(parseBackup(serialized({ app: "lexique", schemaVersion: 99, items: [] }), validate).ok).toBe(false);
  });

  it("valide le contenu de chaque fiche selon sa catégorie", () => {
    const broken = { ...item, content: { term: "x" } };
    const result = parseBackup(serialized({ app: "lexique", schemaVersion: 2, items: [broken] }), validate);
    expect(result).toEqual({ ok: false, error: "Le champ « definition » est absent ou invalide." });
  });

  it("conserve telle quelle une fiche d'une catégorie inconnue (version plus récente)", () => {
    const future = { id: "f", kind: "quote", content: { text: "…" }, createdAt: 1, updatedAt: 1 };
    const result = parseBackup(serialized({ app: "lexique", schemaVersion: 2, items: [future] }), validate);
    expect(result.ok && result.backup.items[0]).toEqual(future);
  });

  it("refuse deux fiches avec le même identifiant et ignore les réponses orphelines", () => {
    expect(parseBackup(serialized({ app: "lexique", schemaVersion: 2, items: [item, item] }), validate).ok).toBe(false);
    const orphan = { ...review, id: "r2", itemId: "inconnu" };
    const result = parseBackup(serialized({ app: "lexique", schemaVersion: 2, items: [item], reviews: [review, orphan] }), validate);
    expect(result.ok && result.backup.reviews.map((r) => r.id)).toEqual(["r1"]);
  });
});

describe("sauvegarde v1 (vocabulaire seul)", () => {
  const v1 = {
    app: "lexique",
    schemaVersion: 1,
    exportedAt: "2026-11-04T10:00:00.000Z",
    words: [
      { id: "w1", term: "alacrité", termKey: "alacrite", definition: "Vivacité.", example: "Avec alacrité.", createdAt: 1, updatedAt: 2, box: 3, dueDay: "2026-11-10", lapses: 0 },
    ],
    reviews: [
      { id: "r1", wordId: "w1", answeredAt: new Date(2026, 10, 5, 1).getTime(), mode: "definition-to-word", correct: true, boxBefore: 0, boxAfter: 1 },
    ],
    settings: [{ key: "review.mode", value: "word-to-definition" }],
  };

  it("convertit les mots en fiches, les réponses et les réglages", () => {
    const result = parseBackup(serialized(v1), validate);
    if (!result.ok) throw new Error(result.error);
    expect(result.backup.schemaVersion).toBe(2);
    expect(result.backup.items).toEqual([
      { id: "w1", kind: "vocabulary", content: { term: "alacrité", definition: "Vivacité.", example: "Avec alacrité." }, createdAt: 1, updatedAt: 2 },
    ]);
    expect(result.backup.reviews).toEqual([
      {
        id: "r1",
        itemId: "w1",
        answeredAt: v1.reviews[0]!.answeredAt,
        studyDay: "2026-11-04", // 1 h du matin : compte pour la veille
        exercise: "vocabulary.definition-to-word",
        correct: true,
      },
    ]);
    expect(result.backup.settings).toEqual([{ key: "review.mode", value: "vocabulary.word-to-definition" }]);
  });

  it("indique précisément le mot invalide", () => {
    const broken = { ...v1, words: [v1.words[0], { ...v1.words[0], id: "w2", definition: undefined }] };
    expect(parseBackup(serialized(broken), validate)).toEqual({
      ok: false,
      error: "Le champ « definition » du mot n° 2 est absent ou invalide.",
    });
  });
});

describe("backupFileName", () => {
  it("contient la date du jour", () => {
    expect(backupFileName(new Date(2026, 0, 9))).toBe("mneme-2026-01-09.backup.json");
  });
});
