import { useState } from "react";
import { recordAnswer } from "../../data/reviewsRepository";
import { buildQuestion, type Question } from "../../domain/quiz";
import type { SessionItem } from "../../domain/session";
import type { Word } from "../../domain/types";
import { useToast } from "../../ui/Toast";

/** Une question de la session. */
interface SessionEntry {
  item: SessionItem;
  question: Question;
  /** Question reposée en fin de session après une erreur : sans effet sur le planning. */
  isRetry: boolean;
}

export interface AnswerResult {
  wordId: string;
  correct: boolean;
  isRetry: boolean;
}

/**
 * Déroulement d'une session : question courante, réponse, passage à la suivante.
 * Chaque réponse est enregistrée immédiatement : quitter en cours de route ne perd rien.
 */
export function useReviewSession(words: Word[], plan: SessionItem[], today: string) {
  const showToast = useToast();
  const [entries, setEntries] = useState<SessionEntry[]>(() => buildEntries(plan, words));
  const [position, setPosition] = useState(0);
  const [selectedWordId, setSelectedWordId] = useState<string | null>(null);
  const [results, setResults] = useState<AnswerResult[]>([]);

  const current = entries[position];

  const answer = (choiceWordId: string) => {
    if (!current || selectedWordId !== null) return;
    const { item, question, isRetry } = current;
    const correct = choiceWordId === question.wordId;

    setSelectedWordId(choiceWordId);
    setResults((previous) => [...previous, { wordId: item.wordId, correct, isRetry }]);

    if (isRetry) return;
    recordAnswer(item.wordId, item.mode, correct, today).catch(() =>
      showToast({ message: "Cette réponse n’a pas pu être enregistrée." }),
    );
    if (!correct) {
      const word = words.find((candidate) => candidate.id === item.wordId);
      const retry = word && buildQuestion(word, words, item.mode);
      if (retry) setEntries((previous) => [...previous, { item, question: retry, isRetry: true }]);
    }
  };

  const next = () => {
    setSelectedWordId(null);
    setPosition((previous) => previous + 1);
  };

  return {
    question: current?.question,
    isRetry: current?.isRetry ?? false,
    position,
    total: entries.length,
    selectedWordId,
    answered: selectedWordId !== null,
    finished: position >= entries.length,
    results,
    answer,
    next,
  };
}

function buildEntries(plan: SessionItem[], words: Word[]): SessionEntry[] {
  const entries: SessionEntry[] = [];
  for (const item of plan) {
    const word = words.find((candidate) => candidate.id === item.wordId);
    const question = word && buildQuestion(word, words, item.mode);
    if (question) entries.push({ item, question, isRetry: false });
  }
  return entries;
}
