// Outils communs aux scénarios iOS.
import { execFileSync } from "node:child_process";

/** Exécute une étape nommée et l'affiche une fois réussie. */
export function createStepper() {
  let count = 0;
  return {
    async step(name, action) {
      await action();
      count += 1;
      console.log(`✓ ${name}`);
    },
    get count() {
      return count;
    },
  };
}

export function screenshot(name) {
  const dir = process.env.SCREENSHOT_DIR;
  if (!dir) return;
  try {
    execFileSync("xcrun", ["simctl", "io", "booted", "screenshot", `${dir}/${name}.png`], { stdio: "ignore" });
  } catch {
    console.warn(`(capture « ${name} » impossible : simulateur arrêté ?)`);
  }
}

export const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Efface données, service worker et cache de l'app, puis la recharge. */
export async function resetApp(safari, appUrl, hash = "") {
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
  await safari.open(`${appUrl}?test=${Date.now()}${hash}`);
}

/**
 * Simule le choix d'un fichier dans le sélecteur iOS (non pilotable par WebDriver),
 * puis choisit « Remplacer ma collection » (ou « Ajouter… » avec mode = "add").
 */
export async function chooseBackupFile(safari, content, mode = "replace") {
  await safari.script(
    `const input = document.querySelector("input[type=file]");
     const transfer = new DataTransfer();
     transfer.items.add(new File([arguments[0]], "test.backup.json", { type: "application/json" }));
     input.files = transfer.files;
     input.dispatchEvent(new Event("change", { bubbles: true }));`,
    [content],
  );
  // Fichier valide : l'app demande s'il faut ajouter ou remplacer.
  const choice = mode === "add" ? "Ajouter à ma collection" : "Remplacer ma collection";
  await safari
    .waitFor("choix ajouter / remplacer", async () => (await safari.bodyText()).includes(choice), 2500)
    .then(() => safari.clickButton(choice))
    .catch(() => {}); // fichier invalide : pas de choix, un message d'erreur s'affiche
}

/** Sauvegarde de test à partir de paires [mot, définition]. Tous les mots sont à réviser. */
export function makeBackup(entries) {
  return JSON.stringify({
    app: "lexique",
    schemaVersion: 1,
    exportedAt: new Date().toISOString(),
    words: entries.map(([term, definition], index) => ({
      id: `test-${index}`,
      term,
      termKey: term.toLowerCase(),
      definition,
      createdAt: 1000 + index,
      updatedAt: 1000 + index,
      box: 0,
      dueDay: "2000-01-01",
      lapses: 0,
    })),
    reviews: [],
    settings: [],
  });
}

/** Ouvre le formulaire d'ajout d'une catégorie : bouton +, puis choix (« Un mot »…). */
export async function openAddForm(safari, choiceLabel) {
  await safari.clickButton("Ajouter une fiche");
  await safari.waitForText("Ajouter à ta collection");
  await safari.clickButton(choiceLabel);
}

/** Champ de formulaire désigné par le texte de son <label>. */
export async function fieldByLabel(safari, label) {
  const element = await safari.script(
    `const label = [...document.querySelectorAll("[role=dialog] label")].find((l) => l.textContent.trim().startsWith(arguments[0]));
     return label ? document.getElementById(label.htmlFor) : null;`,
    [label],
  );
  if (!element) throw new Error(`Champ « ${label} » introuvable`);
  return Object.values(element)[0];
}

/** Choisit une option d'un sélecteur segmenté (role=radiogroup) désigné par son aria-label. */
export async function chooseSegment(safari, groupLabel, optionLabel) {
  const clicked = await safari.script(
    `const group = document.querySelector('[role=radiogroup][aria-label="' + arguments[0] + '"]');
     const option = group && [...group.querySelectorAll("[role=radio]")].find((o) => o.textContent === arguments[1]);
     if (option) option.click();
     return !!option;`,
    [groupLabel, optionLabel],
  );
  if (!clicked) throw new Error(`Option « ${optionLabel} » de « ${groupLabel} » introuvable`);
}

/**
 * Appareil neuf avec une session de test LOCALE (jeton fictif, valide en apparence) :
 * l'app s'ouvre comme pour un utilisateur connecté, sans dépendre du serveur
 * (la synchronisation échoue proprement). Pour les scénarios qui ne testent pas le serveur.
 */
export async function startLocalSession(safari, appUrl, hash = "") {
  await resetApp(safari, appUrl, "");
  const encode = (value) => Buffer.from(JSON.stringify(value)).toString("base64url");
  const expiresAt = Math.floor(Date.now() / 1000) + 365 * 24 * 3600;
  const userId = "00000000-0000-4000-8000-000000000001";
  const token = `${encode({ alg: "HS256", typ: "JWT" })}.${encode({ sub: userId, role: "authenticated", exp: expiresAt })}.signature-fictive`;
  const session = {
    access_token: token,
    token_type: "bearer",
    expires_in: 365 * 24 * 3600,
    expires_at: expiresAt,
    refresh_token: "jeton-de-test",
    user: { id: userId, email: "test-local@mneme.invalid", aud: "authenticated", role: "authenticated", app_metadata: {}, user_metadata: {} },
  };
  await safari.script("localStorage.clear(); localStorage.setItem('mneme.auth', arguments[0]);", [JSON.stringify(session)]);
  await safari.open(`${appUrl}?test=${Date.now()}${hash}`);
}

/** Lance la révision du jour (bouton « Commencer · N questions »). */
export async function startDailyReview(safari) {
  await safari.waitFor("bouton Commencer", async () =>
    safari.script(`return [...document.querySelectorAll("button")].some((b) => b.textContent.startsWith("Commencer ·"));`),
  );
  await safari.script(`[...document.querySelectorAll("button")].find((b) => b.textContent.startsWith("Commencer ·")).click();`);
}
