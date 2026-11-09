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

/** Simule le choix d'un fichier dans le sélecteur iOS (non pilotable par WebDriver). */
export async function chooseBackupFile(safari, content) {
  await safari.script(
    `const input = document.querySelector("input[type=file]");
     const transfer = new DataTransfer();
     transfer.items.add(new File([arguments[0]], "test.backup.json", { type: "application/json" }));
     input.files = transfer.files;
     input.dispatchEvent(new Event("change", { bubbles: true }));`,
    [content],
  );
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
