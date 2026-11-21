import type { ComponentType } from "react";
import type { Item } from "../domain/types";
import type { MapLayer } from "../domain/quiz";
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
  /** Occupe tout son conteneur (exploration libre), au lieu de garder ses proportions. */
  fill?: boolean;
  /**
   * Ce que montre la carte et ce qu'on y touche : les départements (par défaut), les
   * cours d'eau (départements en fond), ou les deux (exploration libre).
   */
  layer?: MapLayer | "all";
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

/** Exploration libre d'une catégorie, à la place de la liste de la collection. */
export interface ExplorerProps<Content> {
  items: Item<Content>[];
  /** Ouvre la fiche détaillée. */
  onOpen: (itemId: string) => void;
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
  /** Remplace la liste de la collection (géographie : la carte, à parcourir librement). */
  Explorer?: ComponentType<ExplorerProps<Content>>;
  /** Icône de la révision de chaque volet (catégorie à volets), par identifiant de volet. */
  trackIcons?: Record<string, ComponentType<{ size?: number }>>;
}

export type Category<Content, Draft> = CategoryModel<Content, Draft> & CategoryViews<Content, Draft>;
