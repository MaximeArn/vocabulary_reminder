import { CHOICE_COUNT, type ChoiceQuestion, type LocateQuestion, type MapDisplay, type TypedGrade, type TypedQuestion } from "../../domain/quiz";
import { shuffle, type Random } from "../../domain/random";
import { comparisonKey } from "../../domain/text";
import { gradeTypedText } from "../../domain/typing";
import type { Item } from "../../domain/types";
import { InvalidContentError, expectRecord, expectText, type CategoryModel, type Exercise, type Track } from "../model";
import {
  DEPARTMENTS,
  RIVERS,
  describeRiver,
  findDepartment,
  findRiver,
  nearestDepartments,
  regionName,
  riverWithArticle,
  type Department,
  type River,
} from "./referential";

/**
 * Catégorie « Géographie » : des lieux de France, tirés du référentiel embarqué et
 * tous disponibles d'office (catégorie intégrée, sans ajout) : les départements et
 * les cours d'eau ; les villes suivront, avec leur propre `type`.
 */

export interface DepartmentContent {
  type: "department";
  /** Numéro du département (« 15 », « 2A », « 971 »). */
  code: string;
}

export interface RiverContent {
  type: "river";
  /** Identifiant du cours d'eau dans le référentiel (« loire »). */
  id: string;
}

export type GeographyContent = DepartmentContent | RiverContent;
/** Pas de formulaire : une fiche de géographie se choisit dans le référentiel. */
export type GeographyDraft = GeographyContent;

type GeographyItem = Item<GeographyContent>;

/** Département d'une fiche (le contenu a été validé : il existe). */
export function departmentOf(content: GeographyContent): Department {
  const department = content.type === "department" ? findDepartment(content.code) : undefined;
  if (!department) throw new InvalidContentError(`Département inconnu : ${JSON.stringify(content)}`);
  return department;
}

/** Cours d'eau d'une fiche (le contenu a été validé : il existe). */
export function riverOf(content: GeographyContent): River {
  const river = content.type === "river" ? findRiver(content.id) : undefined;
  if (!river) throw new InvalidContentError(`Cours d’eau inconnu : ${JSON.stringify(content)}`);
  return river;
}

/** Identifiant d'un lieu dans le référentiel, et zone de la carte : « 15 », « loire ». */
export const placeId = (content: GeographyContent) => (content.type === "department" ? content.code : content.id);

/** Nom d'un lieu : « Cantal », « Loire ». */
export const placeName = (content: GeographyContent) =>
  content.type === "department" ? departmentOf(content).name : riverOf(content).name;

const isDepartment = (item: GeographyItem) => item.content.type === "department";
const isRiver = (item: GeographyItem) => item.content.type === "river";

/* ---------- Questions à choix ---------- */

/** Voisins parmi lesquels tirer les mauvaises réponses (assez pour varier, assez proches pour piéger). */
const NEIGHBOURS = 8;

interface DepartmentChoiceOptions {
  exercise: string;
  prompt: string;
  instruction?: string;
  map?: MapDisplay;
  /** Ce que l'on propose : le numéro, le nom, la préfecture… */
  label: (department: Department) => string;
}

/**
 * Question à choix sur un département : les trois mauvaises réponses viennent
 * de départements voisins (tout le référentiel, pas seulement la collection).
 */
export function buildDepartmentChoice(
  target: GeographyItem,
  { exercise, prompt, instruction, map, label }: DepartmentChoiceOptions,
  random: Random = Math.random,
): ChoiceQuestion | null {
  const department = departmentOf(target.content);
  const used = new Set([comparisonKey(label(department))]);
  const distractors: Department[] = [];
  for (const candidate of shuffle(nearestDepartments(department.code, NEIGHBOURS), random)) {
    if (distractors.length === CHOICE_COUNT - 1) break;
    const key = comparisonKey(label(candidate));
    if (used.has(key)) continue;
    used.add(key);
    distractors.push(candidate);
  }
  if (distractors.length < CHOICE_COUNT - 1) return null;
  return {
    type: "choice",
    itemId: target.id,
    exercise,
    prompt,
    instruction,
    map,
    choices: shuffle([department, ...distractors], random).map((candidate) => ({ id: candidate.code, label: label(candidate) })),
    correctChoiceId: department.code,
  };
}

