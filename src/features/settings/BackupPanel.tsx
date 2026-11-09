import { useRef, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { Button } from "../../ui/Button";
import { SettingsCard } from "../../ui/Section";
import { ActionSheet } from "../../ui/ActionSheet";
import { db } from "../../data/db";
import { addItems } from "../../data/itemsRepository";
import { previewBatch } from "../../categories/batch";
import { unitForKinds } from "../../categories/registry";
import { formatAdded, formatCardCount } from "../../ui/format";
import type { BackupFile } from "../../domain/backup";
import { useToast } from "../../ui/Toast";
import { formatLongDate } from "../../ui/format";
import { readSetting } from "../../data/settingsRepository";
import { useCards } from "../collection/useCards";
import { LAST_EXPORT_KEY, exportBackupFile, parseBackupText } from "./backupActions";
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
  /** Sauvegarde choisie, en attente du choix « ajouter » ou « remplacer ». */
  const [pendingFile, setPendingFile] = useState<{ text: string; backup: BackupFile } | null>(null);
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
    try {
      const text = await file.text();
      setPendingFile({ text, backup: parseBackupText(text) });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Ce fichier est illisible.");
    }
  };

  /** Ajoute les fiches de la sauvegarde absentes de la collection, sans rien supprimer. */
  const addFromFile = async (text: string) => {
    setPendingFile(null);
    setBusy(true);
    try {
      const preview = previewBatch(text, await db.items.toArray());
      const added = preview.entries.length > 0 ? await addItems(preview.entries) : 0;
      const unit = unitForKinds(preview.entries.map((entry) => entry.kind));
      const skipped = preview.duplicates.length > 0 ? ` · ${preview.duplicates.length} déjà présente${preview.duplicates.length > 1 ? "s" : ""}` : "";
      showToast({ message: `${formatAdded(added, unit)}${skipped}` });
    } catch {
      setError("L’ajout a échoué. Rien n’a été modifié.");
    } finally {
      setBusy(false);
    }
  };

  const replaceFromFile = async (backup: BackupFile) => {
    setPendingFile(null);
    setBusy(true);
    try {
      await restore(backup);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "La restauration a échoué.");
    } finally {
      setBusy(false);
    }
  };

  const nothingToExport = cards.length === 0;

  return (
    <SettingsCard title="Copie de sauvegarde" padded>
      <p className={styles.text}>
        Une copie indépendante du serveur, à garder dans Fichiers ou iCloud Drive, ou en texte.
        <br />
        {lastExportAt ? `Dernier export : ${formatLongDate(lastExportAt)}.` : "Aucun export pour l’instant."}
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
      {pendingFile && (
        <ActionSheet
          title={`Sauvegarde de ${formatCardCount(pendingFile.backup.items.length, unitForKinds(pendingFile.backup.items.map((item) => item.kind))).toLowerCase()}`}
          options={[
            { label: "Ajouter à ma collection", onSelect: () => void addFromFile(pendingFile.text) },
            { label: "Remplacer ma collection", onSelect: () => void replaceFromFile(pendingFile.backup) },
          ]}
          onCancel={() => setPendingFile(null)}
        />
      )}
    </SettingsCard>
  );
}
