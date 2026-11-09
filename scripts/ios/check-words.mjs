// Vérifie la gestion des mots dans le vrai Safari d'iOS (simulateur).
//
// Prérequis :
//   1. un simulateur iPhone démarré (Xcode)  : xcrun simctl boot "iPhone 17"
//   2. safaridriver lancé                    : safaridriver -p 4444
//   3. l'app servie en production            : npm run build && npm run preview
// Usage : npm run check:ios [-- http://localhost:4173/]
//
// Attention : le scénario efface les données de l'app à cette adresse.

import { IosSafari } from "./webdriver.mjs";
import { chooseBackupFile as chooseFile, createStepper, makeBackup, resetApp, screenshot } from "./helpers.mjs";

const appUrl = process.argv[2] ?? "http://localhost:4173/";
const safari = new IosSafari("http://localhost:4444");

const stepper = createStepper();
const step = (name, action) => stepper.step(name, action);

/** Champs du formulaire ouvert : mot, définition, exemple. */
async function formFields() {
  const term = await safari.find("[role=dialog] input[type=text]");
  const [definition, example] = await safari.findAll("[role=dialog] textarea");
  return { term, definition, example };
}

const chooseBackupFile = (content) => chooseFile(safari, content);

const sampleBackup = makeBackup([
  ["Dextre", "Définition de Dextre."],
  ["Senestre", "Définition de Senestre."],
  ["Fruste", "Définition de Fruste."],
]);

try {
  const capabilities = await safari.start();
  console.log(`Safari ${capabilities.browserVersion} sur ${capabilities["safari:deviceName"]} (iOS ${capabilities["safari:platformVersion"]})\n`);

  await step("Données de test et cache effacés", async () => {
    await resetApp(safari, appUrl, "#collection");
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

  await step("Suppression refusée à la confirmation", async () => {
    await safari.clickButton("Supprimer");
    await new Promise((resolve) => setTimeout(resolve, 300));
    await safari.dismissAlert(); // « Supprimer « alacrité » de ta collection ? » → Annuler
    await safari.waitForText("Vivacité joyeuse.");
  });

  await step("Suppression confirmée puis annulée", async () => {
    await safari.clickButton("Supprimer");
    await new Promise((resolve) => setTimeout(resolve, 300));
    await safari.acceptAlert();
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

  await step("Export en texte : JSON complet affiché", async () => {
    await safari.clickButton("Exporter en texte");
    await safari.waitFor("JSON prêt", async () => {
      const json = await safari.value("[role=dialog] textarea");
      return json?.includes('"app": "lexique"') && JSON.parse(json).items.length === 3;
    });
    await safari.clickButton("Copier");
    // Sans vrai toucher (limite du simulateur), Safari refuse le presse-papiers :
    // on vérifie alors le repli (texte sélectionné). Sur l'iPhone, la copie aboutit.
    await safari.waitFor("copie ou repli", async () => {
      const text = await safari.bodyText();
      return text.includes("Sauvegarde copiée") || text.includes("le texte est sélectionné");
    });
    if (await safari.script(`return !!document.querySelector("[role=dialog]")`)) await safari.clickButton("Fermer");
    await safari.waitForNoText("Export en texte");
  });

  await step("Import en texte : erreur claire puis restauration", async () => {
    await safari.clickButton("Importer du texte");
    const area = await safari.find("[role=dialog] textarea");
    await safari.type(area, "pas du json");
    await safari.clickButton("Importer");
    await safari.waitForText("Ce fichier n’est pas un fichier JSON valide.");
    await safari.clear(area);
    const twoWords = JSON.parse(sampleBackup);
    twoWords.words = twoWords.words.slice(0, 2);
    await safari.type(area, JSON.stringify(twoWords));
    await safari.clickButton("Importer");
    await new Promise((resolve) => setTimeout(resolve, 500));
    await safari.acceptAlert(); // remplacer les 3 mots actuels
    await safari.waitForText("2 mots restaurés");
    await safari.waitForNoText("Import en texte");
    // On revient aux 3 mots pour la suite du scénario.
    await chooseBackupFile(sampleBackup);
    await new Promise((resolve) => setTimeout(resolve, 500));
    await safari.acceptAlert();
    await safari.waitForText("3 mots restaurés");
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

  console.log(`\n${stepper.count} vérifications réussies.`);
} catch (error) {
  screenshot("echec");
  console.error(`\n✗ Échec après ${stepper.count} étape(s) : ${error.message}`);
  process.exitCode = 1;
} finally {
  await safari.stop().catch(() => {});
}
