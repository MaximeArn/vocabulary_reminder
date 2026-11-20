import { CHOICE_COUNT, type ChoiceQuestion, type LocateQuestion, type MapDisplay, type TypedGrade, type TypedQuestion } from "../../domain/quiz";
import { shuffle, type Random } from "../../domain/random";
import { comparisonKey } from "../../domain/text";
import { gradeTypedText } from "../../domain/typing";
import type { Item } from "../../domain/types";
import { InvalidContentError, expectRecord, expectText, type CategoryModel, type Exercise } from "../model";
import { DEPARTMENTS, findDepartment, nearestDepartments, regionName, type Department } from "./referential";

/**
 * Catégorie « Géographie » : des lieux de France, tirés du référentiel embarqué.
 * Pour l'instant les départements ; les fleuves et les villes suivront, avec leur
 * propre `type` dans le contenu.
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

/* ---------- Exercices ---------- */

const DEPARTMENT_EXERCISE = { accepts: isDepartment, promptStyle: "headline" as const, choiceStyle: "short" as const };

const departmentToNumber: Exercise<GeographyContent> = {
  ...DEPARTMENT_EXERCISE,
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
  ...DEPARTMENT_EXERCISE,
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
  ...DEPARTMENT_EXERCISE,
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
  ...DEPARTMENT_EXERCISE,
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
  ...DEPARTMENT_EXERCISE,
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
  ...DEPARTMENT_EXERCISE,
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
  ...DEPARTMENT_EXERCISE,
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
  ...DEPARTMENT_EXERCISE,
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
  ...DEPARTMENT_EXERCISE,
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
  addLabel: "Des départements",
  newItemTitle: "Départements",
  addedMessage: (title) => `${title} ajouté à ta collection`,
  color: "var(--geography)",
  softColor: "var(--geography-soft)",
  fillColor: "var(--geography-fill)",
  onFillColor: "var(--on-geography-fill)",
  searchPlaceholder: "Rechercher un département, un numéro, une préfecture…",
  listStyle: "definition",
  editable: false,

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
  ],
  // Les mauvaises réponses viennent du référentiel : une seule fiche suffit.
  canBuildQuestions: (items) => items.length > 0,

  emptyDraft: () => ({ type: "department", code: "01" }),
  draftFrom: (content) => content,
  validateDraft: () => ({}),
  contentFrom: (draft) => draft,
};
