// Vérifie la révision (quiz + répétition espacée) dans le vrai Safari d'iOS (simulateur).
// Prérequis et usage : voir check-words.mjs. Le scénario efface les données de l'app.

import { IosSafari } from "./webdriver.mjs";
import { chooseBackupFile, createStepper, makeBackup, startLocalSession, screenshot } from "./helpers.mjs";

const appUrl = process.argv[2] ?? "http://localhost:4173/";
const safari = new IosSafari("http://localhost:4444");
const stepper = createStepper();
const step = (name, action) => stepper.step(name, action);

const entries = [
  ["alacrité", "Vivacité et enjouement."],
  ["dilection", "Amour pur et spirituel."],
  ["fruste", "Qui manque de finesse."],
  ["inane", "Qui ne sert à rien."],
  ["accorte", "Gracieuse, aimable et vive."],
  ["sybarite", "Personne qui recherche les plaisirs raffinés."],
];
const definitionOf = new Map(entries);
const termOf = new Map(entries.map(([term, definition]) => [definition, term]));

/** Lit la question affichée : consigne, énoncé, propositions. */
function readQuestion() {
  return safari.script(`
    const card = document.querySelector("[role=dialog][aria-label=Révision]");
    return {
      instruction: card.querySelector("p").textContent,
      prompt: card.querySelector("h2").textContent,
      choices: [...card.querySelectorAll("[role=group] button")].map((b) => b.textContent),
      counter: card.querySelector("header span")?.textContent ?? "",
    };`);
}

/** Bonne réponse attendue, d'après les données de test. */
function expectedAnswer(question) {
  return question.instruction.includes("Quelle est la définition")
    ? definitionOf.get(question.prompt)
    : termOf.get(question.prompt);
}

async function chooseAnswer(label) {
  await safari.script(
    `[...document.querySelectorAll("[role=group] button")].find((b) => b.textContent === arguments[0]).click();`,
    [label],
  );
}

/** Lit les fiches et l'historique directement dans IndexedDB. */
function readDatabase() {
  return safari.scriptAsync(`
    const request = indexedDB.open("lexique");
    request.onsuccess = () => {
      const db = request.result;
      const tx = db.transaction(["items", "reviews"]);
      const items = tx.objectStore("items").getAll();
      const reviews = tx.objectStore("reviews").getAll();
      tx.oncomplete = () => { done({ items: items.result, reviews: reviews.result }); db.close(); };
    };`);
}

/** Ouvre la fiche d'un mot dans la Collection et renvoie son texte (niveau, prochaine révision). */
async function readDetail(term) {
  await safari.open(`${appUrl}?t=${Date.now()}#collection`);
  await safari.waitForText(term);
  await safari.script(
    `[...document.querySelectorAll("li button")].find((b) => b.querySelector("p").textContent === arguments[0]).click();`,
    [term],
  );
  await safari.waitForText("Ajouté le");
  return (await safari.bodyText()).replace(/\s+/g, " ");
}

