import { planBuiltInItems } from "../categories/builtIn";
import { CATEGORY_MODELS } from "../categories/models";
import { uuidV5 } from "../domain/uuid";
import { db } from "./db";
import { markPending } from "./outbox";

/** Espace de noms des identifiants déterministes de Mnémé (UUID v5). */
const NAMESPACE = "3c3c2f6a-1afb-4237-ab56-e23102351f18";

/** Exactement une fiche active par entrée du référentiel ? */
async function complete(kind: string, keys: string[], keyOf: (content: never) => string): Promise<boolean> {
  const alive = (await db.items.where("kind").equals(kind).toArray()).filter((item) => item.deletedAt === undefined);
  if (alive.length !== keys.length) return false;
  const found = new Set<string>();
  for (const item of alive) {
    try {
      found.add(keyOf(item.content as never));
    } catch {
      return false;
    }
  }
  return keys.every((key) => found.has(key));
}

/**
 * Crée (ou rétablit) les fiches des catégories intégrées pour ce compte, et retire
 * les doublons sans historique. Sans effet s'il n'y a rien à faire : appelée à
 * l'ouverture et après chaque synchronisation.
 */
export async function ensureBuiltInItems(userId: string): Promise<void> {
  for (const model of CATEGORY_MODELS) {
    if (!model.builtIn) continue;
    const keys = model.builtIn.entries().map((content) => model.builtIn!.key(content));
    // Cas habituel (tout est en place) : une simple lecture, sans transaction d'écriture.
    if (await complete(model.kind, keys, model.builtIn.key)) continue;
    const ids = new Map(
      await Promise.all(keys.map(async (key) => [key, await uuidV5(`${userId}:${model.kind}:${key}`, NAMESPACE)] as const)),
    );
    await db.transaction("rw", [db.items, db.reviews, db.outbox], async () => {
      const existing = await db.items.where("kind").equals(model.kind).toArray();
      // Pas de requête sur une liste vide (appareil neuf) : Dexie y répond hors transaction.
      const reviewed = new Set(
        existing.length === 0
          ? []
          : (await db.reviews.where("itemId").anyOf(existing.map((item) => item.id)).toArray()).map((review) => review.itemId),
      );
      const plan = planBuiltInItems(model, existing, reviewed, (key) => ids.get(key)!);
      if (plan.create.length + plan.restore.length + plan.remove.length === 0) return;
      const now = Date.now();
      await db.items.bulkAdd(
        plan.create.map(({ id, content }) => ({ id, kind: model.kind, content, createdAt: now, updatedAt: now })),
      );
      for (const id of plan.restore) await db.items.update(id, { deletedAt: undefined, updatedAt: now });
      for (const id of plan.remove) await db.items.update(id, { deletedAt: now, updatedAt: now });
      await markPending("items", [...plan.create.map((entry) => entry.id), ...plan.restore, ...plan.remove]);
    });
  }
}
