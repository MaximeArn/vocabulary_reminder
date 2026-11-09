import { describe, expect, it } from "vitest";
import { seededRandom } from "../../domain/random";
import type { Item } from "../../domain/types";
import type { HistoricalDate } from "./dates";
import {
  buildDateToEventQuestion,
  buildEventToDateQuestion,
  dateFromDraft,
  emptyDateDraft,
  historicalEventModel,
  type HistoricalEventContent,
} from "./model";

let nextId = 0;
const year = (value: number, extra: Partial<HistoricalDate> = {}): HistoricalDate => ({
  year: value,
  precision: "year",
  circa: false,
  ...extra,
});
const event = (name: string, start: HistoricalDate, end?: HistoricalDate): Item<HistoricalEventContent> => ({
  id: `e${nextId++}`,
  kind: "historical-event",
  content: { name, start, end, uncertain: false, people: [] },
  createdAt: 0,
  updatedAt: 0,
});

const marathon = event("Bataille de Marathon", year(-490));
const salamine = event("Bataille de Salamine", year(-480));
const platees = event("Bataille de Platées", year(-479));
const cheronee = event("Bataille de Chéronée", year(-338));
const gaugameles = event("Bataille de Gaugamèles", year(-331));
const bastille = event("Prise de la Bastille", year(1789, { precision: "day", month: 7, day: 14 }));
const centJans = event("Guerre de Cent Ans", year(1337), year(1453));
const greek = [marathon, salamine, platees, cheronee, gaugameles];
const all = [...greek, bastille, centJans];

const CURRENT_YEAR = 2026;

describe("retrouver la date d'un événement", () => {
  it("propose 4 dates distinctes dont la bonne, sans an 0 ni date future, sur de nombreux tirages", () => {
    const nearZero = event("Naissance supposée", year(-2));
    const recent = event("Événement récent", year(2024));
    for (const target of [...all, nearZero, recent]) {
      for (let seed = 1; seed <= 100; seed++) {
        const question = buildEventToDateQuestion(target, [...all, nearZero, recent], seededRandom(seed), CURRENT_YEAR)!;
        expect(question).not.toBeNull();
        const labels = question.choices.map((choice) => choice.label);
        expect(new Set(labels).size).toBe(4);
        expect(question.choices.filter((choice) => choice.id === question.correctChoiceId)).toHaveLength(1);
        for (const label of labels) {
          expect(label).not.toMatch(/(^|\D)0 /); // jamais « 0 av. J.-C. » ni « 0 apr. J.-C. »
          const yearMatch = label.match(/^(\d+)$/);
          if (yearMatch) expect(Number(yearMatch[1])).toBeLessThanOrEqual(CURRENT_YEAR);
        }
      }
    }
  });

  it("garde la même précision et la même forme pour toutes les propositions", () => {
    const question = buildEventToDateQuestion(gaugameles, greek, seededRandom(7), CURRENT_YEAR)!;
    expect(question.prompt).toBe("Bataille de Gaugamèles");
    expect(question.instruction).toBe("En quelle année ?");
    for (const choice of question.choices) expect(choice.label).toMatch(/^\d+ av\. J\.-C\.$/);
    expect(question.choices.find((choice) => choice.id === gaugameles.id)!.label).toBe("331 av. J.-C.");

    const dated = buildEventToDateQuestion(bastille, all, seededRandom(7), CURRENT_YEAR)!;
    expect(dated.instruction).toBe("À quelle date ?");
    for (const choice of dated.choices) expect(choice.label).toMatch(/^14 juillet \d{4}$/);

    const period = buildEventToDateQuestion(centJans, all, seededRandom(7), CURRENT_YEAR)!;
    expect(period.instruction).toBe("À quelle période ?");
    for (const choice of period.choices) expect(choice.label).toMatch(/^\d{4} – \d{4}$/);
  });

  it("utilise en priorité les écarts avec d'autres événements proches de la collection", () => {
    // Chéronée (338) est à 7 ans de Gaugamèles (331) : « 338 av. J.-C. » doit souvent apparaître.
    let seen = 0;
    for (let seed = 1; seed <= 50; seed++) {
      const question = buildEventToDateQuestion(gaugameles, greek, seededRandom(seed), CURRENT_YEAR)!;
      if (question.choices.some((choice) => choice.label === "338 av. J.-C.")) seen += 1;
    }
    expect(seen).toBe(50);
  });
});

