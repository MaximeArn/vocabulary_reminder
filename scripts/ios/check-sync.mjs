// Vérifie la synchronisation avec Supabase dans le vrai Safari d'iOS (simulateur).
// Prérequis : voir check-words.mjs. Les comptes de test viennent de .env.test.local
// (TEST1_EMAIL, TEST1_PASSWORD, TEST2_EMAIL, TEST2_PASSWORD), jamais versionné.
// Sans ce fichier, seuls les contrôles ne nécessitant pas de compte sont faits.

import { existsSync, readFileSync } from "node:fs";
import { IosSafari } from "./webdriver.mjs";
import { chooseBackupFile, createStepper, fieldByLabel, pause, resetApp, screenshot } from "./helpers.mjs";

const appUrl = process.argv[2] ?? "http://localhost:4173/";
const safari = new IosSafari("http://localhost:4444");
const stepper = createStepper();
const step = (name, action) => stepper.step(name, action);

function readTestAccounts() {
  const file = new URL("../../.env.test.local", import.meta.url);
  if (!existsSync(file)) return null;
  const values = Object.fromEntries(
    readFileSync(file, "utf8")
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#") && line.includes("="))
      .map((line) => [line.slice(0, line.indexOf("=")).trim(), line.slice(line.indexOf("=") + 1).trim()]),
  );
  const { TEST1_EMAIL, TEST1_PASSWORD, TEST2_EMAIL, TEST2_PASSWORD } = values;
  return TEST1_EMAIL && TEST1_PASSWORD && TEST2_EMAIL && TEST2_PASSWORD
    ? { first: { email: TEST1_EMAIL, password: TEST1_PASSWORD }, second: { email: TEST2_EMAIL, password: TEST2_PASSWORD } }
    : null;
}

const text = async () => (await safari.bodyText()).replace(/\s+/g, " ");

/** Appareil neuf : données locales, cache et session effacés. */
async function freshDevice(hash) {
  await resetApp(safari, appUrl, "");
  await safari.script("localStorage.clear();");
  await safari.open(`${appUrl}?t=${Date.now()}${hash}`);
}

/** Connexion depuis l'écran d'accueil, puis attente de la première synchronisation. */
async function signIn({ email, password }) {
  await fillLogin(email, password);
  await safari.waitForText("Se déconnecter", 15000);
  await waitSynced();
}

async function fillLogin(email, password) {
  await safari.waitForText("Ce que tu lis, tu le retiens.");
  await safari.type(await safari.find('input[type="email"]'), email);
  await safari.type(await safari.find('input[type="password"]'), password);
  await safari.clickButton("Se connecter");
}

/** Attend « À jour » sans modification en attente (panneau Compte des Réglages). */
async function waitSynced() {
  await safari.open(`${appUrl}?t=${Date.now()}#reglages`);
  await safari.waitFor("synchronisation terminée", async () => /Synchronisation À jour/.test(await text()), 25000);
}

async function localItemCount() {
  return safari.scriptAsync(`
    const request = indexedDB.open("lexique");
    request.onsuccess = () => {
      const db = request.result;
      const count = db.transaction("items").objectStore("items").count();
      count.onsuccess = () => { done(count.result); db.close(); };
    };`);
}

async function collectionTitles() {
  await safari.open(`${appUrl}?t=${Date.now()}#collection`);
  await safari.waitFor("collection chargée", async () => /FICHES?|MOTS?|DATES?|Ta collection est vide/.test(await text()));
  return safari.script(`return [...document.querySelectorAll("li button p:first-child")].map((p) => p.textContent);`);
}

// Données de test propres à cette exécution (les comptes de test gardent les données des exécutions passées).
const run = Date.now().toString(36);
const uuid = () => crypto.randomUUID();
const word = (term) => ({ id: uuid(), kind: "vocabulary", content: { term: `${term}-${run}`, definition: `Définition de ${term}.` }, createdAt: 1000, updatedAt: 1000 });
const items = [word("alacrité"), word("dilection"), word("fruste"), {
  id: uuid(),
  kind: "historical-event",
  content: { name: `Bataille de Marathon-${run}`, start: { year: -490, precision: "year", circa: false }, uncertain: false, people: [] },
  createdAt: 1000,
  updatedAt: 1000,
}];
const reviewed = items[0];
const backup = JSON.stringify({
  app: "lexique",
  schemaVersion: 2,
  exportedAt: new Date().toISOString(),
  items,
  reviews: [
    { id: uuid(), itemId: reviewed.id, answeredAt: Date.now() - 2000, studyDay: "2026-11-08", exercise: "vocabulary.word-to-definition", correct: true },
    { id: uuid(), itemId: reviewed.id, answeredAt: Date.now() - 1000, studyDay: "2026-11-09", exercise: "vocabulary.definition-to-word", correct: true },
  ],
  settings: [],
});
const titles = items.map((item) => item.content.term ?? item.content.name);

