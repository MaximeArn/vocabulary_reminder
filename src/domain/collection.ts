import { comparisonKey } from "./text";
import type { Word } from "./types";

/** Recherche et tri de la collection, côté affichage. */

export type WordSort = "recent" | "oldest" | "alphabetical";

export const SORT_LABELS: Record<WordSort, string> = {
  recent: "Récents",
  oldest: "Anciens",
  alphabetical: "A → Z",
};

/** Garde les mots dont le terme ou la définition contient la recherche. */
export function searchWords(words: Word[], query: string): Word[] {
  const key = comparisonKey(query);
  if (key === "") return words;
  return words.filter(
    (word) => word.termKey.includes(key) || comparisonKey(word.definition).includes(key),
  );
}

const frenchCollator = new Intl.Collator("fr", { sensitivity: "base" });

export function sortWords(words: Word[], sort: WordSort): Word[] {
  const sorted = [...words];
  switch (sort) {
    case "recent":
      return sorted.sort((a, b) => b.createdAt - a.createdAt);
    case "oldest":
      return sorted.sort((a, b) => a.createdAt - b.createdAt);
    case "alphabetical":
      return sorted.sort((a, b) => frenchCollator.compare(a.term, b.term));
  }
}

/** Autre mot de la collection portant déjà ce terme (doublon ou autre sens). */
export function findSameTerm(words: Word[], term: string, excludedId?: string): Word | undefined {
  const key = comparisonKey(term);
  if (key === "") return undefined;
  return words.find((word) => word.termKey === key && word.id !== excludedId);
}
