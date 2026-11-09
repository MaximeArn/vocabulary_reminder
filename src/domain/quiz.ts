import { shuffle, type Random } from "./random";
import { comparisonKey } from "./text";
import type { Item } from "./types";

/**
 * Questions à choix multiples, communes à toutes les catégories.
 *
 * Garanties :
 * - la bonne réponse est toujours présente, une seule fois ;
 * - aucune proposition n'apparaît en double (à la casse et aux accents près) ;
 * - une proposition « équivalente » à la bonne réponse (homonyme, même date…)
 *   n'est jamais proposée comme mauvaise réponse.
 */

export const CHOICE_COUNT = 4;

export interface Choice {
  /** Identifiant de la proposition : celui d'une fiche, ou d'une réponse fabriquée. */
  id: string;
  label: string;
}

export interface Question {
  itemId: string;
  exercise: string;
  /** Ce qui est demandé : un mot, une définition, un événement… */
  prompt: string;
  /** Consigne propre à cette question (sinon, celle de l'exercice). */
  instruction?: string;
  choices: Choice[];
  correctChoiceId: string;
}

interface ChoiceQuestionOptions<Content> {
  target: Item<Content>;
  /** Fiches parmi lesquelles tirer les mauvaises réponses. */
  pool: Item<Content>[];
  exercise: string;
  prompt: string;
  /** Texte affiché pour une fiche proposée. */
  label: (item: Item<Content>) => string;
  /** Une fiche qui serait correcte elle aussi (homonyme…) : jamais proposée. */
  isEquivalent?: (candidate: Item<Content>) => boolean;
  random?: Random;
}

/** Question dont les propositions sont des fiches de la collection. */
export function buildChoiceQuestion<Content>({
  target,
  pool,
  exercise,
  prompt,
  label,
  isEquivalent = () => false,
  random = Math.random,
}: ChoiceQuestionOptions<Content>): Question | null {
  const usedKeys = new Set([comparisonKey(label(target))]);
  const distractors: Item<Content>[] = [];
  for (const candidate of shuffle(pool, random)) {
    if (distractors.length === CHOICE_COUNT - 1) break;
    if (candidate.id === target.id || isEquivalent(candidate)) continue;
    const key = comparisonKey(label(candidate));
    if (usedKeys.has(key)) continue;
    usedKeys.add(key);
    distractors.push(candidate);
  }
  if (distractors.length < CHOICE_COUNT - 1) return null;

  return {
    itemId: target.id,
    exercise,
    prompt,
    choices: shuffle([target, ...distractors], random).map((item) => ({ id: item.id, label: label(item) })),
    correctChoiceId: target.id,
  };
}

/** Nombre de libellés distincts : suffit-il pour composer des questions ? */
export function hasEnoughDistinct(labels: string[]): boolean {
  return new Set(labels.map(comparisonKey)).size >= CHOICE_COUNT;
}
