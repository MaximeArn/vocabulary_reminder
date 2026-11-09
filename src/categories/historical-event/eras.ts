import type { HistoricalEventContent } from "./model";

/**
 * Les grandes époques de l'histoire, selon le découpage classique de
 * l'enseignement français. Un événement appartient à l'époque de son début
 * (la guerre de Cent Ans, 1337 – 1453, relève du Moyen Âge), et l'événement qui
 * ouvre une époque en fait partie (1492, 1789).
 */
export interface Era {
  id: string;
  label: string;
  /** Première année de l'époque (année historienne) ; absente pour la première. */
  from?: number;
}

export const ERAS: Era[] = [
  { id: "prehistory", label: "Préhistoire" },
  { id: "antiquity", label: "Antiquité", from: -3000 },
  { id: "middle-ages", label: "Moyen Âge", from: 476 },
  { id: "early-modern", label: "Temps modernes", from: 1492 },
  { id: "contemporary", label: "Époque contemporaine", from: 1789 },
];

/** Époque d'un événement, d'après l'année de son début. */
export function eraOf(content: HistoricalEventContent): Era {
  const year = content.start.year;
  let found = ERAS[0]!;
  for (const era of ERAS) if (era.from !== undefined && year >= era.from) found = era;
  return found;
}
