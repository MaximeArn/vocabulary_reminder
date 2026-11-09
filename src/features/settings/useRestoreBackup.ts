import { readAllData, replaceAllData } from "../../data/backupRepository";
import type { BackupFile } from "../../domain/backup";
import { formatCardCount } from "../../ui/format";
import { unitForKinds } from "../../categories/registry";
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
    const describe = (items: { kind: string }[]) =>
      formatCardCount(items.length, unitForKinds(items.map((item) => item.kind))).toLowerCase();
    const restoredCount = formatCardCount(backup.items.length, unitForKinds(backup.items.map((item) => item.kind)));
    const confirmed =
      currentCount === 0 ||
      window.confirm(
        `Remplacer tes ${describe(previous.items)} par les ${describe(backup.items)} de cette sauvegarde ?`,
      );
    if (!confirmed) return "cancelled";

    await replaceAllData(backup);
    showToast({
      // « 3 mots restaurés », « 2 dates restaurées »
      message: `${restoredCount} ${restoredLabel(backup.items.map((item) => item.kind), backup.items.length)}`,
      actionLabel: currentCount > 0 ? "Annuler" : undefined,
      onAction: () => {
        replaceAllData(previous).catch(() => showToast({ message: "Impossible d’annuler la restauration." }));
      },
    });
    return "restored";
  };
}

/** Accord du participe : « dates » et « fiches » sont féminins, « mots » masculin. */
function restoredLabel(kinds: string[], count: number): string {
  const feminine = unitForKinds(kinds).plural !== "mots";
  return `restauré${feminine ? "e" : ""}${count > 1 ? "s" : ""}`;
}
