// Vérifie la gestion des mots dans le vrai Safari d'iOS (simulateur).
//
// Prérequis :
//   1. un simulateur iPhone démarré (Xcode)  : xcrun simctl boot "iPhone 17"
//   2. safaridriver lancé                    : safaridriver -p 4444
//   3. l'app servie en production            : npm run build && npm run preview
// Usage : npm run check:ios [-- http://localhost:4173/]
//
// Attention : le scénario efface les données de l'app à cette adresse.

import { execFileSync } from "node:child_process";
import { IosSafari } from "./webdriver.mjs";

const appUrl = process.argv[2] ?? "http://localhost:4173/";
const screenshotDir = process.env.SCREENSHOT_DIR;
const safari = new IosSafari("http://localhost:4444");

let stepCount = 0;
async function step(name, action) {
  await action();
  stepCount += 1;
  console.log(`✓ ${name}`);
}

function screenshot(name) {
  if (!screenshotDir) return;
  execFileSync("xcrun", ["simctl", "io", "booted", "screenshot", `${screenshotDir}/${name}.png`], { stdio: "ignore" });
}

/** Champs du formulaire ouvert : mot, définition, exemple. */
async function formFields() {
  const term = await safari.find("[role=dialog] input[type=text]");
  const [definition, example] = await safari.findAll("[role=dialog] textarea");
  return { term, definition, example };
}

/** Simule le choix d'un fichier dans le sélecteur iOS (non pilotable par WebDriver). */
async function chooseBackupFile(content) {
  await safari.script(
    `const input = document.querySelector("input[type=file]");
     const transfer = new DataTransfer();
     transfer.items.add(new File([arguments[0]], "test.backup.json", { type: "application/json" }));
     input.files = transfer.files;
     input.dispatchEvent(new Event("change", { bubbles: true }));`,
    [content],
  );
}

const sampleBackup = JSON.stringify({
  app: "lexique",
  schemaVersion: 1,
  exportedAt: new Date().toISOString(),
  words: ["Dextre", "Senestre", "Fruste"].map((term, index) => ({
    id: `test-${index}`,
    term,
    termKey: term.toLowerCase(),
    definition: `Définition de ${term}.`,
    createdAt: 1000 + index,
    updatedAt: 1000 + index,
    box: 0,
    dueDay: "2026-11-04",
    lapses: 0,
  })),
  reviews: [],
  settings: [],
});

