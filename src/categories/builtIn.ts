import type { Item } from "../domain/types";
import type { AnyCategoryModel } from "./models";

/**
 * Fiches des catégories intégrées (géographie) : ce qu'il faut créer, rétablir ou
 * retirer pour qu'il y ait exactement une fiche active par entrée du référentiel.
 *
 * - Entrée sans fiche : création, avec un identifiant déterministe (le même sur
 *   tous les appareils du compte : pas de doublon à la synchronisation).
 * - Entrée dont la fiche a été supprimée : rétablissement (l'historique est gardé).
 * - Entrée en double (fiches créées sur deux appareils avant une synchronisation,
 *   ou ajoutées à la main avant que la catégorie soit intégrée) : on garde celle qui
 *   a un historique, sinon celle à l'identifiant déterministe ; les autres, sans
 *   historique, sont retirées.
 */
export interface BuiltInPlan {
  create: { id: string; content: unknown }[];
  restore: string[];
  remove: string[];
}

export function planBuiltInItems(
  model: AnyCategoryModel,
  existing: Item[],
  reviewed: Set<string>,
  idFor: (key: string) => string,
): BuiltInPlan {
  const builtIn = model.builtIn!;
  const plan: BuiltInPlan = { create: [], restore: [], remove: [] };
  const byKey = new Map<string, Item[]>();
  for (const item of existing) {
    if (item.kind !== model.kind) continue;
    let key: string;
    try {
      key = builtIn.key(item.content);
    } catch {
      continue; // contenu illisible : laissé tel quel
    }
    byKey.set(key, [...(byKey.get(key) ?? []), item]);
  }

  // La meilleure fiche à garder : avec un historique, puis l'identifiant attendu, puis la plus ancienne.
  const rank = (key: string) => (item: Item) =>
    (reviewed.has(item.id) ? 0 : 2) + (item.id === idFor(key) ? 0 : 1);
  const best = (key: string, items: Item[]) =>
    [...items].sort((a, b) => rank(key)(a) - rank(key)(b) || a.createdAt - b.createdAt)[0]!;

  for (const content of builtIn.entries()) {
    const key = builtIn.key(content);
    const items = byKey.get(key) ?? [];
    const alive = items.filter((item) => item.deletedAt === undefined);
    if (alive.length === 0) {
      if (items.length > 0) plan.restore.push(best(key, items).id);
      else plan.create.push({ id: idFor(key), content });
      continue;
    }
    const keep = best(key, alive);
    for (const item of alive) {
      if (item.id !== keep.id && !reviewed.has(item.id)) plan.remove.push(item.id);
    }
  }
  return plan;
}
