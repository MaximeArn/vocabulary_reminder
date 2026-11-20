// Vérifie la géographie dans le vrai Safari d'iOS (simulateur) : ajout de départements
// par région, fiche avec carte, et révision avec chaque type de question (carte comprise).
// Prérequis et usage : voir check-words.mjs. Le scénario efface les données de l'app.

import { readFileSync } from "node:fs";
import { IosSafari } from "./webdriver.mjs";
import { createStepper, openAddForm, screenshot, startDailyReview, startLocalSession } from "./helpers.mjs";

const appUrl = process.argv[2] ?? "http://localhost:4173/";
const safari = new IosSafari("http://localhost:4444");
const stepper = createStepper();
const step = (name, action) => stepper.step(name, action);
const text = () => safari.bodyText();

const { departments } = JSON.parse(
  readFileSync(new URL("../../src/categories/geography/data/departements.json", import.meta.url), "utf8"),
);
const byName = new Map(departments.map((d) => [d.name, d]));
const byCode = new Map(departments.map((d) => [d.code, d]));
const AURA = departments.filter((d) => d.region === "84");

/** Question affichée : consigne, énoncé, zone mise en évidence, type de réponse. */
function readQuestion() {
  return safari.script(`
    const card = document.querySelector("[role=dialog][aria-label=Révision]");
    return {
      instruction: card.querySelector("p").textContent,
      prompt: card.querySelector("h2")?.textContent ?? "",
      highlight: card.querySelector("path[class*=highlight]")?.getAttribute("data-code") ?? null,
      choices: [...card.querySelectorAll("[role=group][aria-label=Propositions] button")].map((b) => b.textContent),
      typed: !!card.querySelector("form input"),
      locate: card.innerText.includes("Pince la carte"),
    };`);
}

/** Bonne réponse attendue pour une question (hors carte à toucher). */
function expected(question) {
  const target = question.highlight ? byCode.get(question.highlight) : byName.get(question.prompt) ?? byCode.get(question.prompt);
  if (!target) throw new Error(`Question inattendue : ${JSON.stringify(question)}`);
  if (/numéro/i.test(question.instruction) && !/porte/.test(question.instruction)) return target.code;
  if (/préfecture/i.test(question.instruction)) return target.prefecture;
  return target.name;
}

try {
  await safari.start();

  await step("Ajout : les départements d'Auvergne-Rhône-Alpes, choisis par région", async () => {
    await startLocalSession(safari, appUrl, "#collection");
    await openAddForm(safari, "Des départements");
    await safari.waitForText("Tous les départements");
    await safari.clickButton("Auvergne-Rhône-Alpes");
    await safari.waitForText(`Ajouter (${AURA.length})`);
    screenshot("geo-1-ajout");
    await safari.clickButton(`Ajouter (${AURA.length})`);
    await safari.waitForText(`${AURA.length} départements ajoutés`);
  });

  await step("Collection : les départements, avec numéro et préfecture ; fiche avec carte, sans « Modifier »", async () => {
    await safari.open(`${appUrl}?t=${Date.now()}#collection`);
    // Une seule catégorie dans la collection : pas de sélecteur de catégorie.
    if ((await text()).includes("Vocabulaire")) throw new Error("Sélecteur de catégorie affiché pour une seule catégorie");
    await safari.waitForText("Cantal");
    await safari.waitForText("15 · Aurillac");
    await safari.script(`[...document.querySelectorAll("button, a")].find((b) => b.textContent.includes("Cantal")).click();`);
    await safari.waitForText("Préfecture");
    await safari.waitFor("carte de la fiche", async () => safari.script(`return !!document.querySelector("path[data-code='15'][class*=highlight]");`), 8000);
    if ((await text()).includes("Modifier")) throw new Error("« Modifier » proposé pour un département");
    screenshot("geo-2-fiche");
  });

  await step("Révision Géographie : chaque question trouve sa réponse, carte comprise", async () => {
    await safari.open(`${appUrl}?t=${Date.now()}#reviser`);
    await safari.waitForText(`${AURA.length} lieux à réviser`);
    await startDailyReview(safari);
    const seen = new Set();
    for (let index = 1; index <= 40; index++) {
      if ((await text()).includes("Encore une session")) break;
      await safari.waitFor("question", async () => safari.script(`return !!document.querySelector("[role=dialog][aria-label=Révision] p");`));
      // La carte se charge à la première question qui en a besoin.
      await safari.waitFor("carte chargée", async () =>
        safari.script(`const c = document.querySelector("[role=dialog][aria-label=Révision]"); return !c.querySelector("[aria-label*=chargement]");`),
      8000);
      const question = await readQuestion();
      if (question.locate) {
        seen.add("carte à toucher");
        const target = byName.get(question.prompt);
        if (!target) throw new Error(`Département inconnu : ${question.prompt}`);
        await safari.script(
          `document.querySelector("[role=dialog] path[data-code='" + arguments[0] + "']").dispatchEvent(new MouseEvent("click", { bubbles: true }));`,
          [target.code],
        );
        if (!seen.has("capture carte")) {
          seen.add("capture carte");
          screenshot("geo-3-toucher");
        }
        await safari.clickButton("Valider");
      } else if (question.typed) {
        seen.add("saisie");
        throw new Error("Saisie inattendue pour des départements nouveaux");
      } else {
        seen.add(question.highlight ? "carte à lire" : /préfecture/i.test(question.instruction) ? "préfecture" : "numéro / nom");
        const answer = expected(question);
        if (!question.choices.includes(answer)) throw new Error(`Bonne réponse « ${answer} » absente : ${JSON.stringify(question)}`);
        if (question.highlight && !seen.has("capture lire")) {
          seen.add("capture lire");
          screenshot("geo-4-lire");
        }
        await safari.script(
          `[...document.querySelectorAll("[role=group][aria-label=Propositions] button")].find((b) => b.textContent === arguments[0]).click();`,
          [answer],
        );
      }
      await safari.waitForText("Bonne réponse");
      await safari.clickButton((await text()).includes("Voir le bilan") ? "Voir le bilan" : "Continuer");
    }
    await safari.waitForText("Encore une session");
    for (const kind of ["carte à toucher", "carte à lire"]) {
      if (!seen.has(kind)) throw new Error(`Aucune question « ${kind} » (vu : ${[...seen].join(", ")})`);
    }
    screenshot("geo-5-bilan");
  });

  console.log(`\n${stepper.count} vérifications réussies.`);
} catch (error) {
  screenshot("echec");
  console.error(`\n✗ Échec après ${stepper.count} étape(s) : ${error.message}`);
  process.exitCode = 1;
} finally {
  await safari.stop().catch(() => {});
}
