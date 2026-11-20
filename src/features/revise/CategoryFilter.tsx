import { CategoryToggle } from "../../ui/CategoryToggle";
import type { AnyCategory } from "../../categories/registry";
import styles from "./CategoryFilter.module.css";

/**
 * Catégorie choisie (Réviser, Progrès), d'après le réglage partagé par les deux pages :
 * « all » si rien n'est choisi ou si la catégorie choisie n'a plus de fiches.
 * `category` : celle choisie, ou la seule présente ; absente si « Tout » en mélange plusieurs.
 */
export function chosenCategory(categories: AnyCategory[], filter: string) {
  const kind = categories.some((category) => category.kind === filter) ? filter : "all";
  const category = categories.find((candidate) => candidate.kind === kind) ?? (categories.length === 1 ? categories[0] : undefined);
  return { kind, category };
}

interface CategoryFilterProps {
  label: string;
  categories: AnyCategory[];
  value: string;
  onChange: (kind: string) => void;
}

/** « Tout » (contour aux couleurs de toutes les catégories) ou une catégorie (sa couleur) ; seulement s'il y en a plusieurs. */
export function CategoryFilter({ label, categories, value, onChange }: CategoryFilterProps) {
  if (categories.length < 2) return null;
  return (
    <div className={styles.filter}>
      <CategoryToggle
        label={label}
        options={[
          { value: "all", label: "Tout", mix: categories.map((category) => category.color) },
          ...categories.map((category) => ({
            value: category.kind,
            label: category.label,
            fill: category.fillColor,
            onFill: category.onFillColor,
          })),
        ]}
        value={value}
        onChange={onChange}
      />
    </div>
  );
}
