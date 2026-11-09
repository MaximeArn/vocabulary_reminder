// Vérifie les exercices avancés dans le vrai Safari d'iOS (simulateur) : réponse tapée
// (mot et année), entraînement « Par époque » et classement chronologique.
// Prérequis et usage : voir check-words.mjs. Le scénario efface les données de l'app.

import { IosSafari } from "./webdriver.mjs";
import { chooseBackupFile, chooseSegment, createStepper, screenshot, startDailyReview, startLocalSession } from "./helpers.mjs";

const appUrl = process.argv[2] ?? "http://localhost:4173/";
const safari = new IosSafari("http://localhost:4444");
const stepper = createStepper();
const step = (name, action) => stepper.step(name, action);
const text = () => safari.bodyText();

const WORDS = {
  alacrité: "Vivacité et enjouement.",
  fruste: "Qui manque de finesse.",
  sybarite: "Personne qui recherche les plaisirs raffinés.",
  dilection: "Amour pur et spirituel.",
  accorte: "Gracieuse, aimable et vive.",
};
const termOf = Object.fromEntries(Object.entries(WORDS).map(([term, definition]) => [definition, term]));
const DATES = {
  "Bataille de Marathon": -490,
  "Bataille de Salamine": -480,
  "Bataille de Chéronée": -338,
  "Bataille de Gaugamèles": -331,
  "Mort d’Alexandre le Grand": -323,
  "Avènement d’Hugues Capet": 987,
};

/**
 * Fiches « acquises » (boîte 3) : trois bonnes réponses espacées, sur des jours où
 * elles étaient dues. Leurs questions sont donc à taper.
 */
function acquiredBackup() {
  const created = Date.parse("2026-01-01T12:00:00Z");
  const items = [
    ...Object.entries(WORDS).map(([term, definition], index) => ({
      id: `mot-${index}`,
      kind: "vocabulary",
      content: { term, definition },
      createdAt: created,
      updatedAt: created,
    })),
    ...Object.entries(DATES).map(([name, year], index) => ({
      id: `date-${index}`,
      kind: "historical-event",
      content: { name, start: { year, precision: "year", circa: false }, uncertain: false, people: [] },
      createdAt: created,
      updatedAt: created,
    })),
  ];
  const days = ["2026-01-01", "2026-01-02", "2026-01-05"];
  const reviews = items.flatMap((item) =>
    days.map((studyDay, index) => ({
      id: `${item.id}-r${index}`,
      itemId: item.id,
      answeredAt: Date.parse(`${studyDay}T12:00:00Z`),
      studyDay,
      exercise: item.kind === "vocabulary" ? "vocabulary.word-to-definition" : "historical-event.event-to-date",
      correct: true,
    })),
  );
  return JSON.stringify({ app: "lexique", schemaVersion: 2, exportedAt: new Date().toISOString(), items, reviews, settings: [] });
}

function readQuestion() {
  return safari.script(`
    const card = document.querySelector("[role=dialog][aria-label=Révision]");
    return {
      instruction: card.querySelector("p").textContent,
      prompt: card.querySelector("h2").textContent,
      typed: !!card.querySelector("form input"),
      order: !!card.querySelector("[aria-label='Événements à classer']"),
    };`);
}

function typeAnswer(value) {
  return safari.script(
    `const field = document.querySelector("[role=dialog] form input");
     Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(field, arguments[0]);
     field.dispatchEvent(new Event("input", { bubbles: true }));`,
    [value],
  );
}

/** Classe les événements affichés dans l'ordre chronologique. */
async function answerOrder() {
  const names = await safari.script(
    `return [...document.querySelectorAll("[aria-label='Événements à classer'] button")].map((b) => b.getAttribute("aria-label"));`,
  );
  const sorted = [...names].sort((a, b) => DATES[a] - DATES[b]);
  for (const name of sorted.slice(0, 3)) {
    await safari.script(
      `[...document.querySelectorAll("[aria-label='Événements à classer'] button")].find((b) => b.getAttribute("aria-label") === arguments[0]).click();`,
      [name],
    );
  }
  await safari.clickButton("Valider");
  await safari.waitForText("Bon ordre");
}

