import { studyDayOf } from "./studyDay";
import { cleanOptionalText, cleanText, comparisonKey, stripSurroundingQuotes } from "./text";
import type { Word } from "./types";

/** Contenu d'un mot tel que saisi dans le formulaire. */
export interface WordDraft {
  term: string;
  definition: string;
  example: string;
  source: string;
}

export const EMPTY_DRAFT: WordDraft = { term: "", definition: "", example: "", source: "" };

export function draftFromWord(word: Word): WordDraft {
  return {
    term: word.term,
    definition: word.definition,
    example: word.example ?? "",
    source: word.source ?? "",
  };
}

export interface DraftErrors {
  term?: string;
  definition?: string;
}

/** Renvoie les erreurs de saisie ; un objet vide signifie que le brouillon est valide. */
export function validateDraft(draft: WordDraft): DraftErrors {
  const errors: DraftErrors = {};
  if (cleanText(draft.term) === "") errors.term = "Indique le mot.";
  if (cleanText(draft.definition) === "") errors.definition = "Indique sa définition.";
  return errors;
}

export function hasErrors(errors: DraftErrors): boolean {
  return Object.keys(errors).length > 0;
}

/** Champs de contenu d'un mot, nettoyés à partir du brouillon. */
function contentFromDraft(draft: WordDraft) {
  const term = cleanText(draft.term);
  return {
    term,
    termKey: comparisonKey(term),
    definition: cleanText(draft.definition),
    example: stripSurroundingQuotes(cleanOptionalText(draft.example)),
    source: cleanOptionalText(draft.source),
  };
}

/** Crée un nouveau mot : il entre en boîte 0 et sera proposé dès aujourd'hui. */
export function createWord(draft: WordDraft, id: string, now: number): Word {
  return {
    id,
    ...contentFromDraft(draft),
    createdAt: now,
    updatedAt: now,
    box: 0,
    dueDay: studyDayOf(new Date(now)),
    lapses: 0,
  };
}

/** Applique une modification : le contenu change, la progression est conservée. */
export function editWord(word: Word, draft: WordDraft, now: number): Word {
  return { ...word, ...contentFromDraft(draft), updatedAt: now };
}
