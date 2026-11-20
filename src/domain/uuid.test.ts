import { describe, expect, it } from "vitest";
import { uuidV5 } from "./uuid";

describe("uuidV5", () => {
  it("suit la norme (exemple de référence : « www.example.com » dans l'espace DNS)", async () => {
    expect(await uuidV5("www.example.com", "6ba7b810-9dad-11d1-80b4-00c04fd430c8")).toBe("2ed6657d-e927-568b-95e1-2665a8aea6a2");
  });

  it("donne toujours le même identifiant pour le même nom, un autre pour un autre nom", async () => {
    const namespace = "6ba7b810-9dad-11d1-80b4-00c04fd430c8";
    expect(await uuidV5("a", namespace)).toBe(await uuidV5("a", namespace));
    expect(await uuidV5("a", namespace)).not.toBe(await uuidV5("b", namespace));
  });
});
