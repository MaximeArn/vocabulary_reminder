import { Component, type ErrorInfo, type ReactNode } from "react";
import { Button } from "../ui/Button";
import { exportBackup } from "../features/settings/backupActions";
import styles from "./ErrorBoundary.module.css";

interface State {
  error: Error | null;
}

/**
 * Dernier filet de sécurité : si l'interface plante, on affiche un message
 * plutôt qu'un écran blanc, avec un export de secours des données.
 */
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Erreur d'interface", error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className={styles.fallback}>
        <h1 className={styles.title}>Une erreur est survenue</h1>
        <p className={styles.text}>Tes mots ne sont pas perdus : ils restent enregistrés sur l’appareil.</p>
        <pre className={styles.detail}>{this.state.error.message}</pre>
        <Button onClick={() => window.location.reload()}>Relancer l’app</Button>
        <Button variant="secondary" onClick={() => exportBackup().catch(() => alert("L’export a échoué."))}>
          Exporter mes données
        </Button>
      </div>
    );
  }
}