try {
  const capabilities = await safari.start();
  console.log(`Safari ${capabilities.browserVersion} sur ${capabilities["safari:deviceName"]} (iOS ${capabilities["safari:platformVersion"]})\n`);

  await step("Données de test et cache effacés", async () => {
    await safari.open(appUrl);
    // Sans cela, le service worker pourrait servir un build précédent.
    await safari.scriptAsync(
      `Promise.all([
         navigator.serviceWorker.getRegistrations().then((all) => Promise.all(all.map((r) => r.unregister()))),
         caches.keys().then((keys) => Promise.all(keys.map((key) => caches.delete(key)))),
       ]).then(() => done("ok"), (error) => done(String(error)));`,
    );
    // L'app ferme sa connexion quand on demande l'effacement (comportement de Dexie) ;
    // on attend la fin réelle de l'effacement avant de recharger.
    const outcome = await safari.scriptAsync(
      `const request = indexedDB.deleteDatabase("lexique");
       request.onsuccess = () => done("ok");
       request.onerror = () => done("erreur : " + request.error);
       request.onblocked = () => done("bloqué");`,
    );
    if (outcome !== "ok") throw new Error(`Effacement de la base : ${outcome}`);
    await safari.open(`${appUrl}?test=${Date.now()}#collection`);
    await safari.waitForText("Ta collection est vide");
  });

  await step("Formulaire ouvert sans défilement, focus sur le mot", async () => {
    await safari.clickButton("Ajouter un mot");
    await safari.waitForText("Nouveau mot");
    await new Promise((resolve) => setTimeout(resolve, 400)); // fin de l'animation
    const state = await safari.script(
      `const field = document.querySelector("[role=dialog] input");
       return { focused: document.activeElement === field, scrollY: window.scrollY, top: field.getBoundingClientRect().top };`,
    );
    if (!state.focused) throw new Error("Le champ « Mot » n’a pas le focus");
    if (state.scrollY !== 0 || state.top > 250) throw new Error(`Formulaire décalé : ${JSON.stringify(state)}`);
  });

  await step("Ajout refusé sans mot ni définition", async () => {
    await safari.clickButton("Ajouter");
    await safari.waitForText("Indique le mot.");
    await safari.waitForText("Indique sa définition.");
  });

  await step("Ajout d’un mot complet", async () => {
    const fields = await formFields();
    await safari.type(fields.term, "alacrité");
    await safari.type(fields.definition, "Vivacité et enjouement.");
    await safari.type(fields.example, "« Il répondit avec alacrité. »");
    screenshot("1-formulaire");
    await safari.clickButton("Ajouter");
    await safari.waitForText("« alacrité » ajouté à ta collection");
    await safari.waitForText("1 mot".toUpperCase());
  });

  await step("Doublon signalé à la saisie", async () => {
    await safari.clickButton("Ajouter un mot");
    const fields = await formFields();
    await safari.type(fields.term, "Alacrite");
    await safari.waitForText("est déjà dans ta collection");
    await safari.clickButton("Annuler");
    await safari.acceptAlert(); // « Abandonner les modifications ? »
    await safari.waitForNoText("Nouveau mot");
  });

  await step("Fiche du mot (exemple sans guillemets doublés)", async () => {
    await safari.click(await safari.find("li button"));
    await safari.waitForText("Ajouté le");
    const text = await safari.bodyText();
    if (!text.includes("« Il répondit avec alacrité. »")) throw new Error("Exemple mal affiché");
    if (text.includes("« «")) throw new Error("Guillemets doublés");
    screenshot("2-fiche");
  });

  await step("Modification", async () => {
    await safari.clickButton("Modifier");
    const { definition } = await formFields();
    await safari.clear(definition);
    await safari.type(definition, "Vivacité joyeuse.");
    await safari.clickButton("Enregistrer");
    await safari.waitForText("Modifications enregistrées");
    await safari.waitForText("Vivacité joyeuse.");
  });

  await step("Suppression puis annulation", async () => {
    await safari.clickButton("Supprimer");
    await safari.waitForText("« alacrité » supprimé");
    await safari.waitForText("Ta collection est vide");
    await safari.clickButton("Annuler");
    await safari.waitForText("Vivacité joyeuse.");
  });

  await step("Restauration d’une sauvegarde (avec confirmation)", async () => {
    await safari.open(`${appUrl}?test=${Date.now()}#reglages`);
    await safari.waitForText("Sauvegarde".toUpperCase());
    await chooseBackupFile(sampleBackup);
    await safari.waitFor("boîte de confirmation", async () => {
      await safari.acceptAlert();
      return true;
    });
    await safari.waitForText("3 mots restaurés");
  });

  await step("Fichier invalide refusé avec un message clair", async () => {
    await chooseBackupFile('{"pas":"une sauvegarde"}');
    await safari.waitForText("Ce fichier n’est pas une sauvegarde de Lexique.");
  });

  await step("Recherche sans accents et tri alphabétique", async () => {
    await safari.open(`${appUrl}?test=${Date.now()}#collection`);
    await safari.waitForText("3 MOTS");
    const search = await safari.find("input[type=search]");
    await safari.type(search, "SENESTRE");
    await safari.waitForNoText("Dextre");
    await safari.waitForText("Senestre");
    await safari.clear(search);
    await safari.type(search, "zzz");
    await safari.waitForText("Aucun mot ne correspond");
    await safari.clear(search);
    await safari.clickButton("A → Z");
    await safari.waitFor("ordre alphabétique", async () => {
      const terms = await safari.script(`return [...document.querySelectorAll("li p:first-child")].map((p) => p.textContent);`);
      return terms.join(",") === "Dextre,Fruste,Senestre";
    });
    screenshot("3-collection");
  });

  await step("Partage de fichier disponible pour l’export", async () => {
    const canShare = await safari.script(
      `return navigator.canShare?.({ files: [new File(["{}"], "a.json", { type: "application/json" })] }) === true;`,
    );
    if (!canShare) throw new Error("navigator.canShare refuse un fichier JSON");
  });

  console.log(`\n${stepCount} vérifications réussies.`);
} catch (error) {
  screenshot("echec");
  console.error(`\n✗ Échec après ${stepCount} étape(s) : ${error.message}`);
  process.exitCode = 1;
} finally {
  await safari.stop().catch(() => {});
}
