import { describe, expect, it } from "vitest";
import type { Item } from "../domain/types";
import { planBuiltInItems } from "./builtIn";
import { geographyModel } from "./geography/model";

const idFor = (key: string) => `id:${key}`;
const item = (id: string, code: string, extra: Partial<Item> = {}): Item => ({
  id,
  kind: "geography",
  content: { type: "department", code },
  createdAt: 0,
  updatedAt: 0,
  ...extra,
});

describe("fiches intégrées (départements)", () => {
  it("crée les 101 départements, avec un identifiant déterministe", () => {
    const plan = planBuiltInItems(geographyModel, [], new Set(), idFor);
    expect(plan.create).toHaveLength(101);
    expect(plan.create.find((entry) => entry.id === "id:department:15")?.content).toEqual({ type: "department", code: "15" });
    expect(plan.restore).toEqual([]);
    expect(plan.remove).toEqual([]);
  });

  it("ne fait rien quand tout est là, et garde une fiche ajoutée à la main (avec son historique)", () => {
    const existing = geographyModel.builtIn!.entries().map((content) => item(idFor(geographyModel.builtIn!.key(content)), content.code));
    existing[0] = item("ajoutee-a-la-main", (existing[0]!.content as { code: string }).code);
    const plan = planBuiltInItems(geographyModel, existing, new Set(["ajoutee-a-la-main"]), idFor);
    expect(plan).toEqual({ create: [], restore: [], remove: [] });
  });

  it("rétablit une fiche supprimée plutôt que d'en créer une autre", () => {
    const plan = planBuiltInItems(geographyModel, [item("ancienne", "15", { deletedAt: 5 })], new Set(["ancienne"]), idFor);
    expect(plan.restore).toEqual(["ancienne"]);
    expect(plan.create.some((entry) => entry.content && (entry.content as { code: string }).code === "15")).toBe(false);
  });

  it("retire un doublon sans historique, garde celui qui en a un", () => {
    const plan = planBuiltInItems(
      geographyModel,
      [item("id:department:15", "15"), item("ajoutee-a-la-main", "15")],
      new Set(["ajoutee-a-la-main"]),
      idFor,
    );
    expect(plan.remove).toEqual(["id:department:15"]);
  });
});
