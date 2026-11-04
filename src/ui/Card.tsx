import styles from "./Card.module.css";

/** Surface claire bordée d'un filet, sans ombre portée. */
export function Card({ children }: { children: React.ReactNode }) {
  return <div className={styles.card}>{children}</div>;
}
