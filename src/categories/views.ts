import type { ComponentType } from "react";
import type { Item } from "../domain/types";
import type { CategoryModel, DraftErrors } from "./model";

/** Contrat d'une catégorie, partie affichage (composants React). */

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
  /** Explication affichée après une réponse en révision. */
  Explanation: ComponentType<{ content: Content }>;
}

export type Category<Content, Draft> = CategoryModel<Content, Draft> & CategoryViews<Content, Draft>;
