import data from "./data/departements.json";
import riverData from "./data/cours-eau.json";

/**
 * Référentiel géographique embarqué dans l'app (généré par scripts/geo/build-france.mjs
 * à partir de données IGN, geo.api.gouv.fr et BD TOPAGE, Licence Ouverte Etalab).
 * Les fiches n'en gardent qu'une référence (« département 15 ») : rien à saisir.
 */

/** Point dans le repère de la carte (voir `carte-france.json`). */
export type MapPoint = [number, number];

export interface Department {
  /** Numéro : « 01 »… « 95 », « 2A », « 2B », « 971 »… */
  code: string;
  name: string;
  /** Code de la région. */
  region: string;
  prefecture: string;
  prefecturePoint: MapPoint;
  /** Point intérieur, au cœur du département. */
  center: MapPoint;
}

export interface Region {
  code: string;
  name: string;
}

export const DEPARTMENTS: Department[] = data.departments as Department[];
export const REGIONS: Region[] = data.regions;

const byCode = new Map(DEPARTMENTS.map((department) => [department.code, department]));
const regionNames = new Map(REGIONS.map((region) => [region.code, region.name]));

export function findDepartment(code: string): Department | undefined {
  return byCode.get(code);
}

export function regionName(code: string): string {
  return regionNames.get(code) ?? "";
}

const isOverseas = (code: string) => code.startsWith("97");

/**
 * Départements les plus proches sur la carte : de bons pièges pour les questions
 * à choix (on confond plus volontiers des voisins). L'outre-mer, dessiné en
 * encarts, est rapproché des autres départements d'outre-mer.
 */
export function nearestDepartments(code: string, count: number): Department[] {
  const target = byCode.get(code);
  if (!target) return [];
  const distance = (department: Department) =>
    Math.hypot(department.center[0] - target.center[0], department.center[1] - target.center[1]) +
    (isOverseas(department.code) === isOverseas(code) ? 0 : 10_000);
  return DEPARTMENTS.filter((department) => department.code !== code)
    .sort((a, b) => distance(a) - distance(b))
    .slice(0, count);
}

/* ---------- Cours d'eau ---------- */

export interface River {
  /** Identifiant stable (« loire ») : la fiche n'en garde que cette référence. */
  id: string;
  name: string;
  /** « la », « le », « l’ ». */
  article: string;
  /** Un fleuve se jette dans la mer ; une rivière, dans un autre cours d'eau. */
  kind: "fleuve" | "rivière";
  /** Où il se jette : « l’océan Atlantique », « la Seine »… */
  outlet: string;
}

/** Fleuves et grandes rivières de France (BD TOPAGE, liste choisie à la main). */
export const RIVERS: River[] = riverData as River[];

const riverById = new Map(RIVERS.map((river) => [river.id, river]));

export function findRiver(id: string): River | undefined {
  return riverById.get(id);
}

/** « la Loire », « l’Isère ». */
export function riverWithArticle(river: River): string {
  return river.article.endsWith("’") ? `${river.article}${river.name}` : `${river.article} ${river.name}`;
}

/** « Fleuve · se jette dans la Manche ». */
export function describeRiver(river: River): string {
  return `${river.kind === "fleuve" ? "Fleuve" : "Rivière"} · se jette dans ${river.outlet}`;
}
