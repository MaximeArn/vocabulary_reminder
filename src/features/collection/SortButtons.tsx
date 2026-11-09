import { SORT_KEY_LABELS, type CardSort, type SortDirection, type SortKey } from "../../domain/collection";
import styles from "./SortButtons.module.css";

interface SortButtonsProps {
  /** Critères proposés, avec le sens appliqué quand on les choisit. */
  options: { key: SortKey; direction: SortDirection }[];
  value: CardSort;
  onChange: (sort: CardSort) => void;
}

const ARROWS: Record<SortDirection, string> = { asc: "↑", desc: "↓" };

/**
 * Boutons de tri à bascule : toucher le critère actif inverse son sens,
 * toucher l'autre critère le choisit.
 */
export function SortButtons({ options, value, onChange }: SortButtonsProps) {
  return (
    <div className={styles.buttons} role="group" aria-label="Trier">
      {options.map((option) => {
        const active = option.key === value.key;
        const direction = active ? value.direction : option.direction;
        return (
          <button
            key={option.key}
            type="button"
            className={`${styles.button} ${active ? styles.active : ""}`}
            aria-pressed={active}
            onClick={() =>
              onChange(active ? { key: value.key, direction: value.direction === "asc" ? "desc" : "asc" } : { key: option.key, direction })
            }
          >
            {SORT_KEY_LABELS[option.key]} {ARROWS[direction]}
          </button>
        );
      })}
    </div>
  );
}
