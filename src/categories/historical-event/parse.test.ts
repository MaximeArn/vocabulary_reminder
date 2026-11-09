import { describe, expect, it } from "vitest";
import { formatSpan } from "./dates";
import { parseDateText } from "./parse";

/** Relit le texte puis le remet en forme : l'aller-retour doit être fidèle. */
const roundTrip = (text: string) => {
  const parsed = parseDateText(text);
  return parsed ? formatSpan(parsed.start, parsed.end) : null;
};

describe("parseDateText", () => {
  it("lit les années, avant et après J.-C.", () => {
    expect(roundTrip("331 av. J.-C.")).toBe("331 av. J.-C.");
    expect(roundTrip("356 av. J.-C.")).toBe("356 av. J.-C.");
    expect(roundTrip("-331")).toBe("331 av. J.-C.");
    expect(roundTrip("476")).toBe("476 apr. J.-C.");
    expect(roundTrip("1789")).toBe("1789");
    expect(roundTrip("14 apr. J.-C.")).toBe("14 apr. J.-C.");
    expect(roundTrip("480 avant Jésus-Christ")).toBe("480 av. J.-C.");
  });

  it("lit les dates approximatives, précises au jour ou au mois", () => {
    expect(roundTrip("vers 480 av. J.-C.")).toBe("vers 480 av. J.-C.");
    expect(roundTrip("14 juillet 1789")).toBe("14 juillet 1789");
    expect(roundTrip("1er janvier 1500")).toBe("1er janvier 1500");
    expect(roundTrip("juillet 1789")).toBe("juillet 1789");
  });

  it("lit les siècles et les décennies", () => {
    expect(roundTrip("Ve siècle av. J.-C.")).toBe("Ve siècle av. J.-C.");
    expect(roundTrip("XXe siècle")).toBe("XXe siècle");
    expect(roundTrip("5e siècle")).toBe("Ve siècle apr. J.-C.");
    expect(roundTrip("années 1920")).toBe("années 1920");
  });

  it("lit les périodes, en propageant l'ère quand elle n'est écrite qu'à la fin", () => {
    expect(roundTrip("1337-1453")).toBe("1337 – 1453");
    expect(roundTrip("1337 – 1453")).toBe("1337 – 1453");
    expect(roundTrip("490 – 479 av. J.-C.")).toBe("490 – 479 av. J.-C.");
    expect(roundTrip("27 av. J.-C. – 14 apr. J.-C.")).toBe("27 av. J.-C. – 14 apr. J.-C.");
  });

  it("refuse ce qui n'est pas une date valide", () => {
    for (const text of ["alacrité", "0", "30 février 1789", "brumaire 1799", "", "Bataille de Marathon"]) {
      expect(parseDateText(text)).toBeNull();
    }
  });
});
