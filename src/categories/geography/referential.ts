import data from "./data/departements.json";

/**
 * Référentiel géographique embarqué dans l'app (généré par scripts/geo/build-france.mjs
 * à partir de données IGN et geo.api.gouv.fr, Licence Ouverte Etalab).
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
