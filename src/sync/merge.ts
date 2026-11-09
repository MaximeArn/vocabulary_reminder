import type { Item, Review, Setting } from "../domain/types";

/**
 * Règles de fusion à la réception des données du serveur.
 * Une modification ne remplace la version locale que si elle est plus récente :
 * c'est la même règle que côté serveur, donc les appareils convergent.
 */

/** Fiches distantes à enregistrer localement (nouvelles ou plus récentes). */
export function itemsToApply(remote: Item[], local: Map<string, Item>): Item[] {
  return remote.filter((item) => {
    const current = local.get(item.id);
    return !current || current.updatedAt < item.updatedAt;
  });
}

/** Réponses distantes absentes localement (l'historique ne fait que s'additionner). */
export function reviewsToApply(remote: Review[], localIds: Set<string>): Review[] {
  return remote.filter((review) => !localIds.has(review.id));
}

/** Réglages distants plus récents que les réglages locaux. */
export function settingsToApply(remote: Setting[], local: Map<string, Setting>): Setting[] {
  return remote.filter((setting) => (local.get(setting.key)?.updatedAt ?? -1) < (setting.updatedAt ?? 0));
}
