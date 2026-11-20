import { CHOICE_COUNT, type ChoiceQuestion, type LocateQuestion, type MapDisplay, type TypedGrade, type TypedQuestion } from "../../domain/quiz";
import { shuffle, type Random } from "../../domain/random";
import { comparisonKey } from "../../domain/text";
import { gradeTypedText } from "../../domain/typing";
import type { Item } from "../../domain/types";
import { InvalidContentError, expectRecord, expectText, type CategoryModel, type Exercise, type Track } from "../model";
import { DEPARTMENTS, findDepartment, nearestDepartments, regionName, type Department } from "./referential";

/**
 * Catégorie « Géographie » : des lieux de France, tirés du référentiel embarqué et
 * tous disponibles d'office (catégorie intégrée, sans ajout). Pour l'instant les
 * départements ; les fleuves et les villes suivront, avec leur propre `type`.
 */

export interface DepartmentContent {
  type: "department";
  /** Numéro du département (« 15 », « 2A », « 971 »). */
  code: string;
}

export type GeographyContent = DepartmentContent;
/** Pas de formulaire : une fiche de géographie se choisit dans le référentiel. */
export type GeographyDraft = GeographyContent;

type GeographyItem = Item<GeographyContent>;

/** Département d'une fiche (le contenu a été validé : il existe). */
export function departmentOf(content: GeographyContent): Department {
  const department = findDepartment(content.code);
  if (!department) throw new InvalidContentError(`Département inconnu : ${content.code}`);
  return department;
}

const isDepartment = (item: GeographyItem) => item.content.type === "department";

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

/* ---------- Volets ---------- */

/**
 * Chaque département se révise sous trois angles, suivis séparément : savoir le
 * numéro du Cantal n'est pas savoir le placer. Chaque volet a sa révision.
 */
export const GEOGRAPHY_TRACKS = {
  map: { id: "map", label: "Départements sur la carte", shortLabel: "Carte", hint: "Les reconnaître et les placer" },
  number: { id: "number", label: "Numéros des départements", shortLabel: "Numéro", hint: "Du nom au numéro, et l’inverse" },
  prefecture: { id: "prefecture", label: "Préfectures", shortLabel: "Préfecture", hint: "D’un département à sa préfecture" },
} satisfies Record<string, Track>;

/* ---------- Exercices ---------- */

const DEPARTMENT_EXERCISE = { accepts: isDepartment, promptStyle: "headline" as const, choiceStyle: "short" as const };
const NUMBER = { ...DEPARTMENT_EXERCISE, track: GEOGRAPHY_TRACKS.number.id };
const MAP = { ...DEPARTMENT_EXERCISE, track: GEOGRAPHY_TRACKS.map.id };
const PREFECTURE = { ...DEPARTMENT_EXERCISE, track: GEOGRAPHY_TRACKS.prefecture.id };

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

/* ---------- Catégorie ---------- */

export function validateGeographyContent(raw: unknown): GeographyContent {
  const record = expectRecord(raw);
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
  tracks: [GEOGRAPHY_TRACKS.map, GEOGRAPHY_TRACKS.number, GEOGRAPHY_TRACKS.prefecture],
  // Les 101 départements sont disponibles d'office ; 10 nouvelles cartes (département × volet)
  // par jour dans la révision du jour, et autant par volet dans sa propre révision.
  builtIn: {
    entries: () => DEPARTMENTS.map((department) => ({ type: "department" as const, code: department.code })),
    key: (content) => `${content.type}:${content.code}`,
    newPerDay: 10,
  },
  // Clé de tri : la Corse (2A, 2B) entre le 19 et le 21, comme dans la numérotation d'origine (20).
  referenceKey: (content) => (/^2[AB]$/.test(content.code) ? `020${content.code[1]}` : content.code.padStart(3, "0")),

  validateContent: validateGeographyContent,
  title: (content) => departmentOf(content).name,
  subtitle: (content) => {
    const department = departmentOf(content);
    return `${department.code} · ${department.prefecture}`;
  },
  searchTexts: (content) => {
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
  ],
  // Les mauvaises réponses viennent du référentiel : une seule fiche suffit.
  canBuildQuestions: (items) => items.length > 0,

  emptyDraft: () => ({ type: "department", code: "01" }),
  draftFrom: (content) => content,
  validateDraft: () => ({}),
  contentFrom: (draft) => draft,
};
