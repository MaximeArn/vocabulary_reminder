import { useRef, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { Button } from "../../ui/Button";
import { useToast } from "../../ui/Toast";
import { formatLongDate, formatWordCount } from "../../ui/format";
import { readSetting } from "../../data/settingsRepository";
import { readAllData, replaceAllData } from "../../data/backupRepository";
import { useWords } from "../words/useWords";
import { LAST_EXPORT_KEY, exportBackup, readBackupFile, restoreBackup } from "./backupActions";
import styles from "./BackupPanel.module.css";

/**
 * Sauvegarde et restauration.
 * Les données ne vivent que sur l'iPhone : exporter régulièrement est la seule
 * protection contre une perte (suppression de l'icône, changement d'appareil…).
 */
export function BackupPanel() {
  const words = useWords() ?? [];
  const lastExportAt = useLiveQuery(() => readSetting<number>(LAST_EXPORT_KEY), []);
  const showToast = useToast();
  const fileInput = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const exportWords = async () => {
    setError(null);
    setBusy(true);
    try {
      const outcome = await exportBackup();
      if (outcome !== "cancelled") showToast({ message: "Sauvegarde créée" });
    } catch {
      setError("L’export a échoué. Réessaie.");
    } finally {
      setBusy(false);
    }
  };

  const restoreFromFile = async (file: File) => {
    setError(null);
    setBusy(true);
    try {
      const backup = await readBackupFile(file);
      const confirmed =
        words.length === 0 ||
        window.confirm(
          `Remplacer tes ${formatWordCount(words.length).toLowerCase()} par les ${formatWordCount(backup.words.length).toLowerCase()} de cette sauvegarde ?`,
        );
      if (!confirmed) return;

      // Copie des données actuelles, pour pouvoir annuler juste après.
      const previous = await readAllData();
      await restoreBackup(backup);
      showToast({
        message: `${formatWordCount(backup.words.length)} restauré${backup.words.length > 1 ? "s" : ""}`,
        actionLabel: words.length > 0 ? "Annuler" : undefined,
        onAction: () => {
          replaceAllData(previous).catch(() => showToast({ message: "Impossible d’annuler la restauration." }));
        },
      });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "La restauration a échoué.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className={styles.panel}>
      <h2 className={styles.heading}>Sauvegarde</h2>
      <p className={styles.text}>
        Tes mots ne sont enregistrés que sur cet appareil. Exporte-les régulièrement dans Fichiers ou iCloud Drive.
        <br />
        {lastExportAt ? `Dernière sauvegarde : ${formatLongDate(lastExportAt)}.` : "Aucune sauvegarde pour l’instant."}
      </p>
      <div className={styles.actions}>
        <Button variant="secondary" fullWidth onClick={exportWords} disabled={busy || words.length === 0}>
          Exporter mes mots
        </Button>
        <Button variant="quiet" fullWidth onClick={() => fileInput.current?.click()} disabled={busy}>
          Restaurer une sauvegarde
        </Button>
      </div>
      <input
        ref={fileInput}
        className={styles.fileInput}
        type="file"
        accept=".json,application/json"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = ""; // permet de rechoisir le même fichier
          if (file) restoreFromFile(file);
        }}
      />
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
