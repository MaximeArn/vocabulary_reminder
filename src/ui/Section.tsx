import { ChevronRightIcon } from "./icons";
import settingsStyles from "./SettingsCard.module.css";
import styles from "./Section.module.css";

interface SectionProps {
  title: string;
  icon?: React.ReactNode;
  /** Note discrète sous la section. */
  footnote?: React.ReactNode;
  /** Repliée par défaut (informations secondaires). */
  collapsible?: boolean;
  children: React.ReactNode;
}

/** Section de réglages : un titre (avec icône) et une ou plusieurs cartes. */
export function Section({ title, icon, footnote, collapsible = false, children }: SectionProps) {
  const header = (
    <span className={styles.header}>
      {icon}
      <span className={styles.title}>{title}</span>
      {collapsible && (
        <span className={styles.chevron}>
          <ChevronRightIcon size={18} />
        </span>
      )}
    </span>
  );
  const body = (
    <>
      <div className={styles.cards}>{children}</div>
      {footnote && <p className={styles.footnote}>{footnote}</p>}
    </>
  );

  if (collapsible) {
    return (
      <details className={`${styles.section} ${styles.collapsible}`}>
        <summary>{header}</summary>
        {body}
      </details>
    );
  }
  return (
    <section className={styles.section}>
      <h2 className={styles.heading}>{header}</h2>
      {body}
    </section>
  );
}

/** Carte d'une section, avec un titre facultatif. */
export function SettingsCard({ title, padded = false, children }: { title?: string; padded?: boolean; children: React.ReactNode }) {
  return (
    <div className={`${settingsStyles.card} ${padded ? settingsStyles.padded : ""}`}>
      {title && <h3 className={settingsStyles.title}>{title}</h3>}
      {children}
    </div>
  );
}
