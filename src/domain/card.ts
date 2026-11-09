import { progressByItem, initialProgress, type Progress } from "./srs";
import type { Item, Review } from "./types";

/**
 * Une « carte » : une fiche et sa progression calculée.
 * C'est l'unité manipulée par les sessions, les statistiques et les écrans.
 */
export interface Card<Content = unknown> {
  item: Item<Content>;
  progress: Progress;
}

/** Assemble les cartes des fiches actives, à partir de l'historique complet. */
export function buildCards(items: Item[], reviews: Review[]): Card[] {
  const active = items.filter((item) => item.deletedAt === undefined);
  const progress = progressByItem(active, reviews);
  return active.map((item) => ({ item, progress: progress.get(item.id) ?? initialProgress(item.createdAt) }));
}
