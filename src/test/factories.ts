import type { Card } from "../domain/card";
import { initialProgress, type Progress } from "../domain/srs";
import type { Item } from "../domain/types";
import type { VocabularyContent } from "../categories/vocabulary/model";

/** Fabriques de données pour les tests. */

let nextId = 0;

export function vocabularyItem(term: string, definition: string, createdAt = 0, example?: string): Item<VocabularyContent> {
  const content: VocabularyContent = { term, definition };
  if (example) content.example = example;
  return { id: `id-${nextId++}-${term}`, kind: "vocabulary", content, createdAt, updatedAt: createdAt };
}

export function card(id: string, progress: Partial<Progress>, createdAt = 0): Card {
  return {
    item: { id, kind: "vocabulary", content: { term: id, definition: `déf ${id}` }, createdAt, updatedAt: createdAt },
    progress: { ...initialProgress(createdAt), ...progress },
  };
}