try {
  const capabilities = await safari.start();
  console.log(`Safari ${capabilities.browserVersion} sur ${capabilities["safari:deviceName"]} (iOS ${capabilities["safari:platformVersion"]})\n`);
  const accounts = readTestAccounts();

  await step("Premier lancement : écran de connexion, l'app n'est pas accessible", async () => {
    await freshDevice("#collection");
    await safari.waitForText("Ce que tu lis, tu le retiens.");
    if ((await text()).includes("Collection")) throw new Error("L’app est visible sans connexion");
    screenshot("sync-0-connexion");
  });

  await step("Mauvais mot de passe refusé par le serveur, message clair", async () => {
    await fillLogin(accounts?.first.email ?? "test1@mneme.invalid", "mauvais-mot-de-passe");
    await safari.waitForText("E-mail ou mot de passe incorrect.", 15000);
  });

  if (!accounts) {
    console.log("\n(.env.test.local absent ou incomplet : tests de synchronisation entre appareils ignorés)");
  } else {
    let progressOnFirstDevice;

    await step("Appareil A : connexion, puis données envoyées au serveur", async () => {
      await freshDevice("#reglages");
      await signIn(accounts.first);
      await safari.waitForText("SAUVEGARDE");
      await chooseBackupFile(safari, backup);
      await pause(800);
      await safari.acceptAlert().catch(() => {}); // confirmation si des fiches d'anciennes exécutions sont revenues
      await safari.waitForText("4 fiches restaurées");
      await pause(2500); // délai de regroupement des modifications
      await waitSynced();
      screenshot("sync-1-a-jour");
      const shown = await collectionTitles();
      if (shown.length !== 4) throw new Error(`Collection inattendue : ${shown}`);
      await safari.open(`${appUrl}?t=${Date.now()}#progres`);
      await safari.waitForText("NIVEAUX");
      progressOnFirstDevice = await text();
    });

    await step("Appareil neuf : tout est retrouvé, progression comprise", async () => {
      await freshDevice("#reglages");
      await signIn(accounts.first);
      const shown = await collectionTitles();
      for (const title of titles) if (!shown.includes(title)) throw new Error(`« ${title} » absent : ${shown}`);
      if (shown.length !== 4) throw new Error(`Fiches en trop : ${shown}`);
      await safari.open(`${appUrl}?t=${Date.now()}#progres`);
      await safari.waitForText("NIVEAUX");
      if ((await text()) !== progressOnFirstDevice) throw new Error("La progression diffère d’un appareil à l’autre");
    });

    await step("Suppression faite sur un appareil, propagée aux autres", async () => {
      await safari.open(`${appUrl}?t=${Date.now()}#collection`);
      await safari.waitForText(titles[1]);
      await safari.script(`[...document.querySelectorAll("li button")].find((b) => b.textContent.startsWith(arguments[0])).click();`, [titles[1]]);
      await safari.waitForText("Ajouté le");
      await safari.clickButton("Supprimer");
      await pause(300);
      await safari.acceptAlert();
      await safari.waitForText(`« ${titles[1]} » supprimé`);
      await safari.open(`${appUrl}?t=${Date.now()}#reglages`);
      await pause(2500);
      await waitSynced();
      await freshDevice("#reglages");
      await signIn(accounts.first);
      const shown = await collectionTitles();
      if (shown.includes(titles[1])) throw new Error("La fiche supprimée est revenue");
      if (shown.length !== 3) throw new Error(`Collection inattendue : ${shown}`);
    });

    await step("Déconnexion : retour à l'écran de connexion, appareil vidé", async () => {
      await safari.open(`${appUrl}?t=${Date.now()}#reglages`);
      await safari.waitForText("Se déconnecter");
      await safari.clickButton("Se déconnecter");
      await pause(1500);
      await safari.acceptAlert();
      await safari.waitForText("Ce que tu lis, tu le retiens.", 15000);
      const remaining = await localItemCount();
      if (remaining !== 0) throw new Error(`${remaining} fiche(s) encore sur l’appareil`);
    });

    // Le second compte de test est facultatif : sans lui, l'étape est signalée comme non faite.
    await freshDevice("#reglages");
    await fillLogin(accounts.second.email, accounts.second.password);
    await safari.waitFor("connexion du second compte", async () => /Se déconnecter|incorrect/.test(await text()), 15000);
    if ((await text()).includes("incorrect")) {
      console.log("– Isolation NON testée ici : compte test2 refusé par Supabase (voir supabase/tests/isolation.sql)");
    } else await step("Isolation : le second compte ne voit rien du premier", async () => {
      await waitSynced();
      const shown = await collectionTitles();
      if (shown.some((title) => title.endsWith(run))) throw new Error(`Données du premier compte visibles : ${shown}`);
      // Contrôle direct de l'API, avec le jeton du second compte : RLS doit tout filtrer.
      const leaked = await safari.scriptAsync(
        `const session = JSON.parse(localStorage.getItem("mneme.auth"));
         fetch(arguments[0] + "/rest/v1/items?select=id&id=eq." + arguments[1], {
           headers: { apikey: arguments[2], Authorization: "Bearer " + session.access_token },
         }).then((r) => r.json()).then((rows) => done(rows.length), (e) => done("erreur " + e));`,
      [
        "https://nscnlrgyjodfazauymrq.supabase.co",
        reviewed.id,
        "sb_publishable_O1VqtzKROy2phEzULG7O6Q_rFugg7Et",
      ]);
      if (leaked !== 0) throw new Error(`Une fiche du premier compte est lisible par le second (${leaked})`);
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
