import { useEffect, useRef, useState } from "react";
import { Sheet } from "../../ui/Sheet";
import { useToast } from "../../ui/Toast";
import { createBackupJson, markExported } from "./backupActions";
import styles from "./JsonSheet.module.css";

/** Affiche la sauvegarde en JSON, prête à être copiée. */
export function ExportTextSheet({ onClose }: { onClose: () => void }) {
  const showToast = useToast();
  const textArea = useRef<HTMLTextAreaElement>(null);
  const [json, setJson] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Le JSON est préparé à l'ouverture : au moment du toucher sur « Copier »,
  // il est déjà prêt. Safari iOS refuse d'écrire dans le presse-papiers si une
  // opération asynchrone (lecture de la base) s'intercale après le geste.
  useEffect(() => {
    createBackupJson()
      .then((backup) => setJson(backup.json))
      .catch(() => setError("Impossible de préparer la sauvegarde."));
  }, []);

  const copy = async () => {
    if (json === null) return;
    try {
      await navigator.clipboard.writeText(json);
      await markExported();
      showToast({ message: "Sauvegarde copiée dans le presse-papiers" });
      onClose();
    } catch {
      // Repli : on sélectionne le texte pour une copie manuelle.
      textArea.current?.focus();
      textArea.current?.setSelectionRange(0, json.length);
      showToast({ message: "Copie impossible : le texte est sélectionné, copie-le à la main." });
    }
  };

  return (
    <Sheet title="Export en texte" cancelLabel="Fermer" confirmLabel="Copier" onConfirm={copy} onCancel={onClose} confirmDisabled={json === null}>
      <p className={styles.text}>
        Copie ce texte et colle-le où tu veux (Notes, e-mail…). Pour le restaurer : Importer → Texte.
      </p>
      <textarea
        ref={textArea}
        className={styles.json}
        value={json ?? "Préparation…"}
        readOnly
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
