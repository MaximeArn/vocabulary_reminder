import { createPortal } from "react-dom";
import styles from "./Sheet.module.css";

interface SheetProps {
  title: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  confirmDisabled?: boolean;
  children: React.ReactNode;
}

/**
 * Feuille modale qui monte du bas de l'écran, avec Annuler / Valider en haut,
 * comme les feuilles natives d'iOS.
 */
export function Sheet({ title, confirmLabel, onConfirm, onCancel, confirmDisabled, children }: SheetProps) {
  // Rendue dans <body> : un parent animé (transform) fausserait le positionnement fixe.
  return createPortal(
    <>
      <div className={styles.backdrop} onClick={onCancel} />
      <div className={styles.sheet} role="dialog" aria-modal="true" aria-label={title}>
        <header className={styles.header}>
          <button type="button" className={styles.cancel} onClick={onCancel}>
            Annuler
          </button>
          <h2 className={styles.title}>{title}</h2>
          <button type="button" className={styles.confirm} onClick={onConfirm} disabled={confirmDisabled}>
            {confirmLabel}
          </button>
        </header>
        <div className={styles.body}>{children}</div>
      </div>
    </>,
    document.body,
  );
}
