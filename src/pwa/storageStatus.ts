/**
 * Stockage persistant.
 *
 * Par défaut, le navigateur peut effacer les données d'un site s'il manque
 * d'espace. `navigator.storage.persist()` demande qu'elles soient protégées
 * (Safari 17+). Safari décide seul, sans afficher de demande à l'utilisateur.
 */

export interface StorageStatus {
  /** `null` si l'API n'est pas disponible. */
  persisted: boolean | null;
  usageBytes: number | null;
  quotaBytes: number | null;
}

export async function requestPersistentStorage(): Promise<boolean | null> {
  if (!navigator.storage?.persist) return null;
  try {
    if (await navigator.storage.persisted()) return true;
    return await navigator.storage.persist();
  } catch {
    return null;
  }
}

export async function readStorageStatus(): Promise<StorageStatus> {
  const status: StorageStatus = { persisted: null, usageBytes: null, quotaBytes: null };
  try {
    if (navigator.storage?.persisted) {
      status.persisted = await navigator.storage.persisted();
    }
    if (navigator.storage?.estimate) {
      const estimate = await navigator.storage.estimate();
      status.usageBytes = estimate.usage ?? null;
      status.quotaBytes = estimate.quota ?? null;
    }
  } catch {
    // On garde les valeurs `null` : l'écran Diagnostic affichera « inconnu ».
  }
  return status;
}
