import type { Category } from "../views";
import { FranceMap } from "./FranceMap";
import { geographyModel, type GeographyContent, type GeographyDraft } from "./model";
import { findDepartment } from "./referential";
import { GeographyDetail, GeographyExplanation, GeographyFields } from "./views";

export const geography: Category<GeographyContent, GeographyDraft> = {
  ...geographyModel,
  Fields: GeographyFields,
  Detail: GeographyDetail,
  Explanation: GeographyExplanation,
  Map: FranceMap,
  describeZone: (zone) => findDepartment(zone)?.name ?? zone,
};
