import styles from "./Placeholder.module.css";

/** Texte d'attente pour les écrans pas encore développés. */
export function Placeholder({ children }: { children: React.ReactNode }) {
  return <p className={styles.placeholder}>{children}</p>;
}
