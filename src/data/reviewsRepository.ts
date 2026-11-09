import { db } from "./db";
import { markPending } from "./outbox";

/**
 * Enregistre une réponse. La progression de la fiche en découle :
 * elle est recalculée à partir de l'historique, rien d'autre à mettre à jour.
 */
export async function recordAnswer(itemId: string, exercise: string, correct: boolean, studyDay: string): Promise<void> {
  const id = crypto.randomUUID();
  await db.transaction("rw", db.reviews, db.outbox, async () => {
    await db.reviews.add({ id, itemId, answeredAt: Date.now(), studyDay, exercise, correct });
    await markPending("reviews", [id]);
  });
}
