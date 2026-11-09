import { SegmentedControl } from "../../ui/SegmentedControl";
import { Toggle } from "../../ui/Toggle";
import { MONTHS, type Precision } from "./dates";
import type { DateDraft, Era } from "./model";
import styles from "./DateInput.module.css";

const PRECISION_LABELS: Record<Precision, string> = {
  day: "Jour",
  month: "Mois",
  year: "Année",
  decade: "Décennie",
  century: "Siècle",
};

const ERA_LABELS: Record<Era, string> = {
  bc: "av. J.-C.",
  ad: "apr. J.-C.",
};

interface DateInputProps {
  legend: string;
  value: DateDraft;
  onChange: (value: DateDraft) => void;
  error?: string;
}

/**
 * Saisie d'une date historique : précision, puis seulement les champs utiles.
 * L'année est toujours positive, l'ère est choisie à part (pas d'an 0 possible).
 */
export function DateInput({ legend, value, onChange, error }: DateInputProps) {
  const update = (changes: Partial<DateDraft>) => onChange({ ...value, ...changes });
  const showDay = value.precision === "day";
  const showMonth = value.precision === "day" || value.precision === "month";
  const isCentury = value.precision === "century";

  return (
    <fieldset className={`${styles.group} ${error ? styles.invalid : ""}`}>
      <legend className={styles.legend}>{legend}</legend>
      <SegmentedControl
        label={`Précision — ${legend}`}
        options={PRECISION_LABELS}
        value={value.precision}
        onChange={(precision) => update({ precision })}
      />
      <div className={styles.row}>
        {showDay && (
          <input
            className={`${styles.input} ${styles.day}`}
            inputMode="numeric"
            placeholder="Jour"
            aria-label={`Jour — ${legend}`}
            value={value.day}
            onChange={(event) => update({ day: event.target.value.replace(/\D/g, "") })}
          />
        )}
        {showMonth && (
          <select
            className={`${styles.select} ${styles.month}`}
            aria-label={`Mois — ${legend}`}
            value={value.month}
            onChange={(event) => update({ month: event.target.value })}
          >
            <option value="">Mois</option>
            {MONTHS.map((month, index) => (
              <option key={month} value={String(index + 1)}>
                {month}
              </option>
            ))}
          </select>
        )}
        <input
          className={`${styles.input} ${styles.year}`}
          inputMode="numeric"
          placeholder={isCentury ? "Siècle (ex. 5)" : "Année"}
          aria-label={`${isCentury ? "Siècle" : "Année"} — ${legend}`}
          value={value.year}
          onChange={(event) => update({ year: event.target.value.replace(/\D/g, "") })}
        />
      </div>
      <SegmentedControl label={`Ère — ${legend}`} options={ERA_LABELS} value={value.era} onChange={(era) => update({ era })} />
      <Toggle label="Approximative (« vers »)" checked={value.circa} onChange={(circa) => update({ circa })} />
      {error && <p className={styles.error}>{error}</p>}
    </fieldset>
  );
}
