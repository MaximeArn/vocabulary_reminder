import { buildChoiceQuestion, hasEnoughDistinct } from "../../domain/quiz";
import { cleanOptionalText, cleanText, comparisonKey, stripSurroundingQuotes } from "../../domain/text";
import type { Item } from "../../domain/types";
import { expectRecord, expectText, optionalText, type CategoryModel, type Exercise } from "../model";

/** Catégorie « Vocabulaire » : un mot, sa définition, un exemple facultatif. */

export interface VocabularyContent {
  term: string;
  definition: string;
  example?: string;
}

export interface VocabularyDraft {
  term: string;
  definition: string;
  example: string;
}

type VocabularyItem = Item<VocabularyContent>;

/** Deux fiches portent-elles le même mot (doublon, ou autre sens du même mot) ? */
export function sameTerm(a: VocabularyContent, b: VocabularyContent): boolean {
  return comparisonKey(a.term) === comparisonKey(b.term);
}

/** Autre fiche portant déjà ce mot, pour la signaler à la saisie. */
export function findSameTerm(items: VocabularyItem[], term: string, excludedId?: string): VocabularyItem | undefined {
  if (comparisonKey(term) === "") return undefined;
  return items.find((item) => item.id !== excludedId && sameTerm(item.content, { term, definition: "" }));
}

/**
 * Masque le mot dans un texte (sa définition), pour ne pas donner la réponse :
 * « Être sous la férule de… » → « Être sous la … de… ».
 */
export function maskTerm(text: string, term: string): string {
  const escaped = term.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  if (escaped === "") return text;
  return text.replace(new RegExp(escaped, "gi"), "…");
}

const maskedDefinition = (item: VocabularyItem) => maskTerm(item.content.definition, item.content.term);

const wordToDefinition: Exercise<VocabularyContent> = {
  id: "vocabulary.word-to-definition",
  label: "La définition",
  instruction: "Quelle est la définition ?",
  promptStyle: "headline",
  choiceStyle: "long",
  build: (target, pool, random) =>
    buildChoiceQuestion({
      target,
      pool,
      exercise: "vocabulary.word-to-definition",
      prompt: target.content.term,
      label: maskedDefinition,
      // Un homonyme (même mot, autre sens) serait correct lui aussi.
      isEquivalent: (candidate) => sameTerm(candidate.content, target.content),
      random,
    }),
};

const definitionToWord: Exercise<VocabularyContent> = {
  id: "vocabulary.definition-to-word",
  label: "Le mot",
  instruction: "Quel est ce mot ?",
  promptStyle: "text",
  choiceStyle: "short",
  build: (target, pool, random) =>
    buildChoiceQuestion({
      target,
      pool,
      exercise: "vocabulary.definition-to-word",
      prompt: maskedDefinition(target),
      label: (item) => item.content.term,
      isEquivalent: (candidate) => sameTerm(candidate.content, target.content),
      random,
    }),
};

export const vocabularyModel: CategoryModel<VocabularyContent, VocabularyDraft> = {
  kind: "vocabulary",
  label: "Vocabulaire",
  unit: { singular: "mot", plural: "mots" },
  addLabel: "Un mot",
  newItemTitle: "Nouveau mot",
  addedMessage: (title) => `« ${title} » ajouté à ta collection`,

  validateContent(raw) {
    const record = expectRecord(raw);
    return {
      term: expectText(record, "term"),
      definition: expectText(record, "definition"),
      example: optionalText(record, "example"),
    };
  },

  title: (content) => content.term,
  subtitle: (content) => content.definition,
  searchTexts: (content) => [content.term, content.definition],

  exercises: [wordToDefinition, definitionToWord],
  canBuildQuestions: (items) =>
    hasEnoughDistinct(items.map((item) => item.content.term)) &&
    hasEnoughDistinct(items.map((item) => item.content.definition)),

  emptyDraft: () => ({ term: "", definition: "", example: "" }),
  draftFrom: (content) => ({ term: content.term, definition: content.definition, example: content.example ?? "" }),
  validateDraft: (draft) => ({
    term: cleanText(draft.term) === "" ? "Indique le mot." : undefined,
    definition: cleanText(draft.definition) === "" ? "Indique sa définition." : undefined,
  }),
  contentFrom: (draft) => ({
    term: cleanText(draft.term),
    definition: cleanText(draft.definition),
    example: stripSurroundingQuotes(cleanOptionalText(draft.example)),
  }),
};
