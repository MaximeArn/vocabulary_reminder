import type { Card } from "../domain/card";
import type { Describer } from "../domain/collection";
import type { Category } from "./views";
import { vocabulary } from "./vocabulary";
import { historicalEvent } from "./historical-event";
import type { Unit } from "./model";

/**
 * Registre des catégories (logique + affichage).
 * Ajouter une catégorie : créer son dossier et l'inscrire ici (et dans `models.ts`).
 */
/** Registre hétérogène : chaque catégorie est typée dans son propre module. */
export type AnyCategory = Category<any, any>;

export const CATEGORIES: AnyCategory[] = [vocabulary, historicalEvent];

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

const GENERIC_UNIT: Unit = { singular: "fiche", plural: "fiches" };

/**
 * Unité pour compter des fiches de ces catégories : celle de la catégorie si
 * elles en ont toutes une seule (« 3 mots »), sinon « fiches ».
 */
export function unitForKinds(kinds: string[]): Unit {
  const distinct = new Set(kinds);
  const [only] = distinct;
  return (distinct.size === 1 && only && findCategory(only)?.unit) || GENERIC_UNIT;
}

export function unitFor(cards: Card[]): Unit {
  return unitForKinds(cards.map((card) => card.item.kind));
}

/** Options d'un filtre par catégorie (« Tout », « Vocabulaire », « Dates »), pour les catégories présentes. */
export function categoryFilterOptions(cards: Card[]): Record<string, string> | undefined {
  const present = CATEGORIES.filter((category) => cards.some((card) => card.item.kind === category.kind));
  if (present.length < 2) return undefined;
  return { all: "Tout", ...Object.fromEntries(present.map((category) => [category.kind, category.label])) };
}

/** Cartes d'une catégorie, ou toutes (« all »). */
export function filterByKind(cards: Card[], kind: string): Card[] {
  return kind === "all" ? cards : cards.filter((card) => card.item.kind === kind);
}
