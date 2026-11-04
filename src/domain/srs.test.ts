import { describe, expect, it } from "vitest";
import { MASTERED_BOX, masteryLevel, nextSchedule } from "./srs";

const today = "2026-11-04";

describe("nextSchedule", () => {
  it("fait monter un mot dû d'une boîte et espace sa révision", () => {
    expect(nextSchedule({ box: 0, dueDay: today, lapses: 0 }, true, today)).toEqual({
      box: 1,
      dueDay: "2026-11-05",
      lapses: 0,
    });
    expect(nextSchedule({ box: 3, dueDay: "2026-11-01", lapses: 1 }, true, today)).toEqual({
      box: 4,
      dueDay: "2026-11-19",
      lapses: 1,
    });
  });

  it("plafonne à la dernière boîte (90 jours)", () => {
    expect(nextSchedule({ box: 6, dueDay: today, lapses: 0 }, true, today)).toEqual({
      box: 6,
      dueDay: "2027-02-02",
      lapses: 0,
    });
  });

  it("renvoie un mot oublié en boîte 1, pour le lendemain", () => {
    expect(nextSchedule({ box: 5, dueDay: today, lapses: 2 }, false, today)).toEqual({
      box: 1,
      dueDay: "2026-11-05",
      lapses: 3,
    });
  });

  it("ne fait pas monter un mot révisé en avance, mais compte une erreur", () => {
    const early = { box: 3, dueDay: "2026-11-10", lapses: 0 };
    expect(nextSchedule(early, true, today)).toEqual(early);
    expect(nextSchedule(early, false, today).box).toBe(1);
  });
});

describe("masteryLevel", () => {
  it("regroupe les boîtes en niveaux", () => {
    expect([0, 1, 2, 3, 4, MASTERED_BOX, 6].map(masteryLevel)).toEqual([
      "new",
      "learning",
      "learning",
      "progressing",
      "progressing",
      "mastered",
      "mastered",
    ]);
  });
});
