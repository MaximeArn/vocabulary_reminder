import { db } from "./db";

/**
 * Enregistre une réponse. La progression de la fiche en découle :
 * elle est recalculée à partir de l'historique, rien d'autre à mettre à jour.
 */
export async function recordAnswer(itemId: string, exercise: string, correct: boolean, studyDay: string): Promise<void> {
  await db.reviews.add({
    id: crypto.randomUUID(),
    itemId,
    answeredAt: Date.now(),
    studyDay,
    exercise,
    correct,
  });
}
