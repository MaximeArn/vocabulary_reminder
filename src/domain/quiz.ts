import { shuffle, type Random } from "./random";
import { comparisonKey } from "./text";
import type { QuizMode, Word } from "./types";

/**
 * Construction d'une question à choix multiples.
 *
 * Les mauvaises réponses sont tirées parmi les autres mots de la collection,
 * avec trois garanties :
 * - la bonne réponse est toujours présente, une seule fois ;
 * - aucune proposition n'apparaît en double ;
 * - un homonyme (même mot, autre sens) n'est jamais proposé comme mauvaise
 *   réponse, puisqu'il serait correct lui aussi.
 */

export const CHOICE_COUNT = 4;

export interface Choice {
  wordId: string;
  label: string;
}

export interface Question {
  wordId: string;
  mode: QuizMode;
  /** Ce qui est demandé : le mot, ou sa définition (mot masqué). */
  prompt: string;
  choices: Choice[];
}

export function buildQuestion(target: Word, words: Word[], mode: QuizMode, random: Random = Math.random): Question | null {
  const distractors = pickDistractors(target, words, mode, random);
  if (distractors.length < CHOICE_COUNT - 1) return null;

  const choices = shuffle([target, ...distractors], random).map((word) => ({
    wordId: word.id,
    label: mode === "word-to-definition" ? maskTerm(word.definition, word.term) : word.term,
  }));

  return {
    wordId: target.id,
    mode,
    prompt: mode === "word-to-definition" ? target.term : maskTerm(target.definition, target.term),
    choices,
  };
}

/** Peut-on poser des questions ? Il faut assez de mots et de définitions distincts. */
export function canBuildQuestions(words: Word[]): boolean {
  const terms = new Set(words.map((word) => word.termKey));
  const definitions = new Set(words.map((word) => comparisonKey(word.definition)));
  return terms.size >= CHOICE_COUNT && definitions.size >= CHOICE_COUNT;
}

function pickDistractors(target: Word, words: Word[], mode: QuizMode, random: Random): Word[] {
  // La « clé » d'une proposition : ce qui est affiché, à la casse et aux accents près.
  const keyOf = (word: Word) => (mode === "word-to-definition" ? comparisonKey(word.definition) : word.termKey);

  const usedKeys = new Set([keyOf(target)]);
  const distractors: Word[] = [];
  for (const word of shuffle(words, random)) {
    if (distractors.length === CHOICE_COUNT - 1) break;
    const isHomonym = word.termKey === target.termKey; // inclut le mot lui-même
    if (isHomonym || usedKeys.has(keyOf(word))) continue;
    usedKeys.add(keyOf(word));
    distractors.push(word);
  }
  return distractors;
}

/**
 * Masque le mot dans un texte (sa définition ou son exemple), pour ne pas
 * donner la réponse : « Être sous la férule de… » → « Être sous la … de… ».
 */
export function maskTerm(text: string, term: string): string {
  const escaped = term.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  if (escaped === "") return text;
  return text.replace(new RegExp(escaped, "gi"), "…");
}
