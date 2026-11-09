import type { CategoryModel } from "./model";
import { vocabularyModel } from "./vocabulary/model";

/**
 * Registre des catégories (partie logique). Utilisé par le domaine (sauvegardes,
 * synchronisation) sans dépendre de React. Les vues sont dans `registry.tsx`.
 */
/** Registre hétérogène : chaque catégorie est typée dans son propre module. */
export type AnyCategoryModel = CategoryModel<any, any>;

export const CATEGORY_MODELS: AnyCategoryModel[] = [vocabularyModel];

export function findCategoryModel(kind: string): AnyCategoryModel | undefined {
  return CATEGORY_MODELS.find((model) => model.kind === kind);
}
