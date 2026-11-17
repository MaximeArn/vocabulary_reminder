import { useId } from "react";
import styles from "./RevisionRow.module.css";

interface RevisionRowProps {
  icon: React.ReactNode;
  /** Couleur de l'icône (celle de la catégorie) ; sinon, l'icône porte ses propres couleurs. */
  iconColor?: string;
  title: string;
  /** Ce que contient cette révision, ou son état. */
  detail: string;
  /** À droite : un nombre de fiches, une pastille, un chevron… */
  trailing?: React.ReactNode;
  disabled?: boolean;
  /** Ouvre un choix (feuille d'action) plutôt que de lancer directement la révision. */
  opensChoice?: boolean;
  onClick: () => void;
}

/** Un type de révision, dans la liste de la page Réviser. */
export function RevisionRow({ icon, iconColor, title, detail, trailing, disabled, opensChoice, onClick }: RevisionRowProps) {
  const detailId = useId();
  return (
    <li>
      <button
        type="button"
        className={styles.row}
        onClick={onClick}
        disabled={disabled}
        aria-label={title}
        aria-describedby={detailId}
        aria-haspopup={opensChoice ? "dialog" : undefined}
      >
        <span className={styles.icon} style={{ color: iconColor }}>
          {icon}
        </span>
        <span className={styles.text}>
          <span className={styles.title}>{title}</span>
          <span className={styles.detail} id={detailId}>
            {detail}
          </span>
        </span>
        {trailing !== undefined && <span className={styles.trailing}>{trailing}</span>}
      </button>
    </li>
  );
}
