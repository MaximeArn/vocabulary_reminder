// Vérifie la géographie dans le vrai Safari d'iOS (simulateur) : départements disponibles
// d'office, fiche avec carte et progression par volet, révision du jour (10 nouvelles cartes
// par jour), puis la révision de chaque volet (carte, préfectures) avec ses seules questions.
// Prérequis et usage : voir check-words.mjs. Le scénario efface les données de l'app.

import { readFileSync } from "node:fs";
import { IosSafari } from "./webdriver.mjs";
import { createStepper, screenshot, startDailyReview, startLocalSession } from "./helpers.mjs";

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
const byPrefecture = new Map(departments.map((d) => [d.prefecture, d]));

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
  const fromPrefecture = /De quel département/.test(question.instruction);
  const target = question.highlight
    ? byCode.get(question.highlight)
    : fromPrefecture
      ? byPrefecture.get(question.prompt)
      : byName.get(question.prompt) ?? byCode.get(question.prompt);
  if (!target) throw new Error(`Question inattendue : ${JSON.stringify(question)}`);
  if (/numéro/i.test(question.instruction) && !/porte/.test(question.instruction)) return target.code;
  if (fromPrefecture) return target.name;
  if (/préfecture/i.test(question.instruction)) return target.prefecture;
  return target.name;
}

/** Type d'une question, d'après sa consigne. */
const kindOf = (question) =>
  question.locate ? "carte à toucher" : question.highlight ? "carte à lire" : /préfecture/i.test(question.instruction) ? "préfecture" : "numéro / nom";

/** Répond juste à la question affichée ; renvoie son type. */
async function answerCorrectly(seen) {
  await safari.waitFor("question", async () => safari.script(`return !!document.querySelector("[role=dialog][aria-label=Révision] p");`));
  // La carte se charge à la première question qui en a besoin.
  await safari.waitFor(
    "carte chargée",
    async () =>
      safari.script(`const c = document.querySelector("[role=dialog][aria-label=Révision]"); return !c.querySelector("[aria-label*=chargement]");`),
    8000,
  );
  const question = await readQuestion();
  seen.add(kindOf(question));
  if (question.locate) {
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
    throw new Error("Saisie inattendue pour des départements nouveaux");
  } else {
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
  return question;
}

try {
  await safari.start();

  await step("Les 101 départements sont là d'office, sans rien ajouter, rangés par numéro", async () => {
    await startLocalSession(safari, appUrl, "#collection");
    await safari.waitFor("départements créés", async () => /101 lieux/i.test(await text()), 8000);
    const titles = await safari.script(`return [...document.querySelectorAll("main li")].slice(0, 2).map((li) => li.innerText.replace(/\\s+/g, " "));`);
    if (!titles[0]?.includes("Ain") || !titles[1]?.includes("Aisne")) throw new Error(`Ordre inattendu : ${titles}`);
    // Une seule catégorie dans la collection : pas de sélecteur de catégorie.
    if ((await text()).includes("Vocabulaire")) throw new Error("Sélecteur de catégorie affiché pour une seule catégorie");
    await safari.clickButton("Ajouter une fiche");
    await safari.waitForText("Ajouter à ta collection");
    if ((await text()).includes("Des lieux")) throw new Error("La géographie est proposée à l'ajout");
    await safari.clickButton("Annuler");
    screenshot("geo-1-collection");
  });

  await step("Fiche d'un département : carte, progression de chaque volet, sans « Modifier » ni « Supprimer »", async () => {
    await safari.script(`[...document.querySelectorAll("button, a")].find((b) => b.textContent.includes("Cantal")).click();`);
    await safari.waitForText("Préfecture");
    await safari.waitFor("carte de la fiche", async () => safari.script(`return !!document.querySelector("path[data-code='15'][class*=highlight]");`), 8000);
    const page = await text();
    if (page.includes("Modifier") || page.includes("Supprimer")) throw new Error("Modifier ou Supprimer proposé pour un département");
    const tracks = await safari.script(`return [...document.querySelectorAll("dl[class*=tracks] dt")].map((dt) => dt.textContent);`);
    if (tracks.join(",") !== "Carte,Numéro,Préfecture") throw new Error(`Volets inattendus : ${tracks}`);
    screenshot("geo-2-fiche");
  });

  await step("Réviser : la révision du jour et une révision par volet, sans entraînements", async () => {
    await safari.open(`${appUrl}?t=${Date.now()}#reviser`);
    await safari.waitForText("10 fiches à réviser");
    const page = await text();
    for (const row of ["Départements sur la carte", "Numéros des départements", "Préfectures"]) {
      if (!page.includes(row)) throw new Error(`Révision « ${row} » absente`);
    }
    for (const row of ["Oubliées", "Nouveautés", "En vrac", "Par région"]) {
      if (page.includes(row)) throw new Error(`« ${row} » proposé pour la géographie`);
    }
    screenshot("geo-0-reviser");
  });

  await step("Révision du jour : 10 nouvelles cartes, puis la suite demain", async () => {
    const seen = new Set();
    // Des sessions jusqu'à épuiser les 10 du jour (une session compte 5 questions par défaut).
    for (let session = 1; session <= 4 && !(await text()).includes("Tout est révisé"); session++) {
      await startDailyReview(safari);
      for (let index = 1; index <= 30; index++) {
        if ((await text()).includes("Encore une session")) break;
        await answerCorrectly(seen);
        await safari.clickButton((await text()).includes("Voir le bilan") ? "Voir le bilan" : "Continuer");
      }
      await safari.waitForText("Encore une session");
      if (session === 1) screenshot("geo-5-bilan");
      await safari.clickButton("Terminer");
      await safari.waitFor("retour à Réviser", async () => (await text()).includes("Révision du jour"));
    }
    await safari.waitForText("Tout est révisé · suite demain");
    if (!(await text()).includes("10 réponses aujourd’hui")) throw new Error("Pas 10 réponses aujourd’hui");
  });

  // Une session de 5 questions alterne les exercices du volet : sur la carte, les deux sens sont vus.
  for (const [row, kinds] of [
    ["Départements sur la carte", ["carte à lire", "carte à toucher"]],
    ["Préfectures", ["préfecture"]],
  ]) {
    await step(`« ${row} » : uniquement des questions de ce volet`, async () => {
      await safari.clickButton(row);
      const seen = new Set();
      for (let index = 1; index <= 5; index++) {
        const question = await answerCorrectly(seen);
        if (!kinds.includes(kindOf(question))) throw new Error(`Question hors du volet : ${JSON.stringify(question)}`);
        await safari.clickButton(index === 5 ? "Voir le bilan" : "Continuer");
      }
      for (const kind of kinds) if (!seen.has(kind)) throw new Error(`Aucune question « ${kind} » (vu : ${[...seen].join(", ")})`);
      await safari.waitForText("Encore une session");
      if (row === "Préfectures") screenshot("geo-6-bilan-volet");
      await safari.clickButton("Terminer");
      await safari.waitForText("Révision du jour");
    });
  }

  console.log(`\n${stepper.count} vérifications réussies.`);
} catch (error) {
  screenshot("echec");
  console.error(`\n✗ Échec après ${stepper.count} étape(s) : ${error.message}`);
  process.exitCode = 1;
} finally {
  await safari.stop().catch(() => {});
}
