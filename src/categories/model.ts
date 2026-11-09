import type { Question } from "../domain/quiz";
import type { Random } from "../domain/random";
import type { Item } from "../domain/types";

/**
 * Contrat d'une catégorie de connaissances (partie logique, sans React).
 *
 * Le moteur (sessions, répétition espacée, statistiques, sauvegarde) ne connaît
 * que ce contrat. Ajouter une catégorie = écrire un module qui l'implémente
 * et l'inscrire dans `registry`.
 */

/** Erreur de contenu, avec un message destiné à l'utilisateur. */
export class InvalidContentError extends Error {}

/** Un type de question pour une catégorie (« retrouver la définition »…). */
export interface Exercise<Content> {
  /** Identifiant stable, préfixé par la catégorie : « vocabulary.word-to-definition ». */
  id: string;
  /** Libellé court, pour le choix du type de question (« La définition »). */
  label: string;
  /** Consigne affichée au-dessus de la question. */
  instruction: string;
  /**
   * Mise en forme : un énoncé court affiché en grand (« alacrité ») ou un texte
   * (une définition) ; des propositions courtes (des mots) ou longues (des définitions).
   */
  promptStyle: "headline" | "text";
  choiceStyle: "short" | "long";
  /** Construit une question pour `target`, ou `null` si c'est impossible. */
  build(target: Item<Content>, pool: Item<Content>[], random?: Random): Question | null;
}

/** Erreurs de saisie, par champ du formulaire. */
export type DraftErrors = Record<string, string | undefined>;

/** Unité de comptage : « 1 mot », « 3 dates ». */
export interface Unit {
  singular: string;
  plural: string;
}

export function formatCount(count: number, unit: Unit): string {
  return `${count} ${count > 1 ? unit.plural : unit.singular}`;
}

export interface CategoryModel<Content, Draft> {
  kind: string;
  /** « Vocabulaire », « Dates » (filtres, réglages). */
  label: string;
  unit: Unit;
  /** Choix dans le menu d'ajout : « Un mot ». */
  addLabel: string;
  /** Titre du formulaire d'ajout : « Nouveau mot ». */
  newItemTitle: string;
  /** Message après un ajout. */
  addedMessage(title: string): string;
  /** Couleur d'identité de la catégorie (variable CSS de `tokens.css`) et sa version claire. */
  color: string;
  softColor: string;
  /** Texte d'aide du champ de recherche. */
  searchPlaceholder: string;
  /**
   * Présentation dans la liste : « definition » (titre, puis résumé) ou
   * « timeline » (résumé en tête, comme une date sur une frise, puis titre).
   */
  listStyle: "definition" | "timeline";
  /** Position dans le temps, pour un tri chronologique (catégories datées seulement). */
  chronologicalKey?(content: Content): number;
  /** Vérifie et normalise un contenu venu de l'extérieur (sauvegarde, synchronisation). */
  validateContent(raw: unknown): Content;

  /** Titre de la fiche (liste, bilan, messages). */
  title(content: Content): string;
  /** Résumé affiché sous le titre dans la liste. */
  subtitle(content: Content): string;
  /** Textes dans lesquels chercher. */
  searchTexts(content: Content): string[];

  exercises: Exercise<Content>[];
  /** Assez de fiches pour composer des questions ? */
  canBuildQuestions(items: Item<Content>[]): boolean;

  /* Formulaire */
  emptyDraft(): Draft;
  draftFrom(content: Content): Draft;
  validateDraft(draft: Draft): DraftErrors;
  contentFrom(draft: Draft): Content;
}

export function hasDraftErrors(errors: DraftErrors): boolean {
  return Object.values(errors).some((error) => error !== undefined);
}

/* ---------- Outils de validation partagés ---------- */

export function expectRecord(value: unknown): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new InvalidContentError("Le contenu de la fiche est invalide.");
  }
  return value as Record<string, unknown>;
}

export function expectText(record: Record<string, unknown>, field: string): string {
  const value = record[field];
  if (typeof value !== "string" || value.trim() === "") {
    throw new InvalidContentError(`Le champ « ${field} » est absent ou invalide.`);
  }
  return value;
}

export function optionalText(record: Record<string, unknown>, field: string): string | undefined {
  const value = record[field];
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value !== "string") throw new InvalidContentError(`Le champ « ${field} » est invalide.`);
  return value;
}
