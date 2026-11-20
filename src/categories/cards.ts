import { buildCards as buildCardsWithTracks, type Card, type Tracks } from "../domain/card";
import type { Item, Review } from "../domain/types";
import { CATEGORY_MODELS, findCategoryModel } from "./models";

/** Volets de chaque catégorie qui en a (géographie), calculés une fois. */
const TRACKS = new Map<string, Tracks>(
  CATEGORY_MODELS.filter((model) => model.tracks).map((model) => {
    const trackByExercise = new Map(model.exercises.map((exercise) => [exercise.id, exercise.track]));
    return [model.kind, { ids: model.tracks!.map((track) => track.id), of: (exercise: string) => trackByExercise.get(exercise) }];
  }),
);

export const tracksOf = (kind: string): Tracks | undefined => TRACKS.get(kind);

/** Cartes des fiches actives, avec une carte par volet pour les catégories à volets. */
export function buildCards(items: Item[], reviews: Review[]): Card[] {
  return buildCardsWithTracks(items, reviews, tracksOf);
}

/** Le volet (« Carte », « Numéro »…) d'une carte, s'il y en a un. */
export function trackOf(card: Pick<Card, "item" | "track">) {
  return card.track === undefined ? undefined : findCategoryModel(card.item.kind)?.tracks?.find((track) => track.id === card.track);
}
