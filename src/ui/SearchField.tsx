import { SearchIcon } from "./icons";
import styles from "./SearchField.module.css";

interface SearchFieldProps {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}

export function SearchField({ value, onChange, placeholder }: SearchFieldProps) {
  return (
    <label className={styles.search}>
      <span className={styles.icon}>
        <SearchIcon size={20} />
      </span>
      <input
        className={styles.input}
        type="search"
        enterKeyHint="search"
        autoComplete="off"
        autoCorrect="off"
        aria-label={placeholder}
        placeholder={placeholder}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}
