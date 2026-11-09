import type { Category } from "../views";
import { vocabularyModel, type VocabularyContent, type VocabularyDraft } from "./model";
import { VocabularyDetail, VocabularyExplanation, VocabularyFields } from "./views";

export const vocabulary: Category<VocabularyContent, VocabularyDraft> = {
  ...vocabularyModel,
  Fields: VocabularyFields,
  Detail: VocabularyDetail,
  Explanation: VocabularyExplanation,
};
