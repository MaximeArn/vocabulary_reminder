import styles from "./InfoList.module.css";

/** Liste de paires libellé / valeur, regroupées sous un intitulé. */

export type InfoTone = "neutral" | "good" | "bad";

export interface InfoRow {
  label: string;
  value: string;
  tone?: InfoTone;
}

interface InfoListProps {
  /** Titre au-dessus de la liste (absent quand la liste est dans une carte de section). */
  heading?: string;
  rows: InfoRow[];
  /** Contenu affiché sous la liste (bouton d'action…). */
  footer?: React.ReactNode;
}

export function InfoList({ heading, rows, footer }: InfoListProps) {
  return (
    <section className={heading ? styles.group : undefined}>
      {heading && <h2 className={styles.heading}>{heading}</h2>}
      <dl className={heading ? styles.list : styles.cardList}>
        {rows.map((row) => (
          <div key={row.label} className={styles.row}>
            <dt className={styles.label}>{row.label}</dt>
            <dd className={`${styles.value} ${row.tone && row.tone !== "neutral" ? styles[row.tone] : ""}`}>
              {row.value}
            </dd>
          </div>
        ))}
      </dl>
      {footer && <div className={styles.footer}>{footer}</div>}
    </section>
  );
}
