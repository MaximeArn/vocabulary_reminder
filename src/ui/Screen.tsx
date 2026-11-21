import styles from "./Screen.module.css";

interface ScreenProps {
  title: string;
  /** Petite ligne au-dessus du titre (date, contexte…). */
  eyebrow?: string;
  children?: React.ReactNode;
  /** L'écran tient dans la hauteur disponible, sans défiler : son dernier élément prend la place restante. */
  fill?: boolean;
}

/** Mise en page commune à tous les écrans : marges, zones sûres, titre. */
export function Screen({ title, eyebrow, children, fill = false }: ScreenProps) {
  return (
    <div className={`${styles.screen} ${fill ? styles.fill : ""}`}>
      <header className={styles.header}>
        {eyebrow && <p className={styles.eyebrow}>{eyebrow}</p>}
        <h1 className={styles.title}>{title}</h1>
      </header>
      {children}
    </div>
  );
}
