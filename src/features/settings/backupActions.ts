import { readAllData } from "../../data/backupRepository";
import { writeSetting } from "../../data/settingsRepository";
import { backupFileName, createBackup, parseBackup, type BackupFile } from "../../domain/backup";

/** Actions de sauvegarde côté appareil : création du JSON, fichier, lecture. */

export const LAST_EXPORT_KEY = "backup.lastExportAt";

/** Sauvegarde complète, sous forme de texte JSON lisible. */
export async function createBackupJson(): Promise<{ json: string; fileName: string }> {
  const now = new Date();
  const backup = createBackup(await readAllData(), now);
  return { json: JSON.stringify(backup, null, 2), fileName: backupFileName(now) };
}

/** Mémorise la date du dernier export (affichée dans les Réglages). */
export async function markExported(): Promise<void> {
  await writeSetting(LAST_EXPORT_KEY, Date.now());
}

export type ExportOutcome = "shared" | "downloaded" | "cancelled";

/**
 * Exporte toutes les données dans un fichier JSON.
 *
 * Sur iPhone, la feuille de partage (Web Share API) permet « Enregistrer dans
 * Fichiers » ou iCloud Drive ; le lien de téléchargement est peu fiable en mode
 * installé. Ailleurs, on retombe sur un téléchargement classique.
 */
export async function exportBackupFile(): Promise<ExportOutcome> {
  const { json, fileName } = await createBackupJson();
  const file = new File([json], fileName, { type: "application/json" });

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

  await markExported();
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

/** Lit une sauvegarde collée sous forme de texte ; lève une erreur lisible si elle est invalide. */
export function parseBackupText(text: string): BackupFile {
  if (text.trim() === "") throw new Error("Colle d’abord le contenu d’une sauvegarde.");
  const result = parseBackup(text);
  if (!result.ok) throw new Error(result.error);
  return result.backup;
}

/** Lit un fichier de sauvegarde ; lève une erreur lisible s'il est invalide. */
export async function readBackupFile(file: File): Promise<BackupFile> {
  return parseBackupText(await file.text());
}
