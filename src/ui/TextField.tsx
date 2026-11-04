import { useId, useLayoutEffect, useRef } from "react";
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
  /** Donne le focus au champ à son apparition (le clavier s'ouvre sur iPhone). */
  autoFocus?: boolean;
  autoCapitalize?: "off" | "sentences";
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
  autoFocus = false,
  autoCapitalize = "sentences",
}: TextFieldProps) {
  const id = useId();
  const fieldRef = useRef<HTMLInputElement & HTMLTextAreaElement>(null);

  // Plutôt que l'attribut autoFocus : `preventScroll` évite que Safari fasse
  // défiler l'écran vers le champ. Le focus est donné pendant le rendu
  // déclenché par le toucher, condition pour qu'iOS ouvre le clavier.
  useLayoutEffect(() => {
    if (autoFocus) fieldRef.current?.focus({ preventScroll: true });
  }, [autoFocus]);

  const messageId = `${id}-message`;
  const className = [styles.input, serif && styles.serif, error && styles.invalid].filter(Boolean).join(" ");
  const common = {
    id,
    className,
    value,
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
            fieldRef.current = element as (HTMLInputElement & HTMLTextAreaElement) | null;
            if (element) growToContent(element);
          }}
        />
      ) : (
        <input
          {...common}
          ref={fieldRef}
          type="text"
          autoComplete="off"
          onChange={(event) => onChange(event.target.value)}
        />
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