/** Parcourt une session jusqu'au bilan ; `answer` répond à chaque question. */
async function runSession(answer) {
  await safari.waitFor("première question", async () => /1 \/ \d+/.test(await text()));
  for (let index = 1; index <= 30; index++) {
    const current = await text();
    if (current.includes("Encore une session")) return;
    await answer(await readQuestion(), index);
    await safari.clickButton((await text()).includes("Voir le bilan") ? "Voir le bilan" : "Continuer");
    await safari.waitFor("question suivante", async () => !(await text()).includes("Continuer"));
  }
  throw new Error("La session ne se termine pas");
}

try {
  await safari.start();

  await step("Fiches acquises restaurées (5 mots, 6 dates)", async () => {
    await startLocalSession(safari, appUrl, "#reglages");
    await safari.waitForText("SAUVEGARDE");
    await chooseBackupFile(safari, acquiredBackup());
    await safari.waitForText("11 fiches restaurées");
  });

  await step("« Par époque » : choix de l'époque, avec le nombre de dates", async () => {
    await safari.open(`${appUrl}?t=${Date.now()}#reviser`);
    await chooseSegment(safari, "Réviser", "Dates");
    await safari.clickButton("Par époque");
    await safari.waitForText("Réviser une époque");
    for (const label of ["Époque au hasard", "Antiquité · 5 dates", "Moyen Âge · 1 date"]) await safari.waitForText(label);
    screenshot("exercices-1-epoques");
    await safari.clickButton("Antiquité · 5 dates");
  });

  let typedYears = 0;
  let wrongYearSeen = false;
  await step("Antiquité : années tapées (exacte juste, écart indiqué), classements justes, rien d'une autre époque", async () => {
    await runSession(async (question) => {
      if (question.prompt === "Avènement d’Hugues Capet") throw new Error("Date du Moyen Âge dans l'Antiquité");
      if (question.order) {
        screenshot("exercices-2-classement");
        await answerOrder();
        return;
      }
      if (!question.typed) throw new Error(`Question à choix pour une date acquise : ${JSON.stringify(question)}`);
      const year = DATES[question.prompt];
      typedYears += 1;
      const wrong = typedYears === 1;
      await typeAnswer(String(Math.abs(year) - (wrong ? 3 : 0)));
      await chooseSegment(safari, "Ère", "av. J.-C.");
      await safari.clickButton("Valider");
      if (wrong) {
        // 3 de moins avant J.-C. : 3 ans trop tard.
        await safari.waitForText("3 ans trop tard");
        wrongYearSeen = true;
        screenshot("exercices-3-annee");
      } else {
        await safari.waitForText("Bonne réponse");
      }
    });
    if (!wrongYearSeen) throw new Error("Aucune année tapée");
    await safari.clickButton("Terminer");
  });

  await step("Vocabulaire : mot tapé, une faute de frappe acceptée avec l'orthographe exacte", async () => {
    await chooseSegment(safari, "Réviser", "Vocabulaire");
    await startDailyReview(safari);
    let typoSeen = false;
    await runSession(async (question) => {
      if (!question.typed) throw new Error(`Question à choix pour un mot acquis : ${JSON.stringify(question)}`);
      const term = termOf[question.prompt];
      if (!term) throw new Error(`Définition inconnue : ${question.prompt}`);
      if (!typoSeen) {
        // Deux lettres inversées, accents omis.
        const typo = (term.slice(0, 2) + term[3] + term[2] + term.slice(4)).normalize("NFD").replace(/[̀-ͯ]/g, "");
        await typeAnswer(typo);
        await safari.clickButton("Valider");
        await safari.waitForText("Juste, à l’orthographe près");
        await safari.waitForText(`On écrit ${term}`);
        screenshot("exercices-4-mot");
        typoSeen = true;
      } else {
        await typeAnswer(term);
        await safari.clickButton("Valider");
        await safari.waitForText("Bonne réponse");
      }
    });
    await safari.waitForText("5 / 5");
  });

  console.log(`\n${stepper.count} vérifications réussies.`);
} catch (error) {
  screenshot("echec");
  console.error(`\n✗ Échec après ${stepper.count} étape(s) : ${error.message}`);
  process.exitCode = 1;
} finally {
  await safari.stop().catch(() => {});
}
