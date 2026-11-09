/**
 * Types du moteur de mémorisation, communs à toutes les catégories.
 * Ce dossier ne dépend ni de React ni de la base de données.
 */

/** Une fiche de connaissance (un mot, un événement historique…). */
export interface Item<Content = unknown> {
  id: string;
  /** Catégorie de la fiche : « vocabulary », « historical-event »… */
  kind: string;
  /** Contenu propre à la catégorie, validé par celle-ci. */
  content: Content;
  /** Horodatages en millisecondes (epoch). */
  createdAt: number;
  updatedAt: number;
  /**
   * Suppression « douce » : la fiche est masquée mais conservée, pour que la
   * suppression puisse être annulée et, plus tard, synchronisée entre appareils.
   */
  deletedAt?: number;
}

/** Une réponse donnée en révision. Journal en ajout seul : la progression en découle. */
export interface Review {
  id: string;
  itemId: string;
  answeredAt: number;
  /** Jour d'étude de la réponse (AAAA-MM-JJ), figé : le rejeu est indépendant du fuseau. */
  studyDay: string;
  /** Type d'exercice, préfixé par la catégorie : « vocabulary.word-to-definition ». */
  exercise: string;
  correct: boolean;
}

/** Réglage ou information technique, stocké sous forme clé / valeur. */
export interface Setting {
  key: string;
  value: unknown;
}
