import styles from "./Panel.module.css";

/** Surface claire bordée d'un filet, sans ombre portée. */
export function Panel({ children }: { children: React.ReactNode }) {
  return <div className={styles.panel}>{children}</div>;
}
