import { useId } from "react";
import styles from "./TextField.module.css";

interface TextFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  /** Zone de texte sur plusieurs lignes, qui s'agrandit avec le contenu. */
  multiline?: boolean;
  optional?: boolean;
  /** Affiche la saisie en serif (mot, définition). */
  serif?: boolean;
  error?: string;
  hint?: string;
  autoFocus?: boolean;
  /** Identifiant d'une <datalist> de suggestions. */
  suggestionsId?: string;
  autoCapitalize?: "off" | "sentences" | "words";
}

export function TextField({
  label,
  value,
  onChange,
  multiline = false,
  optional = false,
  serif = false,
  error,
  hint,
  autoFocus,
  suggestionsId,
  autoCapitalize = "sentences",
}: TextFieldProps) {
  const id = useId();
  const messageId = `${id}-message`;
  const className = [styles.input, serif && styles.serif, error && styles.invalid].filter(Boolean).join(" ");
  const common = {
    id,
    className,
    value,
    autoFocus,
    autoCapitalize,
    "aria-invalid": error ? true : undefined,
    "aria-describedby": error || hint ? messageId : undefined,
  };

  return (
    <div className={styles.field}>
      <label htmlFor={id} className={styles.label}>
        {label} {optional && <span className={styles.optional}>(facultatif)</span>}
      </label>
      {multiline ? (
        <textarea
          {...common}
          rows={3}
          onChange={(event) => {
            growToContent(event.currentTarget);
            onChange(event.target.value);
          }}
          ref={(element) => {
            if (element) growToContent(element);
          }}
        />
      ) : (
        <input {...common} type="text" list={suggestionsId} autoComplete="off" onChange={(event) => onChange(event.target.value)} />
      )}
      {error ? (
        <p id={messageId} className={styles.error}>
          {error}
        </p>
      ) : (
        hint && (
          <p id={messageId} className={styles.hint}>
            {hint}
          </p>
        )
      )}
    </div>
  );
}

/** Ajuste la hauteur d'une zone de texte à son contenu. */
function growToContent(textarea: HTMLTextAreaElement) {
  textarea.style.height = "auto";
  textarea.style.height = `${textarea.scrollHeight + 2}px`;
}