try {
  const capabilities = await safari.start();
  console.log(`Safari ${capabilities.browserVersion} sur ${capabilities["safari:deviceName"]} (iOS ${capabilities["safari:platformVersion"]})\n`);

  await step("Collection de 6 mots restaurée", async () => {
    await startLocalSession(safari, appUrl, "#reglages");
    await safari.waitForText("SAUVEGARDE");
    await chooseBackupFile(safari, makeBackup(entries));
    await safari.waitForText("6 mots restaurés");
  });

  await step("Aujourd’hui : 6 mots à réviser", async () => {
    await safari.open(`${appUrl}?t=${Date.now()}#aujourdhui`); // ancienne adresse : doit ouvrir « Réviser »
    await safari.waitForText("6 mots à réviser.");
    await safari.waitForText("Une session de 5 questions");
  });

  let failedTerm;
  await step("Première question ratée volontairement, retour affiché", async () => {
    await safari.clickButton("Commencer la révision");
    await safari.waitForText("1 / 5");
    const question = await readQuestion();
    const expected = expectedAnswer(question);
    if (!question.choices.includes(expected)) throw new Error(`Bonne réponse absente : ${JSON.stringify(question)}`);
    if (new Set(question.choices).size !== 4) throw new Error("Propositions en double");
    screenshot("review-1-question");
    failedTerm = question.instruction.includes("définition") ? question.prompt : expected;
    await chooseAnswer(question.choices.find((choice) => choice !== expected));
    await safari.waitForText("Ce n’était pas ça");
    await safari.waitForText(definitionOf.get(failedTerm));
    screenshot("review-2-feedback");
    await safari.waitForText("1 / 6"); // le mot raté sera reposé en fin de session
    await safari.clickButton("Continuer");
  });

  await step("Questions suivantes réussies (alternance des deux sens)", async () => {
    const instructions = new Set();
    for (let index = 2; index <= 5; index++) {
      await safari.waitForText(`${index} / 6`);
      const question = await readQuestion();
      instructions.add(question.instruction);
      await chooseAnswer(expectedAnswer(question));
      await safari.waitForText("Bonne réponse");
      await safari.clickButton("Continuer");
    }
    if (instructions.size < 2) throw new Error("Le mode mixte n’alterne pas les deux sens");
  });

  await step("Deuxième chance sur le mot raté", async () => {
    await safari.waitForText("6 / 6");
    await safari.waitForText("DEUXIÈME CHANCE"); // consigne en majuscules (CSS)
    const question = await readQuestion();
    const expected = expectedAnswer(question);
    const asked = question.instruction.includes("définition") ? question.prompt : expected;
    if (asked !== failedTerm) throw new Error(`Mot reposé inattendu : ${asked} (attendu ${failedTerm})`);
    await chooseAnswer(expected);
    await safari.clickButton("Voir le bilan");
  });

  await step("Bilan : 4 / 5 (la deuxième chance ne compte pas)", async () => {
    await safari.waitForText("Session terminée".toUpperCase());
    await safari.waitFor("score", async () => (await safari.bodyText()).replace(/\s+/g, " ").includes("4 / 5"));
    screenshot("review-3-summary");
    await safari.clickButton("Terminer");
  });

  await step("Historique enregistré (la deuxième chance n’y figure pas)", async () => {
    const { items, reviews } = await readDatabase();
    if (reviews.length !== 5) throw new Error(`${reviews.length} réponses enregistrées au lieu de 5`);
    const failed = items.find((item) => item.content.term === failedTerm);
    const failedReviews = reviews.filter((review) => review.itemId === failed.id);
    if (failedReviews.length !== 1 || failedReviews[0].correct) throw new Error("Réponse ratée mal enregistrée");
    if (!reviews.every((review) => review.exercise.startsWith("vocabulary.") && /^\d{4}-\d{2}-\d{2}$/.test(review.studyDay))) {
      throw new Error(`Réponse mal formée : ${JSON.stringify(reviews[0])}`);
    }
  });

  await step("Progression recalculée : le mot raté revient demain", async () => {
    const text = await readDetail(failedTerm);
    if (!text.includes("En apprentissage · révision demain")) throw new Error(`Fiche inattendue : ${text}`);
    await safari.clickButton("Collection");
  });

  await step("Aujourd’hui : 1 mot restant, 5 réponses, série d’1 jour", async () => {
    await safari.open(`${appUrl}?t=${Date.now()}#reviser`);
    await safari.waitForText("1 mot à réviser.");
    await safari.waitForText("réponses aujourd’hui");
    const text = (await safari.bodyText()).replace(/\s+/g, " ");
    if (!text.includes("5 réponses aujourd’hui") || !text.includes("1 jour de suite")) {
      throw new Error(`Statistiques inattendues : ${text}`);
    }
  });

  await step("Progrès : chiffres, niveaux, activité, mots oubliés", async () => {
    await safari.open(`${appUrl}?t=${Date.now()}#progres`);
    await safari.waitForText("NIVEAUX");
    const text = (await safari.bodyText()).replace(/\s+/g, " ");
    for (const expected of ["6 mots", "1 à réviser aujourd’hui", "En apprentissage 5", "5 réponses, dont 4 justes", `LES PLUS OUBLIÉES ${failedTerm}`]) {
      if (!text.includes(expected)) throw new Error(`« ${expected} » absent de : ${text}`);
    }
    screenshot("review-4-progress");
  });

  await step("Tout révisé : entraînement « Tout en vrac » sans effet sur le planning", async () => {
    await safari.open(`${appUrl}?t=${Date.now()}#reviser`);
    await safari.waitForText("1 mot à réviser.");
    await safari.clickButton("Commencer la révision");
    for (let index = 1; index <= 5; index++) {
      await safari.waitFor(`question ${index}`, async () => (await safari.bodyText()).includes(`${index} / `));
      const question = await readQuestion();
      await chooseAnswer(expectedAnswer(question));
      await safari.waitForText("Bonne réponse");
      await safari.clickButton(index === 5 ? "Voir le bilan" : "Continuer");
    }
    await safari.clickButton("Terminer");
    await safari.waitForText("Tout est révisé pour aujourd’hui.");
    await safari.waitForText("Prochaine révision demain");
    await safari.clickButton("Tout en vrac");
    const question = await readQuestion();
    const expected = expectedAnswer(question);
    const trainedTerm = question.instruction.includes("définition") ? question.prompt : expected;
    await chooseAnswer(expected);
    await safari.waitForText("Bonne réponse");
    await safari.clickButton("Quitter");
    const { reviews } = await readDatabase();
    if (reviews.length !== 11) throw new Error(`${reviews.length} réponses au lieu de 11`);
    // Révisé en avance : il ne monte pas de boîte et revient toujours demain.
    const text = await readDetail(trainedTerm);
    if (!text.includes("En apprentissage · révision demain")) throw new Error(`Planning modifié par l’entraînement : ${text}`);
  });

  console.log(`\n${stepper.count} vérifications réussies.`);
} catch (error) {
  screenshot("echec");
  console.error(`\n✗ Échec après ${stepper.count} étape(s) : ${error.message}`);
  process.exitCode = 1;
} finally {
  await safari.stop().catch(() => {});
}
