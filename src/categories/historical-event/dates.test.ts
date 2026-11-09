import { describe, expect, it } from "vitest";
import {
  centuryOf,
  centuryStartYear,
  chronologicalKey,
  dateProblem,
  decadeOf,
  formatAge,
  formatDate,
  formatSpan,
  fromAstronomical,
  shiftYear,
  toAstronomical,
  toRoman,
  type HistoricalDate,
} from "./dates";

const year = (value: number, circa = false): HistoricalDate => ({ year: value, precision: "year", circa });

describe("numérotation astronomique", () => {
  it("convertit dans les deux sens, sans an 0", () => {
    expect(toAstronomical(-480)).toBe(-479);
    expect(toAstronomical(-1)).toBe(0);
    expect(toAstronomical(1)).toBe(1);
    expect(fromAstronomical(0)).toBe(-1);
    expect(fromAstronomical(-479)).toBe(-480);
  });

  it("décale une année en sautant l'an 0", () => {
    expect(shiftYear(-1, 1)).toBe(1);
    expect(shiftYear(1, -1)).toBe(-1);
    expect(shiftYear(-331, -2)).toBe(-333);
    expect(shiftYear(-2, 3)).toBe(2);
    for (let start = -20; start <= 20; start++) {
      if (start === 0) continue;
      for (let delta = -20; delta <= 20; delta++) expect(shiftYear(start, delta)).not.toBe(0);
    }
  });

  it("trie chronologiquement, de l'Antiquité à nos jours", () => {
    const dates = [year(1492), year(-490), { year: 1492, month: 10, day: 12, precision: "day", circa: false } as HistoricalDate, year(-1), year(1)];
    const sorted = [...dates].sort((a, b) => chronologicalKey(a) - chronologicalKey(b));
    expect(sorted.map((d) => d.year)).toEqual([-490, -1, 1, 1492, 1492]);
  });
});

describe("siècles et décennies", () => {
  it("passe du numéro de siècle à sa première année et inversement", () => {
    expect(centuryStartYear(5, false)).toBe(401);
    expect(centuryStartYear(5, true)).toBe(-500);
    expect(centuryStartYear(1, false)).toBe(1);
    expect(centuryOf(401)).toBe(5);
    expect(centuryOf(-500)).toBe(5);
    expect(centuryOf(1901)).toBe(20);
    expect(centuryOf(2000)).toBe(20);
  });

  it("calcule la décennie", () => {
    expect(decadeOf(1925)).toBe(1920);
    expect(decadeOf(-485)).toBe(-480);
  });

  it("écrit les chiffres romains", () => {
    expect([1, 4, 5, 9, 14, 19, 21].map(toRoman)).toEqual(["I", "IV", "V", "IX", "XIV", "XIX", "XXI"]);
  });
});

describe("formatDate", () => {
  it("met en forme chaque précision en français", () => {
    expect(formatDate(year(-331))).toBe("331 av. J.-C.");
    expect(formatDate(year(-480, true))).toBe("vers 480 av. J.-C.");
    expect(formatDate(year(476))).toBe("476 apr. J.-C.");
    expect(formatDate(year(1492))).toBe("1492");
    expect(formatDate({ year: 1492, month: 10, day: 12, precision: "day", circa: false })).toBe("12 octobre 1492");
    expect(formatDate({ year: 1789, month: 7, day: 1, precision: "day", circa: false })).toBe("1er juillet 1789");
    expect(formatDate({ year: 1789, month: 7, precision: "month", circa: false })).toBe("juillet 1789");
    expect(formatDate({ year: 1925, precision: "decade", circa: false })).toBe("années 1920");
    expect(formatDate({ year: -500, precision: "century", circa: false })).toBe("Ve siècle av. J.-C.");
    expect(formatDate({ year: 1, precision: "century", circa: false })).toBe("Ier siècle apr. J.-C.");
    expect(formatDate({ year: 1901, precision: "century", circa: false })).toBe("XXe siècle");
  });
});

describe("formatSpan", () => {
  it("met en forme une période en factorisant l'ère quand c'est possible", () => {
    expect(formatSpan(year(1337), year(1453))).toBe("1337 – 1453");
    expect(formatSpan(year(-490), year(-479))).toBe("490 – 479 av. J.-C.");
    expect(formatSpan(year(-27), year(14))).toBe("27 av. J.-C. – 14 apr. J.-C.");
    expect(formatSpan(year(-27))).toBe("27 av. J.-C.");
  });
});

describe("formatAge", () => {
  it("donne l'ancienneté en tenant compte de l'absence d'an 0", () => {
    expect(formatAge(year(-331), 2026)).toBe("il y a 2\u202f356 ans"); // espace fine insécable, comme le veut la typographie
    expect(formatAge(year(2025), 2026)).toBe("il y a 1 an");
    expect(formatAge(year(2026), 2026)).toBeUndefined();
  });
});

describe("dateProblem", () => {
  it("refuse l'an 0 et les jours ou mois impossibles", () => {
    expect(dateProblem(year(0))).toMatch(/an 0/);
    expect(dateProblem({ year: 1789, month: 13, precision: "month", circa: false })).toMatch(/mois/);
    expect(dateProblem({ year: 1789, month: 2, day: 30, precision: "day", circa: false })).toMatch(/jour/);
    expect(dateProblem({ year: 1789, month: 2, day: 29, precision: "day", circa: false })).toBeUndefined();
    expect(dateProblem(year(-480))).toBeUndefined();
  });
});
