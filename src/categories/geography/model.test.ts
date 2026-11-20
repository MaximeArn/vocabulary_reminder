import { describe, expect, it } from "vitest";
import { gradeResponse, type ChoiceQuestion, type LocateQuestion, type TypedQuestion } from "../../domain/quiz";
import { seededRandom } from "../../domain/random";
import { initialProgress } from "../../domain/srs";
import type { Item } from "../../domain/types";
import { chooseExercise, TYPING_FROM_BOX } from "../exercisePlan";
import { geographyModel, gradeTypedCode, type GeographyContent } from "./model";
import { DEPARTMENTS, nearestDepartments } from "./referential";

const item = (code: string): Item<GeographyContent> => ({
  id: `dep-${code}`,
  kind: "geography",
  content: { type: "department", code },
  createdAt: 0,
  updatedAt: 0,
});
const exercise = (id: string) => geographyModel.exercises.find((candidate) => candidate.id === id)!;

describe("référentiel des départements", () => {
  it("contient les 101 départements, numéros, noms et préfectures distincts", () => {
    expect(DEPARTMENTS).toHaveLength(101);
    for (const key of ["code", "name", "prefecture"] as const) {
      expect(new Set(DEPARTMENTS.map((department) => department[key])).size).toBe(101);
    }
    expect(DEPARTMENTS.find((department) => department.code === "15")).toMatchObject({ name: "Cantal", prefecture: "Aurillac" });
    expect(DEPARTMENTS.find((department) => department.code === "2A")).toMatchObject({ name: "Corse-du-Sud", prefecture: "Ajaccio" });
    expect(DEPARTMENTS.find((department) => department.code === "976")).toMatchObject({ name: "Mayotte", prefecture: "Mamoudzou" });
  });

  it("propose des voisins proches, l'outre-mer avec l'outre-mer", () => {
    expect(nearestDepartments("75", 3).map((department) => department.code).sort()).toEqual(["92", "93", "94"]);
    expect(nearestDepartments("971", 4).every((department) => department.code.startsWith("97"))).toBe(true);
  });
});

describe("questions sur les départements", () => {
  const choiceIds = geographyModel.exercises.filter((candidate) => candidate.mode === "choice").map((candidate) => candidate.id);

  it("proposent 4 choix distincts dont la bonne réponse, pour chaque département", () => {
    for (const department of DEPARTMENTS) {
      for (const id of choiceIds) {
        const question = exercise(id).build(item(department.code), [], seededRandom(department.code.length)) as ChoiceQuestion;
        expect(question.choices).toHaveLength(4);
        expect(new Set(question.choices.map((choice) => choice.label)).size).toBe(4);
        expect(question.choices.filter((choice) => choice.id === question.correctChoiceId)).toHaveLength(1);
        expect(question.correctChoiceId).toBe(department.code);
      }
    }
  });

  it("montrent le département sur la carte pour « Quel est ce département ? »", () => {
    const question = exercise("geography.map-to-department").build(item("15"), []) as ChoiceQuestion;
    expect(question.prompt).toBe("");
    expect(question.map).toEqual({ highlight: "15" });
  });

  it("corrigent le département touché sur la carte", () => {
    const question = exercise("geography.department-on-map").build(item("15"), []) as LocateQuestion;
    expect(question.prompt).toBe("Cantal");
    expect(gradeResponse(question, { type: "locate", zone: "15" }).correct).toBe(true);
    expect(gradeResponse(question, { type: "locate", zone: "48" }).correct).toBe(false);
  });

  it("acceptent un numéro tapé sans le zéro ni la majuscule", () => {
    expect(gradeTypedCode("01", "01")).toEqual({ correct: true, exact: true });
    expect(gradeTypedCode("1", "01")).toEqual({ correct: true, exact: false });
    expect(gradeTypedCode("2a", "2A")).toEqual({ correct: true, exact: true }); // la casse ne compte pas
    expect(gradeTypedCode("2B", "2A").correct).toBe(false);
  });

  it("acceptent un nom ou une préfecture tapés avec une petite faute, jamais un autre département", () => {
    const name = exercise("geography.number-to-department-typed").build(item("21"), []) as TypedQuestion;
    expect(name.grade("cote d or").correct).toBe(true);
    expect(name.grade("Côte-d’Armor").correct).toBe(false);
    const prefecture = exercise("geography.department-to-prefecture-typed").build(item("15"), []) as TypedQuestion;
    expect(prefecture.grade("aurilac")).toMatchObject({ correct: true, exact: false });
  });

  it("refusent un contenu inconnu", () => {
    expect(() => geographyModel.validateContent({ type: "department", code: "99" })).toThrow();
    expect(() => geographyModel.validateContent({ type: "river", code: "loire" })).toThrow();
    expect(geographyModel.validateContent({ type: "department", code: "2A" })).toEqual({ type: "department", code: "2A" });
  });
});

describe("choix de l'exercice (géographie)", () => {
  const card = (box: number, track: string) => ({ item: item("15"), track, progress: { ...initialProgress(0), box } });
  const never = () => 0.99;
  const choose = (box: number, track: string) =>
    [0, 1, 2, 3, 4].map((rotation) => chooseExercise(card(box, track), rotation, "mixed", never));

  it("carte : alterne question et toucher, puis fait taper le nom, le toucher restant le toucher", () => {
    expect(new Set(choose(1, "map"))).toEqual(new Set(["geography.map-to-department", "geography.department-on-map"]));
    expect(new Set(choose(TYPING_FROM_BOX, "map"))).toEqual(
      new Set(["geography.map-to-department-typed", "geography.department-on-map"]),
    );
  });

  it("chaque volet reste dans ses exercices", () => {
    expect(new Set(choose(1, "number"))).toEqual(new Set(["geography.department-to-number", "geography.number-to-department"]));
    expect(new Set(choose(TYPING_FROM_BOX, "prefecture"))).toEqual(
      new Set(["geography.department-to-prefecture-typed", "geography.prefecture-to-department-typed"]),
    );
  });

  it("chaque exercice appartient à un volet de la catégorie", () => {
    const tracks = new Set(geographyModel.tracks!.map((track) => track.id));
    expect(geographyModel.exercises.every((exercise) => exercise.track && tracks.has(exercise.track))).toBe(true);
  });
});

describe("tri par numéro", () => {
  it("range la Corse entre le 19 et le 21, l'outre-mer à la fin", () => {
    const key = (code: string) => geographyModel.referenceKey!({ type: "department", code });
    const collator = new Intl.Collator("fr", { numeric: true });
    const sorted = ["2B", "971", "21", "03", "2A", "19", "95"].sort((a, b) => collator.compare(key(a), key(b)));
    expect(sorted).toEqual(["03", "19", "2A", "2B", "21", "95", "971"]);
  });
});
