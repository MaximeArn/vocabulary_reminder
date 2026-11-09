import { useState } from "react";
import { recordAnswer } from "../../data/reviewsRepository";
import type { Card } from "../../domain/card";
import type { Question } from "../../domain/quiz";
import type { SessionItem } from "../../domain/session";
import { findExercise } from "../../categories/registry";
import { useToast } from "../../ui/Toast";

/** Une question de la session. */
interface SessionEntry {
  item: SessionItem;
  question: Question;
  /** Question reposée en fin de session après une erreur : sans effet sur le planning. */
  isRetry: boolean;
}

export interface AnswerResult {
  itemId: string;
  correct: boolean;
  isRetry: boolean;
}

/**
 * Déroulement d'une session : question courante, réponse, passage à la suivante.
 * Chaque réponse est enregistrée immédiatement : quitter en cours de route ne perd rien.
 */
export function useReviewSession(cards: Card[], plan: SessionItem[], today: string) {
  const showToast = useToast();
  const [entries, setEntries] = useState<SessionEntry[]>(() => buildEntries(plan, cards));
  const [position, setPosition] = useState(0);
  const [selectedChoiceId, setSelectedChoiceId] = useState<string | null>(null);
  const [results, setResults] = useState<AnswerResult[]>([]);

  const current = entries[position];

  const answer = (choiceId: string) => {
    if (!current || selectedChoiceId !== null) return;
    const { item, question, isRetry } = current;
    const correct = choiceId === question.correctChoiceId;

    setSelectedChoiceId(choiceId);
    setResults((previous) => [...previous, { itemId: item.itemId, correct, isRetry }]);

    if (isRetry) return;
    recordAnswer(item.itemId, question.exercise, correct, today).catch(() =>
      showToast({ message: "Cette réponse n’a pas pu être enregistrée." }),
    );
    if (!correct) {
      const retry = buildQuestion({ ...item, exercise: question.exercise }, cards);
      if (retry) setEntries((previous) => [...previous, { item, question: retry, isRetry: true }]);
    }
  };

  const next = () => {
    setSelectedChoiceId(null);
    setPosition((previous) => previous + 1);
  };

  return {
    question: current?.question,
    isRetry: current?.isRetry ?? false,
    position,
    total: entries.length,
    selectedChoiceId,
    answered: selectedChoiceId !== null,
    finished: position >= entries.length,
    results,
    answer,
    next,
  };
}

/**
 * Construit la question d'une carte avec l'exercice prévu, parmi les fiches de sa
 * catégorie. Si c'est impossible (trop peu de fiches pour cet exercice), essaie
 * les autres exercices de la catégorie.
 */
function buildQuestion(sessionItem: SessionItem, cards: Card[]): Question | null {
  const found = findExercise(sessionItem.exercise);
  const target = cards.find((card) => card.item.id === sessionItem.itemId);
  if (!found || !target) return null;
  const pool = cards.filter((card) => card.item.kind === target.item.kind).map((card) => card.item);
  const exercises = [found.exercise, ...found.category.exercises.filter((exercise) => exercise !== found.exercise)];
  for (const exercise of exercises) {
    const question = exercise.build(target.item, pool);
    if (question) return question;
  }
  return null;
}

function buildEntries(plan: SessionItem[], cards: Card[]): SessionEntry[] {
  const entries: SessionEntry[] = [];
  for (const item of plan) {
    const question = buildQuestion(item, cards);
    if (question) entries.push({ item, question, isRetry: false });
  }
  return entries;
}
