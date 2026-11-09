/** Outils de normalisation du texte saisi. */

/**
 * Nettoie un texte saisi : espaces superflus retirés, apostrophe typographique.
 * Les retours à la ligne sont conservés (une définition peut en contenir).
 */
export function cleanText(text: string): string {
  return text
    .replace(/'/g, "’")
    .split("\n")
    .map((line) => line.replace(/[ \t]+/g, " ").trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Comme `cleanText`, mais renvoie `undefined` pour un champ facultatif vide. */
export function cleanOptionalText(text: string | undefined): string | undefined {
  const cleaned = cleanText(text ?? "");
  return cleaned === "" ? undefined : cleaned;
}

/**
 * Clé de comparaison : minuscules, sans accents ni espaces superflus.
 * « Résipiscence » et « resipiscence » donnent la même clé.
 */
export function comparisonKey(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[’']/g, "'")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/** Retire les guillemets qui entourent un texte : l'affichage les ajoute lui-même. */
export function stripSurroundingQuotes(text: string | undefined): string | undefined {
  if (text === undefined) return undefined;
  const stripped = text.replace(/^[«"“]\s*/, "").replace(/\s*[»"”]$/, "").trim();
  return stripped === "" ? undefined : stripped;
}

/**
 * Distance d'édition entre deux textes (Damerau-Levenshtein restreinte) :
 * lettre manquante, en trop, fausse, ou deux lettres voisines inversées.
 */
export function editDistance(a: string, b: string): number {
  const rows = a.length + 1;
  const columns = b.length + 1;
  const distance: number[][] = Array.from({ length: rows }, (_, i) =>
    Array.from({ length: columns }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)),
  );
  for (let i = 1; i < rows; i += 1) {
    for (let j = 1; j < columns; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let best = Math.min(distance[i - 1]![j]! + 1, distance[i]![j - 1]! + 1, distance[i - 1]![j - 1]! + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        best = Math.min(best, distance[i - 2]![j - 2]! + 1);
      }
      distance[i]![j] = best;
    }
  }
  return distance[a.length]![b.length]!;
}

/** Clé pour corriger un mot tapé : comme `comparisonKey`, tirets et apostrophes comptant pour des espaces. */
export function answerKey(text: string): string {
  return comparisonKey(text).replace(/[-'’\s]+/g, " ").trim();
}

/** Fautes tolérées selon la longueur du mot : aucune jusqu'à 3 lettres, une, puis deux à partir de 8. */
export function toleratedTypos(word: string): number {
  const length = answerKey(word).length;
  if (length <= 3) return 0;
  return length >= 8 ? 2 : 1;
}
