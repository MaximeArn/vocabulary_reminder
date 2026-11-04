import styles from "./Screen.module.css";

interface ScreenProps {
  title: string;
  /** Petite ligne au-dessus du titre (date, contexte…). */
  eyebrow?: string;
  children: React.ReactNode;
}

/** Mise en page commune à tous les écrans : marges, zones sûres, titre. */
export function Screen({ title, eyebrow, children }: ScreenProps) {
  return (
    <div className={styles.screen}>
      <header className={styles.header}>
        {eyebrow && <p className={styles.eyebrow}>{eyebrow}</p>}
        <h1 className={styles.title}>{title}</h1>
      </header>
      {children}
    </div>
  );
}
