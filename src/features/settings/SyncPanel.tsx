import { useState, useSyncExternalStore } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../../data/db";
import { Button } from "../../ui/Button";
import { TextField } from "../../ui/TextField";
import { signIn, signOut, syncNow, syncStore, type SyncState } from "../../sync/service";
import styles from "./SyncPanel.module.css";

/**
 * Synchronisation avec le serveur : connexion, état, actions.
 * Facultative : sans compte, l'app fonctionne entièrement sur l'appareil.
 */
export function SyncPanel() {
  const state = useSyncExternalStore(syncStore.subscribe, syncStore.getSnapshot);
  const pending = useLiveQuery(() => db.outbox.count(), []) ?? 0;

  return (
    <section className={styles.panel}>
      <h2 className={styles.heading}>Synchronisation</h2>
      {state.status === "signed-out" ? <SignInForm /> : <SyncStatusView state={state} pending={pending} />}
    </section>
  );
}

function SignInForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await signIn(email, password);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "La connexion a échoué.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <p className={styles.text}>
        Connecte-toi pour sauvegarder tes fiches sur le serveur et les retrouver sur tes autres appareils. Sans compte,
        tout reste sur cet appareil.
      </p>
      {/* Un vrai formulaire : le trousseau iCloud propose d'enregistrer puis de remplir le mot de passe. */}
      <form className={styles.form} onSubmit={submit}>
        <TextField label="E-mail" type="email" name="email" autoComplete="username" autoCapitalize="off" value={email} onChange={setEmail} />
        <TextField
          label="Mot de passe"
          type="password"
          name="password"
          autoComplete="current-password"
          autoCapitalize="off"
          value={password}
          onChange={setPassword}
        />
        {error && (
          <p className={styles.error} role="alert">
            {error}
          </p>
        )}
        <Button type="submit" fullWidth disabled={busy || email.trim() === "" || password === ""}>
          Se connecter
        </Button>
      </form>
    </>
  );
}

function SyncStatusView({ state, pending }: { state: SyncState; pending: number }) {
  const status = describeStatus(state, pending);

  const disconnect = async () => {
    const message = "Te déconnecter ? Tes fiches restent sur cet appareil ; la synchronisation s’arrête.";
    if (window.confirm(message)) await signOut();
  };

  return (
    <>
      <dl className={styles.rows}>
        <div className={styles.row}>
          <dt className={styles.label}>Compte</dt>
          <dd className={styles.value}>{state.email}</dd>
        </div>
        <div className={styles.row}>
          <dt className={styles.label}>État</dt>
          <dd className={`${styles.value} ${status.tone ? styles[status.tone] : ""}`} role="status">
            {status.text}
          </dd>
        </div>
      </dl>
      <div className={styles.actions}>
        <Button variant="secondary" fullWidth onClick={() => void syncNow()} disabled={state.status === "syncing"}>
          Synchroniser maintenant
        </Button>
        <Button variant="quiet" fullWidth onClick={disconnect}>
          Se déconnecter
        </Button>
      </div>
    </>
  );
}

function describeStatus(state: SyncState, pending: number): { text: string; tone?: "good" | "bad" } {
  switch (state.status) {
    case "syncing":
      return { text: "Synchronisation…" };
    case "offline":
      return { text: pending > 0 ? `Hors ligne · ${pending} modification(s) en attente` : "Hors ligne" };
    case "error":
      return { text: state.error ?? "Erreur de synchronisation", tone: "bad" };
    default:
      if (pending > 0) return { text: `${pending} modification(s) en attente` };
      return { text: state.lastSyncedAt ? `À jour · ${formatSince(state.lastSyncedAt)}` : "À jour", tone: "good" };
  }
}

function formatSince(timestamp: number): string {
  const minutes = Math.round((Date.now() - timestamp) / 60000);
  if (minutes < 1) return "à l’instant";
  if (minutes < 60) return `il y a ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `il y a ${hours} h`;
  return new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long" }).format(timestamp);
}
