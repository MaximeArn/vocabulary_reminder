import type { TypedGrade } from "./quiz";
import { answerKey, cleanText, editDistance, toleratedTypos } from "./text";

/**
 * Corrige un texte tapé (un mot, un nom de lieu). Majuscules, accents, tirets et
 * apostrophes ne comptent pas ; une petite faute (deux pour un mot long) est
 * acceptée, l'orthographe exacte étant alors affichée. Une autre réponse possible
 * de la même liste (`others`) n'est jamais acceptée, même proche.
 */
export function gradeTypedText(answer: string, expected: string, others: string[] = []): TypedGrade {
  const typed = answerKey(answer);
  const target = answerKey(expected);
  const exact = cleanText(answer).toLocaleLowerCase("fr") === cleanText(expected).toLocaleLowerCase("fr");
  if (typed === target) return { correct: true, exact };
  if (others.some((other) => answerKey(other) === typed)) return { correct: false, exact: false };
  return { correct: editDistance(typed, target) <= toleratedTypos(expected), exact: false };
}
