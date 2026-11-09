import styles from "./SegmentedControl.module.css";

interface SegmentedControlProps<T extends string> {
  label: string;
  /** Options proposées (un sous-ensemble des valeurs possibles). */
  options: Partial<Record<T, string>>;
  value: T;
  onChange: (value: T) => void;
}

/** Choix exclusif entre quelques options courtes (tri, filtre…). */
export function SegmentedControl<T extends string>({ label, options, value, onChange }: SegmentedControlProps<T>) {
  const entries = Object.entries(options) as [T, string][];
  return (
    <div className={styles.control} role="radiogroup" aria-label={label}>
      {entries.map(([option, optionLabel]) => (
        <button
          key={option}
          type="button"
          role="radio"
          aria-checked={option === value}
          className={`${styles.option} ${option === value ? styles.selected : ""}`}
          onClick={() => onChange(option)}
        >
          {optionLabel}
        </button>
      ))}
    </div>
  );
}