/* ---------- Réponses tapées ---------- */

/** « 1 » vaut « 01 » ; « 2a » vaut « 2A ». */
const normalizeCode = (text: string) => text.trim().toUpperCase().replace(/^0+(?=\d)/, "");

export function gradeTypedCode(answer: string, code: string): TypedGrade {
  const correct = normalizeCode(answer) === normalizeCode(code);
  return { correct, exact: correct && answer.trim().toUpperCase() === code };
}

const otherNames = (department: Department) => DEPARTMENTS.filter((d) => d.code !== department.code).map((d) => d.name);
const otherPrefectures = (department: Department) =>
  DEPARTMENTS.filter((d) => d.code !== department.code).map((d) => d.prefecture);

function typedQuestion(
  target: GeographyItem,
  exercise: string,
  options: Pick<TypedQuestion, "prompt" | "instruction" | "map" | "input" | "expected" | "grade">,
): TypedQuestion {
  return { type: "typed", itemId: target.id, exercise, ...options };
}

/* ---------- Cours d'eau ---------- */

/** Question à choix sur un cours d'eau : trois autres cours d'eau de la liste, au hasard. */
function buildRiverChoice(target: GeographyItem, exercise: string, random: Random = Math.random): ChoiceQuestion | null {
  const river = riverOf(target.content);
  const distractors = shuffle(
    RIVERS.filter((candidate) => candidate.id !== river.id),
    random,
  ).slice(0, CHOICE_COUNT - 1);
  if (distractors.length < CHOICE_COUNT - 1) return null;
  return {
    type: "choice",
    itemId: target.id,
    exercise,
    prompt: "",
    map: { highlight: river.id, layer: "rivers" },
    choices: shuffle([river, ...distractors], random).map((candidate) => ({ id: candidate.id, label: candidate.name })),
    correctChoiceId: river.id,
  };
}

