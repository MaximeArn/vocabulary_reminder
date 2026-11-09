import { deleteItem, restoreItem } from "../../data/itemsRepository";
import type { Item } from "../../domain/types";
import { findCategory } from "../../categories/registry";
import { useToast } from "../../ui/Toast";

/**
 * Suppression d'une fiche : confirmation préalable, puis « Annuler » possible
 * pendant quelques secondes en filet de sécurité.
 * Renvoie `true` si la fiche a été supprimée.
 */
export function useDeleteItem() {
  const showToast = useToast();

  return async (item: Item): Promise<boolean> => {
    const title = findCategory(item.kind)?.title(item.content) ?? "cette fiche";
    if (!window.confirm(`Supprimer « ${title} » de ta collection ?`)) return false;
    try {
      await deleteItem(item.id);
      showToast({
        message: `« ${title} » supprimé`,
        actionLabel: "Annuler",
        onAction: () => {
          restoreItem(item.id).catch(() => showToast({ message: "Impossible de restaurer cette fiche." }));
        },
      });
      return true;
    } catch {
      showToast({ message: "La suppression a échoué. Réessaie." });
      return false;
    }
  };
}
