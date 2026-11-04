import { useServiceWorker } from "./useServiceWorker";
import styles from "./UpdateBanner.module.css";

/** Propose d'installer une nouvelle version, sans jamais l'imposer. */
export function UpdateBanner() {
  const { updateAvailable, installUpdate, dismissUpdate } = useServiceWorker();
  if (!updateAvailable) return null;

  return (
    <div className={styles.banner} role="status">
      <span className={styles.text}>Nouvelle version prête.</span>
      <button type="button" className={styles.action} onClick={dismissUpdate}>
        Plus tard
      </button>
      <button type="button" className={styles.action} onClick={installUpdate}>
        Mettre à jour
      </button>
    </div>
  );
}
