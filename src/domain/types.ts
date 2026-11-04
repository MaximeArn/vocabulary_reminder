/**
 * Types métier de l'application.
 * Ce dossier ne dépend ni de React ni de la base de données.
 */

/** Un mot de la collection, avec son état de répétition espacée. */
export interface Word {
  id: string;
  term: string;
  /** Forme normalisée du mot (minuscules, sans accents) : recherche et doublons. */
  termKey: string;
  definition: string;
  example?: string;
  /** Horodatages en millisecondes (epoch). */
  createdAt: number;
  updatedAt: number;
  /** Boîte de Leitner : 0 = jamais révisé, puis 1 à 6. */
  box: number;
  /** Jour d'étude où le mot doit revenir, au format AAAA-MM-JJ (heure locale). */
  dueDay: string;
  /** Nombre de fois où le mot a été oublié. */
  lapses: number;
}

export type QuizMode = "word-to-definition" | "definition-to-word";

/** Une réponse donnée pendant une révision. Journal en ajout seul. */
export interface Review {
  id: string;
  wordId: string;
  answeredAt: number;
  mode: QuizMode;
  correct: boolean;
  boxBefore: number;
  boxAfter: number;
}

/** Réglage ou information technique, stocké sous forme clé / valeur. */
export interface Setting {
  key: string;
  value: unknown;
}
