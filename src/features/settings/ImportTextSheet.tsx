import { useState } from "react";
import { Sheet } from "../../ui/Sheet";
import { parseBackupText } from "./backupActions";
import { useRestoreBackup } from "./useRestoreBackup";
import styles from "./JsonSheet.module.css";

/** Restauration à partir d'une sauvegarde collée sous forme de texte. */
export function ImportTextSheet({ onClose }: { onClose: () => void }) {
  const restore = useRestoreBackup();
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setError(null);
    setBusy(true);
    try {
      const outcome = await restore(parseBackupText(text));
      if (outcome === "restored") onClose();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "La restauration a échoué.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet title="Import en texte" confirmLabel="Importer" onConfirm={submit} onCancel={onClose} confirmDisabled={busy}>
      <p className={styles.text}>Colle ci-dessous le texte d’une sauvegarde exportée depuis Lexique.</p>
      <textarea
        className={styles.json}
        value={text}
        onChange={(event) => {
          setText(event.target.value);
          setError(null);
        }}
        placeholder="{ &quot;app&quot;: &quot;lexique&quot;, … }"
        autoCapitalize="off"
        autoCorrect="off"
        spellCheck={false}
        aria-label="Sauvegarde au format JSON"
      />
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
    </Sheet>
  );
}
