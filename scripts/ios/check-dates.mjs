// Vérifie les dates historiques (saisie, fiche, filtre, révision) dans le vrai Safari d'iOS (simulateur).
// Prérequis et usage : voir check-words.mjs. Le scénario efface les données de l'app.

import { IosSafari } from "./webdriver.mjs";
import {
  chooseBackupFile,
  chooseSegment,
  createStepper,
  fieldByLabel,
  openAddForm,
  pause,
  startLocalSession,
  screenshot,
  startDailyReview
} from "./helpers.mjs";

const appUrl = process.argv[2] ?? "http://localhost:4173/";
const safari = new IosSafari("http://localhost:4444");
const stepper = createStepper();
const step = (name, action) => stepper.step(name, action);

/** Événements attendus, avec le libellé de date que l'app doit afficher. */
const EVENTS = {
  "Bataille de Marathon": "490 av. J.-C.",
  "Bataille de Salamine": "480 av. J.-C.",
  "Bataille de Platées": "479 av. J.-C.",
  "Bataille de Chéronée": "338 av. J.-C.",
  "Prise de la Bastille": "14 juillet 1789",
  "Bataille de Gaugamèles": "331 av. J.-C.",
  "Guerre de Cent Ans": "1337 – 1453",
  "Construction du Parthénon": "vers Ve siècle av. J.-C.",
  "Massacre de la Saint-Barthélemy": "1572",
  "Édit de Nantes et fin des guerres de Religion": "1598",
};
const nameOfDate = Object.fromEntries(Object.entries(EVENTS).map(([name, date]) => [date, name]));
/** Position dans le temps (début), pour répondre aux questions « Remets dans l’ordre ». */
const WHEN = {
  "Bataille de Marathon": -490,
  "Bataille de Salamine": -480,
  "Bataille de Platées": -479,
  "Bataille de Chéronée": -338,
  "Prise de la Bastille": 1789.5,
  "Bataille de Gaugamèles": -331,
  "Guerre de Cent Ans": 1337,
  "Construction du Parthénon": -450,
  "Massacre de la Saint-Barthélemy": 1572,
  "Édit de Nantes et fin des guerres de Religion": 1598,
};

const event = (id, name, start, extra = {}) => ({
  id,
  kind: "historical-event",
  content: { name, start: { precision: "year", circa: false, ...start }, uncertain: false, people: [], description: `Contexte de ${name}.`, ...extra },
  createdAt: 1000,
  updatedAt: 1000,
});
const word = (id, term) => ({ id, kind: "vocabulary", content: { term, definition: `Définition de ${term}.` }, createdAt: 1000, updatedAt: 1000 });
const backup = JSON.stringify({
  app: "lexique",
  schemaVersion: 2,
  exportedAt: new Date().toISOString(),
  items: [
    event("e1", "Bataille de Marathon", { year: -490 }),
    event("e2", "Bataille de Salamine", { year: -480 }),
    event("e3", "Bataille de Platées", { year: -479 }),
    event("e4", "Bataille de Chéronée", { year: -338 }),
    event("e5", "Prise de la Bastille", { year: 1789, month: 7, day: 14, precision: "day" }),
    word("w1", "dextre"),
    word("w2", "senestre"),
    word("w3", "fruste"),
    word("w4", "inane"),
  ],
  reviews: [],
  settings: [],
});

const text = async () => (await safari.bodyText()).replace(/\s+/g, " ");

async function readQuestion() {
  return safari.script(`
    const card = document.querySelector("[role=dialog][aria-label=Révision]");
    return {
      instruction: card.querySelector("p").textContent,
      prompt: card.querySelector("h2").textContent,
      choices: [...card.querySelectorAll("[role=group] button")].map((b) => b.textContent),
    };`);
}

/**
 * Question « Remets dans l’ordre » (glissée de temps en temps dans la session) :
 * touche les événements dans l'ordre chronologique et vérifie le verdict.
 * Renvoie `false` si ce n'est pas une question de classement.
 */
