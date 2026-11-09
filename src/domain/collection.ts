import type { Card } from "./card";
import { comparisonKey } from "./text";

/** Recherche et tri de la collection, côté affichage, quelle que soit la catégorie. */

export type CardSort = "recent" | "oldest" | "alphabetical";

export const SORT_LABELS: Record<CardSort, string> = {
  recent: "Récents",
  oldest: "Anciens",
  alphabetical: "A → Z",
};

/** Ce qu'il faut savoir d'une catégorie pour chercher et trier ses cartes. */
export interface Describer {
  title: (card: Card) => string;
  searchTexts: (card: Card) => string[];
}

/** Garde les cartes dont l'un des textes contient la recherche (sans accents ni casse). */
export function searchCards(cards: Card[], query: string, describe: Describer): Card[] {
  const key = comparisonKey(query);
  if (key === "") return cards;
  return cards.filter((card) => describe.searchTexts(card).some((text) => comparisonKey(text).includes(key)));
}

const frenchCollator = new Intl.Collator("fr", { sensitivity: "base" });

export function sortCards(cards: Card[], sort: CardSort, describe: Describer): Card[] {
  const sorted = [...cards];
  switch (sort) {
    case "recent":
      return sorted.sort((a, b) => b.item.createdAt - a.item.createdAt);
    case "oldest":
      return sorted.sort((a, b) => a.item.createdAt - b.item.createdAt);
    case "alphabetical":
      return sorted.sort((a, b) => frenchCollator.compare(describe.title(a), describe.title(b)));
  }
}
