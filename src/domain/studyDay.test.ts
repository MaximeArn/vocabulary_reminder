import { describe, expect, it } from "vitest";
import { addDays, lastDays, studyDayOf } from "./studyDay";

describe("studyDayOf", () => {
  it("renvoie le jour local au format AAAA-MM-JJ", () => {
    expect(studyDayOf(new Date(2026, 10, 4, 15, 30))).toBe("2026-11-04");
  });

  it("rattache une révision nocturne (avant 4 h) à la veille", () => {
    expect(studyDayOf(new Date(2026, 10, 5, 1, 0))).toBe("2026-11-04");
    expect(studyDayOf(new Date(2026, 10, 5, 4, 0))).toBe("2026-11-05");
  });

  it("gère les changements de mois et d'année", () => {
    expect(studyDayOf(new Date(2027, 0, 1, 2, 0))).toBe("2026-12-31");
  });
});

describe("addDays", () => {
  it("avance et recule d'un nombre de jours", () => {
    expect(addDays("2026-11-04", 1)).toBe("2026-11-05");
    expect(addDays("2026-11-04", 30)).toBe("2026-12-04");
    expect(addDays("2026-01-01", -1)).toBe("2025-12-31");
  });

  it("traverse le changement d'heure sans sauter de jour", () => {
    expect(addDays("2026-03-28", 1)).toBe("2026-03-29");
    expect(addDays("2026-03-29", 1)).toBe("2026-03-30");
    expect(addDays("2026-10-24", 2)).toBe("2026-10-26");
  });
});

describe("lastDays", () => {
  it("liste les jours jusqu'à aujourd'hui inclus", () => {
    expect(lastDays("2026-11-04", 3)).toEqual(["2026-11-02", "2026-11-03", "2026-11-04"]);
  });
});
