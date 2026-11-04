import { describe, expect, it } from "vitest";
import { studyDayOf } from "./studyDay";

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
