import { readAllData, replaceAllData } from "../../data/backupRepository";
import type { BackupFile } from "../../domain/backup";
import { formatWordCount } from "../../ui/format";
import { useToast } from "../../ui/Toast";

export type RestoreOutcome = "restored" | "cancelled";

/**
 * Restauration d'une sauvegarde, commune à l'import par fichier et par texte :
 * confirmation si des mots existent, remplacement complet, puis « Annuler »
 * possible pendant quelques secondes. Les erreurs sont relancées à l'appelant.
 */
export function useRestoreBackup() {
  const showToast = useToast();

  return async (backup: BackupFile): Promise<RestoreOutcome> => {
    // Lu dans la base au moment même : sert à la confirmation et à l'annulation.
    const previous = await readAllData();
    const currentCount = previous.items.length;
    const confirmed =
      currentCount === 0 ||
      window.confirm(
        `Remplacer tes ${formatWordCount(currentCount).toLowerCase()} par les ${formatWordCount(backup.items.length).toLowerCase()} de cette sauvegarde ?`,
      );
    if (!confirmed) return "cancelled";

    await replaceAllData(backup);
    showToast({
      message: `${formatWordCount(backup.items.length)} restauré${backup.items.length > 1 ? "s" : ""}`,
      actionLabel: currentCount > 0 ? "Annuler" : undefined,
      onAction: () => {
        replaceAllData(previous).catch(() => showToast({ message: "Impossible d’annuler la restauration." }));
      },
    });
    return "restored";
  };
}
