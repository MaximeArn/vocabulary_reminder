import { createPortal } from "react-dom";
import styles from "./ActionSheet.module.css";

export interface ActionSheetOption {
  label: string;
  onSelect: () => void;
}

interface ActionSheetProps {
  title: string;
  options: ActionSheetOption[];
  onCancel: () => void;
}

/** Menu de choix en bas de l'écran, à la manière des feuilles d'action iOS. */
export function ActionSheet({ title, options, onCancel }: ActionSheetProps) {
  return createPortal(
    <>
      <div className={styles.backdrop} onClick={onCancel} />
      <div className={styles.sheet} role="dialog" aria-modal="true" aria-label={title}>
        <div className={styles.group}>
          <p className={styles.title}>{title}</p>
          {options.map((option) => (
            <button key={option.label} type="button" className={styles.option} onClick={option.onSelect}>
              {option.label}
            </button>
          ))}
        </div>
        <button type="button" className={styles.cancel} onClick={onCancel}>
          Annuler
        </button>
      </div>
    </>,
    document.body,
  );
}
