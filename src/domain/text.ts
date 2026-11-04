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
