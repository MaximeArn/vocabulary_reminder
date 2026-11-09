import type { Card } from "../domain/card";
import type { Describer } from "../domain/collection";
import type { Category } from "./views";
import { vocabulary } from "./vocabulary";

/**
 * Registre des catégories (logique + affichage).
 * Ajouter une catégorie : créer son dossier et l'inscrire ici (et dans `models.ts`).
 */
/** Registre hétérogène : chaque catégorie est typée dans son propre module. */
export type AnyCategory = Category<any, any>;

export const CATEGORIES: AnyCategory[] = [vocabulary];

export function findCategory(kind: string): AnyCategory | undefined {
  return CATEGORIES.find((category) => category.kind === kind);
}

/** Exercice d'une catégorie, à partir de son identifiant (« vocabulary.word-to-definition »). */
export function findExercise(exerciseId: string) {
  for (const category of CATEGORIES) {
    const exercise = category.exercises.find((candidate) => candidate.id === exerciseId);
    if (exercise) return { category, exercise };
  }
  return undefined;
}

/** Titre et textes de recherche d'une carte, quelle que soit sa catégorie. */
export const describeCard: Describer = {
  title: (card: Card) => findCategory(card.item.kind)?.title(card.item.content) ?? "",
  searchTexts: (card: Card) => findCategory(card.item.kind)?.searchTexts(card.item.content) ?? [],
};
