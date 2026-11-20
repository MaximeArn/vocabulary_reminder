import { initialProgress, replayProgress, type Progress } from "./srs";
import type { Item, Review } from "./types";

/**
 * Une « carte » : une fiche et sa progression calculée.
 * C'est l'unité manipulée par les sessions, les statistiques et les écrans.
 *
 * Une catégorie peut suivre plusieurs volets d'une même fiche séparément
 * (géographie : placer un département, son numéro, sa préfecture) : la fiche
 * donne alors une carte par volet, chacune avec sa propre progression.
 */
export interface Card<Content = unknown> {
  item: Item<Content>;
  progress: Progress;
  /** Volet suivi à part ; absent : une seule progression pour la fiche. */
  track?: string;
}

/** Volets d'une catégorie, et le volet auquel appartient chaque exercice. */
export interface Tracks {
  ids: readonly string[];
  of(exercise: string): string | undefined;
}

export type TracksOf = (kind: string) => Tracks | undefined;
const noTracks: TracksOf = () => undefined;

/** Identifiant d'une carte : la fiche, et son volet s'il y en a un. */
export function cardKey(itemId: string, track?: string): string {
  return track === undefined ? itemId : `${itemId}#${track}`;
}

export const keyOfCard = (card: Card) => cardKey(card.item.id, card.track);

/**
 * Assemble les cartes des fiches actives, à partir de l'historique complet. Pour
 * une catégorie à volets, chaque réponse compte pour le volet de son exercice
 * (une réponse dont l'exercice n'appartient à aucun volet est ignorée).
 */
export function buildCards(items: Item[], reviews: Review[], tracksOf: TracksOf = noTracks): Card[] {
  const active = items.filter((item) => item.deletedAt === undefined);
  const kindById = new Map(active.map((item) => [item.id, item.kind]));
  const reviewsByKey = new Map<string, Review[]>();
  for (const review of reviews) {
    const kind = kindById.get(review.itemId);
    if (kind === undefined) continue;
    const tracks = tracksOf(kind);
    const track = tracks?.of(review.exercise);
    if (tracks && track === undefined) continue;
    const key = cardKey(review.itemId, track);
    const list = reviewsByKey.get(key);
    if (list) list.push(review);
    else reviewsByKey.set(key, [review]);
  }
  return active.flatMap((item) => {
    const progressOf = (track?: string) => {
      const history = reviewsByKey.get(cardKey(item.id, track));
      return history ? replayProgress(item.createdAt, history) : initialProgress(item.createdAt);
    };
    const tracks = tracksOf(item.kind);
    if (!tracks) return [{ item, progress: progressOf() }];
    return tracks.ids.map((track) => ({ item, track, progress: progressOf(track) }));
  });
}

/**
 * Une carte par fiche (liste de la collection) : pour une fiche à volets, celle du
 * volet le moins avancé, qui résume ce qu'il reste à apprendre.
 */
export function oneCardPerItem(cards: Card[]): Card[] {
  const byItem = new Map<string, Card>();
  for (const card of cards) {
    const kept = byItem.get(card.item.id);
    if (!kept || card.progress.box < kept.progress.box) byItem.set(card.item.id, card);
  }
  return [...byItem.values()];
}
