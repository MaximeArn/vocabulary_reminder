import { SegmentedControl } from "./SegmentedControl";
import styles from "./CategoryToggle.module.css";

export interface CategoryOption {
  value: string;
  label: string;
  /** Couleurs quand l'option est choisie ; absentes pour « Tout » (encre). */
  fill?: string;
  onFill?: string;
}

interface CategoryToggleProps {
  label: string;
  options: CategoryOption[];
  value: string;
  onChange: (value: string) => void;
}

/** Choix d'une catégorie : l'option active porte la couleur de sa catégorie. */
export function CategoryToggle({ label, options, value, onChange }: CategoryToggleProps) {
  const active = options.find((option) => option.value === value);
  const colors = { "--fill": active?.fill, "--on-fill": active?.onFill } as React.CSSProperties;
  return (
    <div className={styles.toggle} style={colors}>
      <SegmentedControl
        label={label}
        options={Object.fromEntries(options.map((option) => [option.value, option.label]))}
        value={value}
        onChange={onChange}
      />
    </div>
  );
}
