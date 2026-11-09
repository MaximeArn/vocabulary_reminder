import { SESSION_SIZES } from "../../domain/session";
import { CATEGORIES } from "../../categories/registry";
import { SegmentedControl } from "../../ui/SegmentedControl";
import { useReviewSettings } from "../review/useReviewSettings";
import styles from "./ReviewSettingsPanel.module.css";

const SIZE_OPTIONS = Object.fromEntries(SESSION_SIZES.map((size) => [String(size), String(size)]));

export function ReviewSettingsPanel() {
  const { sessionSize, setSessionSize, exercisePreference, setExercisePreference } = useReviewSettings();
  return (
    <section className={styles.panel}>
      <h2 className={styles.heading}>Révision</h2>
      <div className={styles.row}>
        <span className={styles.label}>Questions par session</span>
        <SegmentedControl
          label="Questions par session"
          options={SIZE_OPTIONS}
          value={String(sessionSize)}
          onChange={(value) => setSessionSize(Number(value))}
        />
      </div>
      {/* Type de question par catégorie : un sens imposé, ou les deux en alternance. */}
      {CATEGORIES.filter((category) => category.exercises.length > 1).map((category) => {
        const options: Record<string, string> = {
          mixed: "Les deux",
          ...Object.fromEntries(category.exercises.map((exercise) => [exercise.id, exercise.label])),
        };
        const value = exercisePreference(category.kind);
        return (
          <div key={category.kind} className={styles.row}>
            <span className={styles.label}>{category.label} : retrouver</span>
            <SegmentedControl
              label={`${category.label} : retrouver`}
              options={options}
              value={value in options ? value : "mixed"}
              onChange={(preference) => setExercisePreference(category.kind, preference)}
            />
          </div>
        );
      })}
    </section>
  );
}
