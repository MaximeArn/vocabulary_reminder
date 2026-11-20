import { SegmentedControl } from "./SegmentedControl";
import { categoryBorder } from "./categoryBorder";
import styles from "./CategoryToggle.module.css";

export interface CategoryOption {
  value: string;
  label: string;
  /** Couleurs quand l'option est choisie. */
  fill?: string;
  onFill?: string;
  /** « Tout » : un contour aux couleurs des catégories mélangées, au lieu d'un fond. */
  mix?: string[];
}

interface CategoryToggleProps {
  label: string;
  options: CategoryOption[];
  value: string;
  onChange: (value: string) => void;
}

/** Choix d'une catégorie : l'option active porte la couleur de sa catégorie (« Tout » : un contour de toutes). */
export function CategoryToggle({ label, options, value, onChange }: CategoryToggleProps) {
  const active = options.find((option) => option.value === value);
  const colors = {
    "--fill": active?.mix ? categoryBorder(active.mix, "var(--paper)") : active?.fill,
    "--on-fill": active?.mix ? "var(--ink)" : active?.onFill,
  } as React.CSSProperties;
  return (
    <div className={`${styles.toggle} ${active?.mix ? styles.mixed : ""}`} style={colors}>
      <SegmentedControl
        label={label}
        options={Object.fromEntries(options.map((option) => [option.value, option.label]))}
        value={value}
        onChange={onChange}
      />
    </div>
  );
}
