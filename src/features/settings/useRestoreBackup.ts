import { readAllData, replaceAllData } from "../../data/backupRepository";
import type { BackupFile } from "../../domain/backup";
import { formatCardCount } from "../../ui/format";
import { findCategory, unitForKinds } from "../../categories/registry";
import { refreshBuiltInItems } from "../../sync/service";
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
    // Les fiches intégrées (départements) ne comptent pas : elles font partie de l'app.
    const added = <T extends { kind: string }>(items: T[]) => items.filter((item) => !findCategory(item.kind)?.builtIn);
    const currentCount = added(previous.items).length;
    const describe = (items: { kind: string }[]) =>
      formatCardCount(items.length, unitForKinds(items.map((item) => item.kind))).toLowerCase();
    const restoredCount = formatCardCount(backup.items.length, unitForKinds(backup.items.map((item) => item.kind)));
    const confirmed =
      currentCount === 0 ||
      window.confirm(
        `Remplacer tes ${describe(added(previous.items))} par les ${describe(backup.items)} de cette sauvegarde ?`,
      );
    if (!confirmed) return "cancelled";

    await replaceAllData(withBuiltInProgress(backup, previous));
    // Départements absents de la sauvegarde et de l'appareil : recréés tout de suite.
    refreshBuiltInItems();
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

/** Accord du participe selon l'unité : « mots restaurés », « dates restaurées ». */
function restoredLabel(kinds: string[], count: number): string {
  const feminine = !unitForKinds(kinds).masculine;
  return `restauré${feminine ? "e" : ""}${count > 1 ? "s" : ""}`;
}

/**
 * Une sauvegarde sans fiches d'une catégorie intégrée (ancienne sauvegarde, d'avant
 * la géographie) ne doit pas effacer la progression de cette catégorie : on garde
 * les fiches et l'historique actuels de cette catégorie.
 */
function withBuiltInProgress(backup: BackupFile, previous: Awaited<ReturnType<typeof readAllData>>): BackupFile {
  const builtInKinds = [...new Set(previous.items.map((item) => item.kind))].filter((kind) => findCategory(kind)?.builtIn);
  const missing = new Set(builtInKinds.filter((kind) => !backup.items.some((item) => item.kind === kind)));
  if (missing.size === 0) return backup;
  const keptItems = previous.items.filter((item) => missing.has(item.kind));
  const keptIds = new Set(keptItems.map((item) => item.id));
  return {
    ...backup,
    items: [...backup.items, ...keptItems],
    reviews: [...backup.reviews, ...previous.reviews.filter((review) => keptIds.has(review.itemId))],
  };
}
