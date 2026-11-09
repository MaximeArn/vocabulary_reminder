import type { Category } from "../views";
import { historicalEventModel, type HistoricalEventContent, type HistoricalEventDraft } from "./model";
import { HistoricalEventDetail, HistoricalEventExplanation, HistoricalEventFields } from "./views";

export const historicalEvent: Category<HistoricalEventContent, HistoricalEventDraft> = {
  ...historicalEventModel,
  Fields: HistoricalEventFields,
  Detail: HistoricalEventDetail,
  Explanation: HistoricalEventExplanation,
};
