import type { ComponentType } from "react";
import type { Item } from "../domain/types";
import type { CategoryModel, DraftErrors } from "./model";

/** Contrat d'une catégorie, partie affichage (composants React). */

/** Mise en évidence d'une zone de carte : la question, le choix en cours, la correction. */
export type ZoneTone = "highlight" | "selected" | "good" | "bad";

export interface MapViewProps {
  /** Zones mises en évidence, par identifiant. */
  tones?: Record<string, ZoneTone>;
  /** Toucher une zone la choisit ; absent : la carte ne sert qu'à montrer (le zoom reste possible). */
  onSelect?: (zone: string) => void;
  /** Description pour les lecteurs d'écran. */
  label: string;
}

export interface FieldsProps<Content, Draft> {
  draft: Draft;
  onChange: (draft: Draft) => void;
  errors: DraftErrors;
  /** Autres fiches de la même catégorie (doublons, suggestions…). */
  items: Item<Content>[];
  /** Fiche en cours de modification, absente pour un ajout. */
  editedId?: string;
}

export interface CategoryViews<Content, Draft> {
  /** Champs du formulaire d'ajout / de modification. */
  Fields: ComponentType<FieldsProps<Content, Draft>>;
  /** Contenu de la fiche détaillée. */
  Detail: ComponentType<{ content: Content }>;
  /**
   * Explication affichée après une réponse en révision. `showMap` : la question
   * n'avait pas de carte, l'explication peut en montrer une (géographie).
   */
  Explanation: ComponentType<{ content: Content; showMap?: boolean }>;
  /** Carte des questions de cette catégorie (géographie), et le nom de chaque zone. */
  Map?: ComponentType<MapViewProps>;
  describeZone?: (zone: string) => string;
}

export type Category<Content, Draft> = CategoryModel<Content, Draft> & CategoryViews<Content, Draft>;
