import { db } from "./db";
import { createWord, editWord, type WordDraft } from "../domain/word";
import type { Review, Word } from "../domain/types";

/** Opérations d'écriture sur les mots. Les lectures passent par `useLiveQuery`. */

export async function addWord(draft: WordDraft): Promise<Word> {
  const word = createWord(draft, crypto.randomUUID(), Date.now());
  await db.words.add(word);
  return word;
}

export async function updateWord(id: string, draft: WordDraft): Promise<Word> {
  return db.transaction("rw", db.words, async () => {
    const word = await db.words.get(id);
    if (!word) throw new Error("Ce mot n’existe plus.");
    const edited = editWord(word, draft, Date.now());
    await db.words.put(edited);
    return edited;
  });
}

/** Ce qu'il faut conserver pour pouvoir annuler une suppression. */
export interface DeletedWord {
  word: Word;
  reviews: Review[];
}

/** Supprime un mot et son historique de révisions. */
export async function deleteWord(id: string): Promise<DeletedWord> {
  return db.transaction("rw", db.words, db.reviews, async () => {
    const word = await db.words.get(id);
    if (!word) throw new Error("Ce mot n’existe plus.");
    const reviews = await db.reviews.where("wordId").equals(id).toArray();
    await db.reviews.where("wordId").equals(id).delete();
    await db.words.delete(id);
    return { word, reviews };
  });
}

/** Annule une suppression : remet le mot et son historique tels quels. */
export async function restoreWord({ word, reviews }: DeletedWord): Promise<void> {
  await db.transaction("rw", db.words, db.reviews, async () => {
    await db.words.put(word);
    await db.reviews.bulkPut(reviews);
  });
}
