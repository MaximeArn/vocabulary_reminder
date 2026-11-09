import type { Card } from "./card";
import { comparisonKey } from "./text";

/** Recherche et tri de la collection, côté affichage, quelle que soit la catégorie. */

/** Critère de tri, et son sens : croissant (↑) ou décroissant (↓). */
export type SortKey = "added" | "alphabetical" | "chronological";
export type SortDirection = "asc" | "desc";

export interface CardSort {
  key: SortKey;
  direction: SortDirection;
}

export const SORT_KEY_LABELS: Record<SortKey, string> = {
  added: "Ajout",
  alphabetical: "Alphabétique",
  chronological: "Chronologique",
};

/** Ce qu'il faut savoir d'une catégorie pour chercher et trier ses cartes. */
export interface Describer {
  title: (card: Card) => string;
  searchTexts: (card: Card) => string[];
  /** Position dans le temps (catégories datées) ; absente sinon. */
  chronology?: (card: Card) => number | undefined;
}

/** Garde les cartes dont l'un des textes contient la recherche (sans accents ni casse). */
export function searchCards(cards: Card[], query: string, describe: Describer): Card[] {
  const key = comparisonKey(query);
  if (key === "") return cards;
  return cards.filter((card) => describe.searchTexts(card).some((text) => comparisonKey(text).includes(key)));
}

const frenchCollator = new Intl.Collator("fr", { sensitivity: "base" });

/**
 * Trie les cartes. Croissant : de la plus ancienne ajoutée à la plus récente,
 * de A à Z, de l'Antiquité à nos jours. Décroissant : l'inverse.
 */
export function sortCards(cards: Card[], sort: CardSort, describe: Describer): Card[] {
  const byTitle = (a: Card, b: Card) => frenchCollator.compare(describe.title(a), describe.title(b));
  const compare = {
    added: (a: Card, b: Card) => a.item.createdAt - b.item.createdAt,
    alphabetical: byTitle,
    chronological: (a: Card, b: Card) => {
      // À date égale (ou sans date), par ordre alphabétique.
      const position = (card: Card) => describe.chronology?.(card) ?? Number.POSITIVE_INFINITY;
      return position(a) - position(b) || byTitle(a, b);
    },
  }[sort.key];
  const sign = sort.direction === "asc" ? 1 : -1;
  return [...cards].sort((a, b) => sign * compare(a, b));
}
