import { recordLaunch } from "../data/launchLog";
import { requestPersistentStorage } from "../pwa/storageStatus";
import { startSyncService } from "../sync/service";

/** Tâches lancées au démarrage, sans bloquer l'affichage. */
export function runStartupTasks(): void {
  requestPersistentStorage();
  recordLaunch().catch((error) => console.error("Impossible d'enregistrer le lancement", error));
  startSyncService();
}
