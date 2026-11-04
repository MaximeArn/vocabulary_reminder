/**
 * Tirages aléatoires. La source de hasard est passée en paramètre
 * (par défaut Math.random) pour que les tests soient reproductibles.
 */
export type Random = () => number;

/** Copie mélangée d'un tableau (algorithme de Fisher-Yates). */
export function shuffle<T>(items: readonly T[], random: Random = Math.random): T[] {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index--) {
    const other = Math.floor(random() * (index + 1));
    [result[index], result[other]] = [result[other] as T, result[index] as T];
  }
  return result;
}

/** Générateur pseudo-aléatoire déterministe, pour les tests. */
export function seededRandom(seed: number): Random {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}
