import { HashIcon, LandmarkIcon, MapIcon } from "../../ui/icons";
import type { Category } from "../views";
import { FranceMap } from "./FranceMap";
import { GEOGRAPHY_TRACKS, geographyModel, type GeographyContent, type GeographyDraft } from "./model";
import { findDepartment } from "./referential";
import { GeographyDetail, GeographyExplanation, GeographyExplorer, GeographyFields } from "./views";

export const geography: Category<GeographyContent, GeographyDraft> = {
  ...geographyModel,
  Fields: GeographyFields,
  Detail: GeographyDetail,
  Explanation: GeographyExplanation,
  Map: FranceMap,
  Explorer: GeographyExplorer,
  describeZone: (zone) => findDepartment(zone)?.name ?? zone,
  trackIcons: {
    [GEOGRAPHY_TRACKS.map.id]: MapIcon,
    [GEOGRAPHY_TRACKS.number.id]: HashIcon,
    [GEOGRAPHY_TRACKS.prefecture.id]: LandmarkIcon,
  },
};
