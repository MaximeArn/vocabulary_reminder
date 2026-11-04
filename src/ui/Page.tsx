import { createPortal } from "react-dom";
import { ChevronLeftIcon } from "./icons";
import styles from "./Page.module.css";

interface PageProps {
  /** Libellé du bouton retour (nom de l'écran précédent). */
  backLabel: string;
  onBack: () => void;
  children: React.ReactNode;
}

/**
 * Écran secondaire affiché par-dessus l'écran courant.
 * L'écran du dessous reste monté : sa position de défilement est conservée.
 */
export function Page({ backLabel, onBack, children }: PageProps) {
  // Rendue dans <body> : un parent animé (transform) fausserait le positionnement fixe.
  return createPortal(
    <div className={styles.page} role="dialog" aria-modal="true">
      <div className={styles.bar}>
        <button type="button" className={styles.back} onClick={onBack}>
          <ChevronLeftIcon />
          {backLabel}
        </button>
      </div>
      <div className={styles.content}>{children}</div>
    </div>,
    document.body,
  );
}
