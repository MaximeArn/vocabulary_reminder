import { describe, expect, it } from "vitest";
import { cleanOptionalText, cleanText, comparisonKey, stripSurroundingQuotes } from "./text";

describe("cleanText", () => {
  it("retire les espaces superflus et remplace l'apostrophe droite", () => {
    expect(cleanText("  l'action   de  prédire ")).toBe("l’action de prédire");
  });

  it("conserve les retours à la ligne utiles", () => {
    expect(cleanText("Ligne 1 \n\n\n\n  Ligne 2")).toBe("Ligne 1\n\nLigne 2");
  });
});

describe("cleanOptionalText", () => {
  it("renvoie undefined pour un champ vide ou blanc", () => {
    expect(cleanOptionalText("   ")).toBeUndefined();
    expect(cleanOptionalText(undefined)).toBeUndefined();
  });
});

describe("comparisonKey", () => {
  it("ignore la casse, les accents et les espaces", () => {
    expect(comparisonKey("  Résipiscence ")).toBe("resipiscence");
    expect(comparisonKey("Irréfragable")).toBe(comparisonKey("irrefragable"));
  });

  it("traite de la même façon les deux apostrophes", () => {
    expect(comparisonKey("aujourd’hui")).toBe(comparisonKey("aujourd'hui"));
  });
});

describe("stripSurroundingQuotes", () => {
  it("retire les guillemets français ou droits qui entourent le texte", () => {
    expect(stripSurroundingQuotes("« Une présence inane »")).toBe("Une présence inane");
    expect(stripSurroundingQuotes('"Avec alacrité"')).toBe("Avec alacrité");
  });

  it("laisse intact un texte qui contient des guillemets en son milieu", () => {
    expect(stripSurroundingQuotes("Il dit « bile noire » ici")).toBe("Il dit « bile noire » ici");
  });
});