/** Nom tapé, avec ou sans article : « Loire », « la Loire », « l'Isère ». */
const withoutArticle = (text: string) => text.trim().replace(/^(le|la|les)\s+|^l\s*['’]\s*/i, "");

/* ---------- Volets ---------- */

/**
 * Chaque département se révise sous trois angles, suivis séparément : savoir le
 * numéro du Cantal n'est pas savoir le placer. Chaque volet a sa révision.
 */
export const GEOGRAPHY_TRACKS = {
  map: { id: "map", label: "Départements sur la carte", shortLabel: "Carte", hint: "Les reconnaître et les placer" },
  number: { id: "number", label: "Numéros des départements", shortLabel: "Numéro", hint: "Du nom au numéro, et l’inverse" },
  prefecture: { id: "prefecture", label: "Préfectures", shortLabel: "Préfecture", hint: "D’un département à sa préfecture" },
  rivers: { id: "rivers", label: "Fleuves et rivières", shortLabel: "Cours d’eau", hint: "Les reconnaître et les placer" },
} satisfies Record<string, Track>;

const DEPARTMENT_UNIT = { singular: "département", plural: "départements", masculine: true };
const RIVER_UNIT = { singular: "cours d’eau", plural: "cours d’eau", masculine: true };

/* ---------- Exercices ---------- */

const DEPARTMENT_EXERCISE = { accepts: isDepartment, promptStyle: "headline" as const, choiceStyle: "short" as const };
const NUMBER = { ...DEPARTMENT_EXERCISE, track: GEOGRAPHY_TRACKS.number.id };
const MAP = { ...DEPARTMENT_EXERCISE, track: GEOGRAPHY_TRACKS.map.id };
const PREFECTURE = { ...DEPARTMENT_EXERCISE, track: GEOGRAPHY_TRACKS.prefecture.id };
const RIVER = { accepts: isRiver, promptStyle: "headline" as const, choiceStyle: "short" as const, track: GEOGRAPHY_TRACKS.rivers.id };

const departmentToNumber: Exercise<GeographyContent> = {
  ...NUMBER,
  id: "geography.department-to-number",
  mode: "choice",
  label: "Le numéro",
  instruction: "Quel est son numéro ?",
  build: (target, _pool, random) =>
    buildDepartmentChoice(
      target,
      { exercise: departmentToNumber.id, prompt: departmentOf(target.content).name, label: (d) => d.code },
      random,
    ),
};

const departmentToNumberTyped: Exercise<GeographyContent> = {
  ...NUMBER,
  id: "geography.department-to-number-typed",
  mode: "typed",
  follows: departmentToNumber.id,
  label: "Le numéro, tapé",
  instruction: "Tape son numéro",
  build: (target) => {
    const department = departmentOf(target.content);
    return typedQuestion(target, departmentToNumberTyped.id, {
      prompt: department.name,
      input: "code",
      expected: department.code,
      grade: (answer) => gradeTypedCode(answer, department.code),
    });
  },
};

const numberToDepartment: Exercise<GeographyContent> = {
  ...NUMBER,
  id: "geography.number-to-department",
  mode: "choice",
  label: "Le département",
  instruction: "Quel département porte ce numéro ?",
  build: (target, _pool, random) =>
    buildDepartmentChoice(
      target,
      { exercise: numberToDepartment.id, prompt: departmentOf(target.content).code, label: (d) => d.name },
      random,
    ),
};

const numberToDepartmentTyped: Exercise<GeographyContent> = {
  ...NUMBER,
  id: "geography.number-to-department-typed",
  mode: "typed",
  follows: numberToDepartment.id,
  label: "Le département, tapé",
  instruction: "Tape le département qui porte ce numéro",
  build: (target) => {
    const department = departmentOf(target.content);
    return typedQuestion(target, numberToDepartmentTyped.id, {
      prompt: department.code,
      input: "text",
      expected: department.name,
      grade: (answer) => gradeTypedText(answer, department.name, otherNames(department)),
    });
  },
};

const mapToDepartment: Exercise<GeographyContent> = {
  ...MAP,
  id: "geography.map-to-department",
  mode: "choice",
  label: "Sur la carte",
  instruction: "Quel est ce département ?",
  build: (target, _pool, random) => {
    const department = departmentOf(target.content);
    return buildDepartmentChoice(
      target,
      { exercise: mapToDepartment.id, prompt: "", map: { highlight: department.code }, label: (d) => d.name },
      random,
    );
  },
};

const mapToDepartmentTyped: Exercise<GeographyContent> = {
  ...MAP,
  id: "geography.map-to-department-typed",
  mode: "typed",
  follows: mapToDepartment.id,
  label: "Sur la carte, tapé",
  instruction: "Tape le nom de ce département",
  build: (target) => {
    const department = departmentOf(target.content);
    return typedQuestion(target, mapToDepartmentTyped.id, {
      prompt: "",
      map: { highlight: department.code },
      input: "text",
      expected: department.name,
      grade: (answer) => gradeTypedText(answer, department.name, otherNames(department)),
    });
  },
};

const departmentOnMap: Exercise<GeographyContent> = {
  ...MAP,
  id: "geography.department-on-map",
  mode: "map",
  label: "Le placer",
  instruction: "Touche ce département sur la carte",
  build: (target): LocateQuestion => {
    const department = departmentOf(target.content);
    return {
      type: "locate",
      itemId: target.id,
      exercise: departmentOnMap.id,
      prompt: department.name,
      map: {},
      target: department.code,
    };
  },
};

const departmentToPrefecture: Exercise<GeographyContent> = {
  ...PREFECTURE,
  id: "geography.department-to-prefecture",
  mode: "choice",
  label: "La préfecture",
  instruction: "Quelle est sa préfecture ?",
  build: (target, _pool, random) =>
    buildDepartmentChoice(
      target,
      { exercise: departmentToPrefecture.id, prompt: departmentOf(target.content).name, label: (d) => d.prefecture },
      random,
    ),
};

const departmentToPrefectureTyped: Exercise<GeographyContent> = {
  ...PREFECTURE,
  id: "geography.department-to-prefecture-typed",
  mode: "typed",
  follows: departmentToPrefecture.id,
  label: "La préfecture, tapée",
  instruction: "Tape sa préfecture",
  build: (target) => {
    const department = departmentOf(target.content);
    return typedQuestion(target, departmentToPrefectureTyped.id, {
      prompt: department.name,
      input: "text",
      expected: department.prefecture,
      grade: (answer) => gradeTypedText(answer, department.prefecture, otherPrefectures(department)),
    });
  },
};

const prefectureToDepartment: Exercise<GeographyContent> = {
  ...PREFECTURE,
  id: "geography.prefecture-to-department",
  mode: "choice",
  label: "Le département de la préfecture",
  instruction: "De quel département est-ce la préfecture ?",
  build: (target, _pool, random) =>
    buildDepartmentChoice(
      target,
      { exercise: prefectureToDepartment.id, prompt: departmentOf(target.content).prefecture, label: (d) => d.name },
      random,
    ),
};

const prefectureToDepartmentTyped: Exercise<GeographyContent> = {
  ...PREFECTURE,
  id: "geography.prefecture-to-department-typed",
  mode: "typed",
  follows: prefectureToDepartment.id,
  label: "Le département de la préfecture, tapé",
  instruction: "Tape le département dont c’est la préfecture",
  build: (target) => {
    const department = departmentOf(target.content);
    return typedQuestion(target, prefectureToDepartmentTyped.id, {
      prompt: department.prefecture,
      input: "text",
      expected: department.name,
      grade: (answer) => gradeTypedText(answer, department.name, otherNames(department)),
    });
  },
};

const mapToRiver: Exercise<GeographyContent> = {
  ...RIVER,
  id: "geography.map-to-river",
  mode: "choice",
  label: "Sur la carte",
  instruction: "Quel est ce cours d’eau ?",
  build: (target, _pool, random) => buildRiverChoice(target, mapToRiver.id, random),
};

const mapToRiverTyped: Exercise<GeographyContent> = {
  ...RIVER,
  id: "geography.map-to-river-typed",
  mode: "typed",
  follows: mapToRiver.id,
  label: "Sur la carte, tapé",
  instruction: "Tape le nom de ce cours d’eau",
  build: (target) => {
    const river = riverOf(target.content);
    const others = RIVERS.filter((candidate) => candidate.id !== river.id).map((candidate) => candidate.name);
    return typedQuestion(target, mapToRiverTyped.id, {
      prompt: "",
      map: { highlight: river.id, layer: "rivers" },
      input: "text",
      expected: river.name,
      grade: (answer) => gradeTypedText(withoutArticle(answer), river.name, others),
    });
  },
};

const riverOnMap: Exercise<GeographyContent> = {
  ...RIVER,
  id: "geography.river-on-map",
  mode: "map",
  label: "Le placer",
  instruction: "Touche ce cours d’eau sur la carte",
  build: (target): LocateQuestion => {
    const river = riverOf(target.content);
    return {
      type: "locate",
      itemId: target.id,
      exercise: riverOnMap.id,
      prompt: riverWithArticle(river),
      map: { layer: "rivers" },
      target: river.id,
    };
  },
};

/* ---------- Catégorie ---------- */

export function validateGeographyContent(raw: unknown): GeographyContent {
  const record = expectRecord(raw);
  if (record.type === "river") {
    const id = expectText(record, "id");
    if (!findRiver(id)) throw new InvalidContentError(`Cours d’eau inconnu : ${id}`);
    return { type: "river", id };
  }
  if (record.type !== "department") throw new InvalidContentError("Type de lieu inconnu.");
  const code = expectText(record, "code");
  if (!findDepartment(code)) throw new InvalidContentError(`Département inconnu : ${code}`);
  return { type: "department", code };
}

export const geographyModel: CategoryModel<GeographyContent, GeographyDraft> = {
  kind: "geography",
  label: "Géographie",
  unit: { singular: "lieu", plural: "lieux", masculine: true },
  // Catégorie intégrée : pas d'ajout (voir `builtIn`), ces libellés ne sont pas affichés.
  addLabel: "Des lieux",
  newItemTitle: "Lieux",
  addedMessage: (title) => title,
  color: "var(--geography)",
  softColor: "var(--geography-soft)",
  fillColor: "var(--geography-fill)",
  onFillColor: "var(--on-geography-fill)",
  searchPlaceholder: "Rechercher un département, un numéro, une préfecture…",
  listStyle: "definition",
  // Un département se révise sous trois angles ; un cours d'eau, sous un seul.
  tracks: [
    { ...GEOGRAPHY_TRACKS.map, unit: DEPARTMENT_UNIT },
    { ...GEOGRAPHY_TRACKS.number, unit: DEPARTMENT_UNIT },
    { ...GEOGRAPHY_TRACKS.prefecture, unit: DEPARTMENT_UNIT },
    { ...GEOGRAPHY_TRACKS.rivers, unit: RIVER_UNIT },
  ],
  // Les 101 départements et les cours d'eau sont disponibles d'office ; 10 nouvelles cartes
  // (lieu × volet) par jour dans la révision du jour, et autant par volet dans sa propre révision.
  builtIn: {
    entries: () => [
      ...DEPARTMENTS.map((department): GeographyContent => ({ type: "department", code: department.code })),
      ...RIVERS.map((river): GeographyContent => ({ type: "river", id: river.id })),
    ],
    key: (content) => `${content.type}:${placeId(content)}`,
    newPerDay: 10,
  },
  // Clé de tri : par numéro (la Corse, 2A et 2B, entre le 19 et le 21, comme à l'origine : 20),
  // puis les cours d'eau dans l'ordre du référentiel (les fleuves d'abord).
  referenceKey: (content) => {
    if (content.type === "river") return `r${String(RIVERS.findIndex((river) => river.id === content.id)).padStart(3, "0")}`;
    return /^2[AB]$/.test(content.code) ? `020${content.code[1]}` : content.code.padStart(3, "0");
  },

  validateContent: validateGeographyContent,
  title: placeName,
  subtitle: (content) => {
    if (content.type === "river") return describeRiver(riverOf(content));
    const department = departmentOf(content);
    return `${department.code} · ${department.prefecture}`;
  },
  searchTexts: (content) => {
    if (content.type === "river") return [riverOf(content).name];
    const department = departmentOf(content);
    return [department.name, department.code, department.prefecture, regionName(department.region)];
  },

  exercises: [
    departmentToNumber,
    departmentToNumberTyped,
    numberToDepartment,
    numberToDepartmentTyped,
    mapToDepartment,
    mapToDepartmentTyped,
    departmentOnMap,
    departmentToPrefecture,
    departmentToPrefectureTyped,
    prefectureToDepartment,
    prefectureToDepartmentTyped,
    mapToRiver,
    mapToRiverTyped,
    riverOnMap,
  ],
  // Les mauvaises réponses viennent du référentiel : une seule fiche suffit.
  canBuildQuestions: (items) => items.length > 0,

  emptyDraft: () => ({ type: "department", code: "01" }),
  draftFrom: (content) => content,
  validateDraft: () => ({}),
  contentFrom: (draft) => draft,
};
