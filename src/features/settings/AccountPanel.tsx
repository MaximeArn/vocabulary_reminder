import { useState, useSyncExternalStore } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../../data/db";
import { Button } from "../../ui/Button";
import { pendingChanges, signOut, syncNow, syncStore, type SyncState } from "../../sync/service";
import styles from "./AccountPanel.module.css";

/** Compte ouvert sur l'appareil et état de la synchronisation (automatique). */
export function AccountPanel() {
  const state = useSyncExternalStore(syncStore.subscribe, syncStore.getSnapshot);
  const pending = useLiveQuery(() => db.outbox.count(), []) ?? 0;
  const [error, setError] = useState<string | null>(null);
  const status = describeStatus(state, pending);
  const hasProblem = state.status === "error" || (state.status === "offline" && pending > 0);

  const disconnect = async () => {
    setError(null);
    // Dernière chance d'envoyer ce qui reste avant d'effacer l'appareil.
    if ((await pendingChanges()) > 0) await syncNow();
    const unsent = await pendingChanges();
    const message =
      unsent > 0
        ? `${unsent} modification(s) n’ont pas pu être envoyées au serveur et seront perdues. Te déconnecter quand même ?`
        : "Te déconnecter ? Tes fiches restent sur le serveur ; elles seront effacées de cet appareil.";
    if (!window.confirm(message)) return;
    try {
      await signOut();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "La déconnexion a échoué.");
    }
  };

  return (
    <section className={styles.panel}>
      <h2 className={styles.heading}>Compte</h2>
      <dl className={styles.rows}>
        <div className={styles.row}>
          <dt className={styles.label}>E-mail</dt>
          <dd className={styles.value}>{state.email}</dd>
        </div>
        <div className={styles.row}>
          <dt className={styles.label}>Synchronisation</dt>
          <dd className={`${styles.value} ${status.tone ? styles[status.tone] : ""}`} role="status">
            {status.text}
          </dd>
        </div>
      </dl>
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
      <div className={styles.actions}>
        {hasProblem && (
          <Button variant="secondary" fullWidth onClick={() => void syncNow()}>
            Réessayer
          </Button>
        )}
        <Button variant="quiet" fullWidth onClick={disconnect}>
          Se déconnecter
        </Button>
      </div>
    </section>
  );
}

function describeStatus(state: SyncState, pending: number): { text: string; tone?: "good" | "bad" } {
  switch (state.status) {
    case "syncing":
      return { text: "En cours…" };
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