describe("retrouver l'événement d'une date", () => {
  it("propose l'événement et 3 autres, les plus proches dans le temps", () => {
    for (let seed = 1; seed <= 50; seed++) {
      const question = buildDateToEventQuestion(marathon, all, seededRandom(seed))!;
      expect(question.prompt).toBe("490 av. J.-C.");
      const names = question.choices.map((choice) => choice.label);
      expect(names).toContain("Bataille de Marathon");
      expect(new Set(names).size).toBe(4);
      // Les guerres médiques et la Grèce antique passent avant 1789 et la guerre de Cent Ans.
      expect(names).not.toContain("Prise de la Bastille");
    }
  });

  it("n'utilise jamais un événement de même date (il serait correct lui aussi)", () => {
    const sameYear = event("Autre événement de 490", year(-490));
    for (let seed = 1; seed <= 50; seed++) {
      const question = buildDateToEventQuestion(marathon, [...all, sameYear], seededRandom(seed))!;
      expect(question.choices.map((choice) => choice.id)).not.toContain(sameYear.id);
    }
  });

  it("renvoie null s'il n'y a pas assez d'événements", () => {
    expect(buildDateToEventQuestion(marathon, greek.slice(0, 3))).toBeNull();
  });
});

describe("formulaire", () => {
  const draft = (overrides: Partial<ReturnType<typeof emptyDateDraft>>) => ({ ...emptyDateDraft(), ...overrides });

  it("convertit une année avant J.-C. en année négative", () => {
    expect(dateFromDraft(draft({ year: "480", era: "bc", circa: true }))).toEqual({ year: -480, precision: "year", circa: true });
  });

  it("convertit un siècle en sa première année", () => {
    expect(dateFromDraft(draft({ precision: "century", year: "5", era: "bc" }))).toEqual({ year: -500, precision: "century", circa: false });
  });

  it("refuse l'an 0, une date impossible ou incomplète", () => {
    expect(dateFromDraft(draft({ year: "0" }))).toMatch(/pas d’an 0/);
    expect(dateFromDraft(draft({ year: "" }))).toBe("Indique l’année.");
    expect(dateFromDraft(draft({ precision: "day", year: "1789", month: "2", day: "30" }))).toMatch(/jour/);
    expect(dateFromDraft(draft({ precision: "month", year: "1789" }))).toBe("Choisis le mois.");
  });

  it("exige un nom et une fin postérieure au début pour une période", () => {
    const base = historicalEventModel.emptyDraft();
    const errors = historicalEventModel.validateDraft({
      ...base,
      start: draft({ year: "1453" }),
      isPeriod: true,
      end: draft({ year: "1337" }),
    });
    expect(errors).toEqual({ name: "Indique l’événement.", end: "La fin doit être postérieure au début." });
  });

  it("produit un contenu propre, et le formulaire se relit à l'identique", () => {
    const content = historicalEventModel.contentFrom({
      ...historicalEventModel.emptyDraft(),
      name: " Bataille de Gaugamèles ",
      start: draft({ year: "331", era: "bc" }),
      people: "Alexandre le Grand, Darius III ,",
      description: "Victoire décisive d’Alexandre sur les Perses.",
    });
    expect(content).toEqual({
      name: "Bataille de Gaugamèles",
      start: { year: -331, precision: "year", circa: false },
      end: undefined,
      uncertain: false,
      description: "Victoire décisive d’Alexandre sur les Perses.",
      people: ["Alexandre le Grand", "Darius III"],
      source: undefined,
      notes: undefined,
    });
    expect(historicalEventModel.contentFrom(historicalEventModel.draftFrom(content))).toEqual(content);
  });
});

describe("validateContent", () => {
  it("accepte un événement valide et refuse une date impossible", () => {
    expect(historicalEventModel.validateContent(gaugameles.content).start.year).toBe(-331);
    expect(() => historicalEventModel.validateContent({ name: "x", start: { year: 0, precision: "year" } })).toThrow(/an 0/);
  });
});
