import { db } from "./db";
import { nextSchedule } from "../domain/srs";
import type { QuizMode, Word } from "../domain/types";

/**
 * Enregistre une réponse : met à jour le planning du mot et ajoute la réponse
 * à l'historique, dans une même transaction (tout ou rien).
 */
export async function recordAnswer(wordId: string, mode: QuizMode, correct: boolean, today: string): Promise<Word> {
  return db.transaction("rw", db.words, db.reviews, async () => {
    const word = await db.words.get(wordId);
    if (!word) throw new Error("Ce mot n’existe plus.");

    const schedule = nextSchedule(word, correct, today);
    const updated: Word = { ...word, ...schedule };
    await db.words.put(updated);
    await db.reviews.add({
      id: crypto.randomUUID(),
      wordId,
      answeredAt: Date.now(),
      mode,
      correct,
      boxBefore: word.box,
      boxAfter: schedule.box,
    });
    return updated;
  });
}
