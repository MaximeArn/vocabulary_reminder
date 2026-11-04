import { SESSION_SIZES } from "../../domain/session";
import { SegmentedControl } from "../../ui/SegmentedControl";
import { useReviewSettings } from "../review/useReviewSettings";
import styles from "./ReviewSettingsPanel.module.css";

const SIZE_OPTIONS = Object.fromEntries(SESSION_SIZES.map((size) => [String(size), String(size)]));

export function ReviewSettingsPanel() {
  const { sessionSize, setSessionSize } = useReviewSettings();
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
    </section>
  );
}
