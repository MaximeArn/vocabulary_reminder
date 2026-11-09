import { useRef, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { Button } from "../../ui/Button";
import { useToast } from "../../ui/Toast";
import { formatLongDate } from "../../ui/format";
import { readSetting } from "../../data/settingsRepository";
import { useCards } from "../collection/useCards";
import { LAST_EXPORT_KEY, exportBackupFile, readBackupFile } from "./backupActions";
import { useRestoreBackup } from "./useRestoreBackup";
import { ExportTextSheet } from "./ExportTextSheet";
import { ImportTextSheet } from "./ImportTextSheet";
import styles from "./BackupPanel.module.css";

type OpenSheet = "export-text" | "import-text" | null;

/**
 * Sauvegarde et restauration, par fichier ou par texte (copier / coller).
 * Les données ne vivent que sur l'iPhone : exporter régulièrement est la seule
 * protection contre une perte (suppression de l'icône, changement d'appareil…).
 */
export function BackupPanel() {
  const cards = useCards() ?? [];
  const lastExportAt = useLiveQuery(() => readSetting<number>(LAST_EXPORT_KEY), []);
  const showToast = useToast();
  const restore = useRestoreBackup();
  const fileInput = useRef<HTMLInputElement>(null);
  const [openSheet, setOpenSheet] = useState<OpenSheet>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const exportFile = async () => {
    setError(null);
    setBusy(true);
    try {
      const outcome = await exportBackupFile();
      if (outcome !== "cancelled") showToast({ message: "Sauvegarde créée" });
    } catch {
      setError("L’export a échoué. Réessaie.");
    } finally {
      setBusy(false);
    }
  };

  const importFile = async (file: File) => {
    setError(null);
    setBusy(true);
    try {
      await restore(await readBackupFile(file));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "La restauration a échoué.");
    } finally {
      setBusy(false);
    }
  };

  const nothingToExport = cards.length === 0;

  return (
    <section className={styles.panel}>
      <h2 className={styles.heading}>Sauvegarde</h2>
      <p className={styles.text}>
        Tes mots ne sont enregistrés que sur cet appareil. Exporte-les régulièrement : en fichier (Fichiers, iCloud
        Drive) ou en texte à coller où tu veux.
        <br />
        {lastExportAt ? `Dernière sauvegarde : ${formatLongDate(lastExportAt)}.` : "Aucune sauvegarde pour l’instant."}
      </p>

      <div className={styles.row}>
        <span className={styles.rowLabel}>Exporter</span>
        <Button variant="secondary" onClick={exportFile} disabled={busy || nothingToExport} aria-label="Exporter dans un fichier">
          Fichier
        </Button>
        <Button
          variant="secondary"
          onClick={() => setOpenSheet("export-text")}
          disabled={busy || nothingToExport}
          aria-label="Exporter en texte"
        >
          Texte
        </Button>
      </div>
      <div className={styles.row}>
        <span className={styles.rowLabel}>Importer</span>
        <Button variant="secondary" onClick={() => fileInput.current?.click()} disabled={busy} aria-label="Importer un fichier">
          Fichier
        </Button>
        <Button variant="secondary" onClick={() => setOpenSheet("import-text")} disabled={busy} aria-label="Importer du texte">
          Texte
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
          if (file) importFile(file);
        }}
      />
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}

      {openSheet === "export-text" && <ExportTextSheet onClose={() => setOpenSheet(null)} />}
      {openSheet === "import-text" && <ImportTextSheet onClose={() => setOpenSheet(null)} />}
    </section>
  );
}
