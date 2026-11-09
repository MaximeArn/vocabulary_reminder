import { studyDayOf } from "./studyDay";
import type { Item, Review, Setting } from "./types";

/**
 * Conversion des données de la première version (vocabulaire seul) vers le
 * modèle générique. Utilisée par la migration de la base locale (Dexie v3) et
 * par l'import des anciennes sauvegardes (format v1).
 */

/** Mot de la version 1 (seuls les champs utiles à la conversion). */
export interface LegacyWord {
  id: string;
  term: string;
  definition: string;
  example?: string;
  createdAt: number;
  updatedAt: number;
  /** Ancien état de progression : désormais recalculé à partir de l'historique. */
  box?: number;
  dueDay?: string;
  lapses?: number;
}

export interface LegacyReview {
  id: string;
  wordId: string;
  answeredAt: number;
  mode: "word-to-definition" | "definition-to-word";
  correct: boolean;
}

export function itemFromLegacyWord(word: LegacyWord): Item {
  const content: { term: string; definition: string; example?: string } = {
    term: word.term,
    definition: word.definition,
  };
  if (word.example) content.example = word.example;
  return { id: word.id, kind: "vocabulary", content, createdAt: word.createdAt, updatedAt: word.updatedAt };
}

export function reviewFromLegacy(review: LegacyReview): Review {
  return {
    id: review.id,
    itemId: review.wordId,
    answeredAt: review.answeredAt,
    studyDay: studyDayOf(new Date(review.answeredAt)),
    exercise: `vocabulary.${review.mode}`,
    correct: review.correct,
  };
}

/** Le réglage « sens des questions » désigne désormais un exercice préfixé par sa catégorie. */
export function settingFromLegacy(setting: Setting): Setting {
  if (setting.key === "review.mode" && (setting.value === "word-to-definition" || setting.value === "definition-to-word")) {
    return { key: setting.key, value: `vocabulary.${setting.value}` };
  }
  return setting;
}