async function answerOrder(question) {
  if (question.instruction !== "Remets dans l’ordre") return false;
  const names = await safari.script(
    `return [...document.querySelectorAll("[aria-label='Événements à classer'] button")].map((b) => b.getAttribute("aria-label"));`,
  );
  if (names.length !== 4 || names.some((name) => WHEN[name] === undefined)) throw new Error(`Classement inattendu : ${names}`);
  const sorted = [...names].sort((a, b) => WHEN[a] - WHEN[b]);
  for (const name of sorted.slice(0, 3)) {
    await safari.script(
      `[...document.querySelectorAll("[aria-label='Événements à classer'] button")].find((b) => b.getAttribute("aria-label") === arguments[0]).click();`,
      [name],
    );
  }
  await safari.clickButton("Valider");
  await safari.waitForText("Bon ordre");
  return true;
}

async function chooseAnswer(label) {
  await safari.script(
    `[...document.querySelectorAll("[role=group] button")].find((b) => b.textContent === arguments[0]).click();`,
    [label],
  );
}

async function clickToggle(label) {
  await safari.script(
    `[...document.querySelectorAll("[role=switch]")].find((b) => b.textContent.startsWith(arguments[0])).click();`,
    [label],
  );
}

try {
  const capabilities = await safari.start();
  console.log(`Safari ${capabilities.browserVersion} sur ${capabilities["safari:deviceName"]} (iOS ${capabilities["safari:platformVersion"]})\n`);

  await step("Collection de départ : 5 dates et 4 mots restaurés (format v2)", async () => {
    await startLocalSession(safari, appUrl, "#reglages");
    await safari.waitForText("SAUVEGARDE");
    await chooseBackupFile(safari, backup);
    await safari.waitForText("9 fiches restaurées");
  });

  await step("Formulaire de date : erreurs claires si incomplet", async () => {
    await safari.open(`${appUrl}?t=${Date.now()}#collection`);
    await safari.waitForText("4 MOTS"); // la collection s'ouvre sur la première catégorie
    await openAddForm(safari, "Une date historique");
    await safari.waitForText("Nouvelle date");
    await safari.clickButton("Ajouter");
    await safari.waitForText("Indique l’événement.");
    await safari.waitForText("Indique l’année.");
  });

  await step("Ajout d’une date av. J.-C. avec contexte et personnages", async () => {
    await safari.type(await fieldByLabel(safari, "Événement"), "Bataille de Gaugamèles");
    await safari.type(await safari.find('[aria-label="Année — Date"]'), "331");
    await chooseSegment(safari, "Ère — Date", "av. J.-C.");
    await safari.type(await fieldByLabel(safari, "Contexte"), "Victoire décisive d’Alexandre sur l’empire perse.");
    await safari.type(await fieldByLabel(safari, "Personnages"), "Alexandre le Grand, Darius III");
    await safari.type(await fieldByLabel(safari, "Source"), "Arrien, Anabase");
    screenshot("dates-1-formulaire");
    await safari.clickButton("Ajouter");
    await safari.waitForText("Date ajoutée : « Bataille de Gaugamèles »");
    await chooseSegment(safari, "Catégorie", "Dates");
    await safari.waitForText("6 DATES");
  });

  await step("Fiche : date, ancienneté, contexte, personnages, source", async () => {
    await safari.script(`[...document.querySelectorAll("li button")].find((b) => b.textContent.includes("Bataille de Gaugamèles")).click();`);
    await safari.waitForText("Personnages");
    const detail = await text();
    for (const expected of ["331 av. J.-C.", "Victoire décisive", "Alexandre le Grand, Darius III", "Arrien, Anabase"]) {
      if (!detail.includes(expected)) throw new Error(`« ${expected} » absent de la fiche : ${detail}`);
    }
    if (!/il y a 2.?35\d ans/.test(detail)) throw new Error(`Ancienneté absente : ${detail}`);
    screenshot("dates-2-fiche");
    await safari.clickButton("Collection");
  });

  await step("Période : fin antérieure refusée, puis acceptée", async () => {
    await openAddForm(safari, "Une date historique");
    await safari.type(await fieldByLabel(safari, "Événement"), "Guerre de Cent Ans");
    await safari.type(await safari.find('[aria-label="Année — Date"]'), "1337");
    await clickToggle("C’est une période");
    await safari.waitForText("Fin");
    const end = await safari.find('[aria-label="Année — Fin"]');
    await safari.type(end, "1300");
    await safari.clickButton("Ajouter");
    await safari.waitForText("La fin doit être postérieure au début.");
    await safari.clear(end);
    await safari.type(end, "1453");
    await safari.clickButton("Ajouter");
    await safari.waitForText("Date ajoutée : « Guerre de Cent Ans »");
    await safari.waitForText("1337 – 1453");
  });

  await step("Siècle approximatif : « vers Ve siècle av. J.-C. »", async () => {
    await openAddForm(safari, "Une date historique");
    await safari.type(await fieldByLabel(safari, "Événement"), "Construction du Parthénon");
    await chooseSegment(safari, "Précision — Date", "Siècle");
    await safari.type(await safari.find('[aria-label="Siècle — Date"]'), "5");
    await chooseSegment(safari, "Ère — Date", "av. J.-C.");
    await clickToggle("Approximative");
    await safari.clickButton("Ajouter");
    await safari.waitForText("vers Ve siècle av. J.-C.");
  });

  await step("Collection : mots et dates séparés, dates en ordre chronologique", async () => {
    await chooseSegment(safari, "Catégorie", "Dates");
    await safari.waitForText("8 DATES");
    if ((await text()).includes("dextre")) throw new Error("Un mot apparaît parmi les dates");
    const order = await safari.script(`return [...document.querySelectorAll("li button p:last-child")].map((p) => p.textContent);`);
    const expected = ["Construction du Parthénon", "Bataille de Marathon", "Bataille de Salamine", "Bataille de Platées", "Bataille de Chéronée", "Bataille de Gaugamèles", "Guerre de Cent Ans", "Prise de la Bastille"];
    if (order.join("|") !== expected.join("|")) throw new Error(`Ordre chronologique inattendu : ${order}`);
    screenshot("dates-3-collection");
    await chooseSegment(safari, "Catégorie", "Vocabulaire");
    await safari.waitForText("4 MOTS");
    if ((await text()).includes("Marathon")) throw new Error("Une date apparaît parmi les mots");
  });

  await step("Ajout par lot : aperçu, doublon et titre écartés, puis ajout", async () => {
    await openAddForm(safari, "Plusieurs à la fois");
    await safari.waitForText("Ajouter plusieurs");
    const lines = [
      "Guerres de Religion",
      "* 1572 : massacre de la Saint-Barthélemy.",
      "* 1598 : édit de Nantes et fin des guerres de Religion.",
      "* 490 av. J.-C. : Bataille de Marathon",
      "affable : qui accueille aimablement les gens « Un hôte affable. »",
    ].join("\n");
    await safari.type(await safari.find('[aria-label="Fiches à ajouter"]'), lines);
    await safari.waitForText("Prêt à ajouter : 2 dates · 1 mot");
    await safari.waitForText("Déjà dans ta collection, ignorées : Bataille de Marathon");
    await safari.waitForText("« Guerres de Religion » : pas de « : »");
    screenshot("dates-6-lot");
    await safari.clickButton("Ajouter (3)");
    await safari.waitForText("3 fiches ajoutées");
    await chooseSegment(safari, "Catégorie", "Dates");
    await safari.waitForText("10 DATES");
    await safari.waitForText("Massacre de la Saint-Barthélemy");
  });

  await step("Aujourd’hui, filtre Dates : 10 dates à réviser", async () => {
    await safari.open(`${appUrl}?t=${Date.now()}#reviser`);
    await safari.waitForText("15 fiches à réviser.");
    await chooseSegment(safari, "Réviser", "Dates");
    await safari.waitForText("10 dates à réviser.");
  });

  await step("Session de dates : 5 questions cohérentes, les deux sens, explication après chaque réponse", async () => {
    await startDailyReview(safari);
    const kinds = new Set();
    const choiceParities = new Set();
    for (let index = 1; index <= 5; index++) {
      await safari.waitFor(`question ${index}`, async () => (await text()).includes(`${index} / 5`));
      const question = await readQuestion();
      if (await answerOrder(question)) {
        await safari.clickButton(index === 5 ? "Voir le bilan" : "Continuer");
        continue;
      }
      choiceParities.add(index % 2);
      const asksDate = question.instruction !== "Quel événement ?";
      kinds.add(asksDate ? "date" : "événement");
      const expected = asksDate ? EVENTS[question.prompt] : nameOfDate[question.prompt];
      if (!expected) throw new Error(`Question inattendue : ${JSON.stringify(question)}`);
      if (!question.choices.includes(expected)) throw new Error(`Bonne réponse absente : ${JSON.stringify(question)}`);
      if (new Set(question.choices).size !== 4) throw new Error(`Propositions en double : ${question.choices}`);
      if (question.choices.some((choice) => /(^|\D)0 (av|apr)/.test(choice))) throw new Error(`An 0 proposé : ${question.choices}`);
      if (index === 1) screenshot("dates-4-question");
      await chooseAnswer(expected);
      await safari.waitForText("Bonne réponse");
      const name = asksDate ? question.prompt : expected;
      if (!(await text()).includes(`Contexte de ${name}`) && name !== "Bataille de Gaugamèles") {
        if (!(await text()).includes(name)) throw new Error(`Explication absente pour ${name}`);
      }
      if (index === 1) screenshot("dates-5-explication");
      await safari.clickButton(index === 5 ? "Voir le bilan" : "Continuer");
    }
    // (Si les classements n'ont laissé que des questions de même rang pair ou impair, l'alternance ne se voit pas.)
    if (kinds.size < 2 && choiceParities.size === 2) throw new Error("Les deux sens de question n’alternent pas");
    await safari.waitFor("score", async () => (await text()).includes("5 / 5"));
    await safari.clickButton("Terminer");
    // 5 dates révisées… ou plus : un classement juste fait aussi réviser les autres dates dues qu'il contient.
    await safari.waitFor("dates restantes", async () => /([1-5]) dates? à réviser\.|Tout est révisé/.test(await text()));
  });

  await step("Réglage par catégorie : « Dates : retrouver la date » seulement", async () => {
    await safari.open(`${appUrl}?t=${Date.now()}#reglages`);
    await safari.waitForText("Dates : retrouver");
    await chooseSegment(safari, "Dates : retrouver", "La date");
    await pause(300);
    await safari.open(`${appUrl}?t=${Date.now()}#reviser`);
    await safari.waitFor("révision", async () => /à réviser\.|Tout est révisé/.test(await text()));
    // Plus rien à réviser (classements) : le réglage se vérifie sur un entraînement.
    const allDone = (await text()).includes("Tout est révisé");
    if (allDone) await safari.clickButton("En vrac");
    else await startDailyReview(safari);
    // 3 dates dues, complétées par de l'entraînement jusqu'à la taille de session.
    await safari.waitFor("compteur", async () => /1 \/ \d+/.test(await text()));
    const total = Number((await text()).match(/1 \/ (\d+)/)[1]);
    for (let index = 1; index <= total; index++) {
      await safari.waitFor(`question ${index}`, async () => (await text()).includes(`${index} / ${total}`));
      const question = await readQuestion();
      if (question.instruction === "Quel événement ?") throw new Error("Question « événement » malgré le réglage");
      if (!(await answerOrder(question))) {
        await chooseAnswer(EVENTS[question.prompt]);
        await safari.waitForText("Bonne réponse");
      }
      await safari.clickButton(index === total ? "Voir le bilan" : "Continuer");
    }
    await safari.clickButton("Terminer");
    await safari.waitForText("Tout est révisé pour aujourd’hui.");
  });

  console.log(`\n${stepper.count} vérifications réussies.`);
} catch (error) {
  screenshot("echec");
  console.error(`\n✗ Échec après ${stepper.count} étape(s) : ${error.message}`);
  process.exitCode = 1;
} finally {
  await safari.stop().catch(() => {});
}
