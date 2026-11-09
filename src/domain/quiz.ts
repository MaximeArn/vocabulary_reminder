import { shuffle, type Random } from "./random";
import { comparisonKey } from "./text";
import type { Item } from "./types";

/**
 * Questions, communes à toutes les catégories : à choix multiples, à réponse
 * tapée, ou à remettre dans l'ordre.
 *
 * Questions à choix multiples :
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

interface QuestionBase {
  /** Fiche interrogée (pour un classement : celle qui a motivé la question). */
  itemId: string;
  exercise: string;
  /** Ce qui est demandé : un mot, une définition, un événement… */
  prompt: string;
  /** Consigne propre à cette question (sinon, celle de l'exercice). */
  instruction?: string;
}

/** Choisir la bonne réponse parmi quatre. */
export interface ChoiceQuestion extends QuestionBase {
  type: "choice";
  choices: Choice[];
  correctChoiceId: string;
}

/** Résultat d'une réponse tapée. */
export interface TypedGrade {
  correct: boolean;
  /** Saisie identique à la réponse attendue (sinon, on affiche l'orthographe exacte). */
  exact: boolean;
  /** Précision sur l'écart : « 3 ans trop tôt ». */
  detail?: string;
}

/** Retrouver la réponse et la taper : un mot, ou une année. */
export interface TypedQuestion extends QuestionBase {
  type: "typed";
  /** « text » : un mot ; « year » : une année, saisie avec son ère (av. / apr. J.-C.). */
  input: "text" | "year";
  /** Réponse attendue, telle qu'on l'écrit (« alacrité », « 331 av. J.-C. »). */
  expected: string;
  /** Corrige une saisie (pour une année : l'année historienne, « -331 »). */
  grade(answer: string): TypedGrade;
}

/** Un élément à classer. */
export interface OrderEntry {
  itemId: string;
  label: string;
  /** Révélé après la réponse : la date de l'événement. */
  detail: string;
  /** Rang dans le bon ordre, à partir de 0. */
  rank: number;
}

/** Remettre des fiches dans l'ordre (chronologique). Chaque fiche est notée. */
export interface OrderQuestion extends QuestionBase {
  type: "order";
  /** Dans l'ordre d'affichage (mélangé). */
  entries: OrderEntry[];
}

export type Question = ChoiceQuestion | TypedQuestion | OrderQuestion;

/* ---------- Réponses et correction ---------- */

export type QuestionResponse =
  | { type: "choice"; choiceId: string }
  | { type: "typed"; text: string }
  | { type: "order"; itemIds: string[] };

export interface ItemGrade {
  itemId: string;
  correct: boolean;
}

/** Correction d'une réponse : une note par fiche concernée, et le verdict d'ensemble. */
export interface Outcome {
  response: QuestionResponse;
  grades: ItemGrade[];
  correct: boolean;
  /** Détail d'une réponse tapée. */
  typed?: TypedGrade;
}

export function gradeResponse(question: Question, response: QuestionResponse): Outcome {
  if (question.type === "choice" && response.type === "choice") {
    const correct = response.choiceId === question.correctChoiceId;
    return { response, grades: [{ itemId: question.itemId, correct }], correct };
  }
  if (question.type === "typed" && response.type === "typed") {
    const typed = response.text.trim() === "" ? { correct: false, exact: false } : question.grade(response.text);
    return { response, grades: [{ itemId: question.itemId, correct: typed.correct }], correct: typed.correct, typed };
  }
  if (question.type === "order" && response.type === "order") {
    const grades = gradeOrder(question.entries, response.itemIds);
    return { response, grades, correct: grades.every((grade) => grade.correct) };
  }
  throw new Error(`Réponse « ${response.type} » à une question « ${question.type} »`);
}

/**
 * Note d'un classement : sont justes les fiches d'une plus longue suite déjà dans
 * le bon ordre ; les autres sont « mal placées ». Intervertir deux voisines n'en
 * compte ainsi qu'une seule fausse, celle qu'il suffit de déplacer.
 */
export function gradeOrder(entries: OrderEntry[], orderedIds: string[]): ItemGrade[] {
  const rankOf = new Map(entries.map((entry) => [entry.itemId, entry.rank]));
  const ranks = orderedIds.map((id) => rankOf.get(id) ?? -1);
  const kept = longestIncreasing(ranks);
  return orderedIds.map((itemId, index) => ({ itemId, correct: kept.has(index) }));
}

/** Indices d'une plus longue sous-suite strictement croissante. */
function longestIncreasing(values: number[]): Set<number> {
  const length = values.map(() => 1);
  const previous = values.map(() => -1);
  values.forEach((value, i) => {
    for (let j = 0; j < i; j += 1) {
      if (values[j]! < value && length[j]! + 1 > length[i]!) {
        length[i] = length[j]! + 1;
        previous[i] = j;
      }
    }
  });
  let end = length.indexOf(Math.max(...length, 0));
  const kept = new Set<number>();
  while (end >= 0) {
    kept.add(end);
    end = previous[end]!;
  }
  return kept;
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
}: ChoiceQuestionOptions<Content>): ChoiceQuestion | null {
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
    type: "choice",
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
