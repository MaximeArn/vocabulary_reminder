import { useState } from "react";
import { recordAnswer } from "../../data/reviewsRepository";
import type { Card } from "../../domain/card";
import { gradeResponse, type ItemGrade, type Outcome, type Question, type QuestionResponse } from "../../domain/quiz";
import { shuffle } from "../../domain/random";
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

/** Résultat d'une question : une note par fiche concernée (plusieurs pour un classement). */
export interface AnswerResult {
  grades: ItemGrade[];
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
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [results, setResults] = useState<AnswerResult[]>([]);

  const current = entries[position];

  const submit = (response: QuestionResponse) => {
    if (!current || outcome !== null) return;
    const { item, question, isRetry } = current;
    const graded = gradeResponse(question, response);

    setOutcome(graded);
    setResults((previous) => [...previous, { grades: graded.grades, correct: graded.correct, isRetry }]);

    if (isRetry) return;
    // Une réponse par fiche : un classement note chacun de ses événements.
    Promise.all(graded.grades.map((grade) => recordAnswer(grade.itemId, question.exercise, grade.correct, today))).catch(() =>
      showToast({ message: "Cette réponse n’a pas pu être enregistrée." }),
    );
    if (!graded.correct) {
      const retry =
        question.type === "order"
          ? { ...question, entries: shuffle(question.entries) }
          : buildQuestion({ ...item, exercise: question.exercise }, cards);
      if (retry) setEntries((previous) => [...previous, { item, question: retry, isRetry: true }]);
    }
  };

  const next = () => {
    setOutcome(null);
    setPosition((previous) => previous + 1);
  };

  return {
    question: current?.question,
    isRetry: current?.isRetry ?? false,
    position,
    total: entries.length,
    outcome,
    answered: outcome !== null,
    finished: position >= entries.length,
    results,
    submit,
    next,
  };
}

/**
 * Construit la question d'une carte avec l'exercice prévu, parmi les fiches de sa
 * catégorie (pour un classement : sans `excluded`, si possible). Si c'est impossible, essaie
 * l'exercice à choix correspondant, puis les autres exercices à choix.
 */
function buildQuestion(sessionItem: SessionItem, cards: Card[], excluded: Set<string> = new Set()): Question | null {
  const found = findExercise(sessionItem.exercise);
  const target = cards.find((card) => card.item.id === sessionItem.itemId);
  if (!found || !target) return null;
  const pool = cards.filter((card) => card.item.kind === target.item.kind).map((card) => card.item);
  const narrowed = pool.filter((item) => item.id === target.item.id || !excluded.has(item.id));
  const { category, exercise } = found;
  const fallbacks = [
    exercise,
    ...category.exercises.filter((candidate) => candidate.id === exercise.follows),
    ...category.exercises.filter((candidate) => candidate.mode === "choice" && candidate !== exercise),
  ];
  for (const candidate of fallbacks) {
    const question =
      (candidate.mode === "order" ? candidate.build(target.item, narrowed) : null) ?? candidate.build(target.item, pool);
    if (question) return question;
  }
  return null;
}

function buildEntries(plan: SessionItem[], cards: Card[]): SessionEntry[] {
  // Un classement évite, si possible, les fiches déjà interrogées dans la session.
  const planned = new Set(plan.map((item) => item.itemId));
  const entries: SessionEntry[] = [];
  for (const item of plan) {
    const question = buildQuestion(item, cards, planned);
    if (question) entries.push({ item, question, isRetry: false });
  }
  return entries;
}
