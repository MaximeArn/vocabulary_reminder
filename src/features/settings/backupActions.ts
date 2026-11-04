import { readAllData, replaceAllData } from "../../data/backupRepository";
import { writeSetting } from "../../data/settingsRepository";
import { backupFileName, createBackup, parseBackup, type BackupFile } from "../../domain/backup";

/** Actions de sauvegarde côté appareil : création du fichier, partage, lecture. */

export const LAST_EXPORT_KEY = "backup.lastExportAt";

export type ExportOutcome = "shared" | "downloaded" | "cancelled";

/**
 * Exporte toutes les données dans un fichier JSON.
 *
 * Sur iPhone, la feuille de partage (Web Share API) permet « Enregistrer dans
 * Fichiers » ou iCloud Drive ; le lien de téléchargement est peu fiable en mode
 * installé. Ailleurs, on retombe sur un téléchargement classique.
 */
export async function exportBackup(): Promise<ExportOutcome> {
  const now = new Date();
  const backup = createBackup(await readAllData(), now);
  const file = new File([JSON.stringify(backup, null, 2)], backupFileName(now), { type: "application/json" });

  let outcome: ExportOutcome;
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file] });
      outcome = "shared";
    } catch (error) {
      // L'utilisateur a fermé la feuille de partage : ce n'est pas une erreur.
      if (error instanceof DOMException && error.name === "AbortError") return "cancelled";
      throw error;
    }
  } else {
    downloadFile(file);
    outcome = "downloaded";
  }

  await writeSetting(LAST_EXPORT_KEY, now.getTime());
  return outcome;
}

function downloadFile(file: File): void {
  const url = URL.createObjectURL(file);
  const link = document.createElement("a");
  link.href = url;
  link.download = file.name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Lit un fichier choisi par l'utilisateur ; lève une erreur lisible s'il est invalide. */
export async function readBackupFile(file: File): Promise<BackupFile> {
  const result = parseBackup(await file.text());
  if (!result.ok) throw new Error(result.error);
  return result.backup;
}

export async function restoreBackup(backup: BackupFile): Promise<void> {
  await replaceAllData(backup);
}
