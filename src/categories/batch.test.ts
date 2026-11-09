import { describe, expect, it } from "vitest";
import { previewBatch } from "./batch";
import { createBackup } from "../domain/backup";
import { vocabularyItem } from "../test/factories";
import type { Item } from "../domain/types";
import type { HistoricalEventContent } from "./historical-event/model";

// Extrait de la liste envoyée par l'utilisateur.
const NOTES = `Alexandre le Grand

* 356 av. J.-C. : naissance d’Alexandre le Grand.
* 338 av. J.-C. : bataille de Chéronée.
* 331 av. J.-C. : bataille de Gaugamèles.

Rome

* 476 : chute de l’Empire romain d’Occident.
- 1337-1453 : guerre de Cent Ans
alacrité : vivacité et enjouement « Il répondit avec alacrité. »
Dextre: droite`;

describe("previewBatch (texte)", () => {
  const preview = previewBatch(NOTES, []);

  it("reconnaît les dates, les périodes et les mots, puces retirées", () => {
    expect(preview.entries.map((entry) => entry.label)).toEqual([
      "356 av. J.-C. — Naissance d’Alexandre le Grand",
      "338 av. J.-C. — Bataille de Chéronée",
      "331 av. J.-C. — Bataille de Gaugamèles",
      "476 apr. J.-C. — Chute de l’Empire romain d’Occident",
      "1337 – 1453 — Guerre de Cent Ans",
      "alacrité — vivacité et enjouement",
      "Dextre — droite",
    ]);
    const gaugameles = preview.entries[2]!.content as HistoricalEventContent;
    expect(gaugameles.start).toEqual({ year: -331, precision: "year", circa: false });
  });

  it("range l'exemple final entre « » dans le champ exemple", () => {
    expect(preview.entries[5]!.content).toEqual({ term: "alacrité", definition: "vivacité et enjouement", example: "Il répondit avec alacrité." });
  });

  it("signale les titres de section sans « : »", () => {
    expect(preview.ignored.map((line) => line.line)).toEqual(["Alexandre le Grand", "Rome"]);
  });

  it("écarte les fiches déjà présentes et les répétitions du lot", () => {
    const existing = [vocabularyItem("Alacrite", "déjà là")];
    const again = previewBatch(`${NOTES}\n338 av. J.-C. : Bataille de Chéronée.`, existing);
    expect(again.duplicates).toEqual(["alacrité", "Bataille de Chéronée"]);
    expect(again.entries).toHaveLength(6);
  });
});

describe("previewBatch (sauvegarde JSON collée)", () => {
  it("ajoute les fiches absentes avec leur historique, sans rien remplacer", () => {
    const present = vocabularyItem("dextre", "droite");
    const fresh = vocabularyItem("senestre", "gauche");
    const review = { id: "r", itemId: fresh.id, answeredAt: 1, studyDay: "2026-11-09", exercise: "vocabulary.word-to-definition", correct: true };
    const json = JSON.stringify(createBackup({ items: [present, fresh] as Item[], reviews: [review], settings: [] }, new Date()));
    const preview = previewBatch(json, [present]);
    expect(preview.source).toBe("backup");
    expect(preview.entries.map((entry) => entry.fromBackup?.item.id)).toEqual([fresh.id]);
    expect(preview.entries[0]!.fromBackup?.reviews).toEqual([review]);
  });

  it("signale une sauvegarde illisible", () => {
    expect(previewBatch("{ pas du json", []).ignored[0]!.reason).toMatch(/JSON/);
  });
});
