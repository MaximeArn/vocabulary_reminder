import { deleteWord, restoreWord } from "../../data/wordsRepository";
import type { Word } from "../../domain/types";
import { useToast } from "../../ui/Toast";

/**
 * Suppression sans boîte de confirmation, mais annulable pendant quelques
 * secondes : plus rapide au quotidien, et sans risque de perte par erreur.
 */
export function useDeleteWord() {
  const showToast = useToast();

  return async (word: Word): Promise<boolean> => {
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
