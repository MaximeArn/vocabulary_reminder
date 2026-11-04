import { deleteWord, restoreWord } from "../../data/wordsRepository";
import type { Word } from "../../domain/types";
import { useToast } from "../../ui/Toast";

/**
 * Suppression d'un mot : confirmation préalable, puis « Annuler » possible
 * pendant quelques secondes en filet de sécurité.
 * Renvoie `true` si le mot a été supprimé.
 */
export function useDeleteWord() {
  const showToast = useToast();

  return async (word: Word): Promise<boolean> => {
    if (!window.confirm(`Supprimer « ${word.term} » de ta collection ?`)) return false;
    try {
      const deleted = await deleteWord(word.id);
      showToast({
        message: `« ${word.term} » supprimé`,
        actionLabel: "Annuler",
        onAction: () => {
          restoreWord(deleted).catch(() => showToast({ message: "Impossible de restaurer ce mot." }));
        },
      });
      return true;
    } catch {
      showToast({ message: "La suppression a échoué. Réessaie." });
      return false;
    }
  };
}
