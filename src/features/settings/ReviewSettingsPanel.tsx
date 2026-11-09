import { SESSION_SIZES } from "../../domain/session";
import { CATEGORIES } from "../../categories/registry";
import { SegmentedControl } from "../../ui/SegmentedControl";
import { SettingsCard } from "../../ui/Section";
import { useReviewSettings } from "../review/useReviewSettings";
import styles from "./ReviewSettingsPanel.module.css";

const SIZE_OPTIONS = Object.fromEntries(SESSION_SIZES.map((size) => [String(size), String(size)]));

/** Taille des sessions et type de question, catégorie par catégorie. */
export function ReviewSettingsPanel() {
  const { sessionSize, setSessionSize, exercisePreference, setExercisePreference } = useReviewSettings();
  return (
    <SettingsCard>
      <div className={styles.row}>
        <span className={styles.label}>Questions par session</span>
        <SegmentedControl
          label="Questions par session"
          options={SIZE_OPTIONS}
          value={String(sessionSize)}
          onChange={(value) => setSessionSize(Number(value))}
        />
      </div>
      {CATEGORIES.filter((category) => category.exercises.length > 1).map((category) => {
        const options: Record<string, string> = {
          mixed: "Les deux",
          ...Object.fromEntries(category.exercises.map((exercise) => [exercise.id, exercise.label])),
        };
        const value = exercisePreference(category.kind);
        return (
          <div key={category.kind} className={styles.row}>
            <span className={styles.label}>
              <span className={styles.dot} style={{ background: category.color }} aria-hidden="true" />
              {category.label} : retrouver
            </span>
            <SegmentedControl
              label={`${category.label} : retrouver`}
              options={options}
              value={value in options ? value : "mixed"}
              onChange={(preference) => setExercisePreference(category.kind, preference)}
            />
          </div>
        );
      })}
    </SettingsCard>
  );
}
