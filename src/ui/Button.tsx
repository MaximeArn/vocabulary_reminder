import styles from "./Button.module.css";

type ButtonVariant = "primary" | "secondary" | "quiet";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  fullWidth?: boolean;
}

export function Button({ variant = "primary", fullWidth = false, className, ...rest }: ButtonProps) {
  const classes = [styles.button, styles[variant], fullWidth && styles.fullWidth, className]
    .filter(Boolean)
    .join(" ");
  return <button type="button" className={classes} {...rest} />;
}
