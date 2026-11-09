import { db } from "../data/db";
import { clearLocalData } from "../data/localData";
import { onPendingChange } from "../data/outbox";
import { synchronize } from "./engine";
import { AUTH_STORAGE_KEY, supabase } from "./supabase";

/**
 * Compte et synchronisation.
 *
 * L'accès à l'app suit la présence d'une session enregistrée sur l'appareil,
 * même expirée : hors ligne, l'app s'ouvre toujours. L'écran de connexion
 * n'apparaît qu'au premier lancement, après une déconnexion, ou si le serveur
 * a révoqué la session (mot de passe changé…).
 *
 * La synchronisation est entièrement automatique : au lancement, au retour au
 * premier plan, au retour du réseau, peu après chaque modification, et
 * régulièrement tant que l'app est ouverte.
 */

export type AuthState = "unknown" | "signed-in" | "signed-out";
export type SyncStatus = "idle" | "syncing" | "offline" | "error";

export interface SyncState {
  auth: AuthState;
  status: SyncStatus;
  email?: string;
  lastSyncedAt?: number;
  error?: string;
}

const LAST_SYNC_KEY = "sync.lastSyncedAt";
/** Délai après une modification locale : regroupe les saisies rapprochées. */
const DEBOUNCE_MS = 2000;
/** Synchronisation régulière tant que l'app est ouverte (modifications faites ailleurs). */
const PERIODIC_MS = 5 * 60 * 1000;

let state: SyncState = { auth: "unknown", status: "idle" };
let running: Promise<void> | null = null;
/** Déconnexion en cours : plus de synchronisation, et l'écran ne bascule qu'une fois l'appareil vidé. */
let signingOut = false;
let rerunRequested = false;
let debounceTimer: ReturnType<typeof setTimeout> | undefined;
const listeners = new Set<() => void>();

function setState(changes: Partial<SyncState>) {
  state = { ...state, ...changes };
  listeners.forEach((listener) => listener());
}

/** Pour `useSyncExternalStore`. */
export const syncStore = {
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  getSnapshot: () => state,
};

/* ---------- Session enregistrée sur l'appareil ---------- */

function storedSession(): { user?: { email?: string } } | null {
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/* ---------- Synchronisation ---------- */

/** Lance une synchronisation (ou en programme une autre si l'une est en cours). */
export function syncNow(): Promise<void> {
  if (running) {
    rerunRequested = true;
    return running;
  }
  running = runSync().finally(() => {
    running = null;
    if (rerunRequested) {
      rerunRequested = false;
      void syncNow();
    }
  });
  return running;
}

async function runSync(): Promise<void> {
  if (state.auth !== "signed-in" || signingOut) return;
  if (!navigator.onLine) return setState({ status: "offline" });
  setState({ status: "syncing", error: undefined });
  try {
    // Session à jour (rafraîchie si besoin) : elle peut avoir expiré pendant une période hors ligne.
    const { data } = await supabase.auth.getSession();
    if (!data.session) throw new Error("Connexion au serveur impossible pour l’instant.");
    await synchronize(data.session.user.id);
    const now = Date.now();
    await db.settings.put({ key: LAST_SYNC_KEY, value: now });
    setState({ status: "idle", lastSyncedAt: now });
  } catch (error) {
    setState({ status: navigator.onLine ? "error" : "offline", error: describeError(error) });
  }
}

function scheduleSync(delay = DEBOUNCE_MS) {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => void syncNow(), delay);
}

/** Démarre le service : session, déclencheurs, première synchronisation. */
export function startSyncService(): void {
  db.settings.get(LAST_SYNC_KEY).then((setting) => {
    if (typeof setting?.value === "number") setState({ lastSyncedAt: setting.value });
  });

  supabase.auth.onAuthStateChange((event, session) => {
    if (session) {
      setState({ auth: "signed-in", email: session.user.email });
      // Jamais d'appel à supabase dans ce gestionnaire (risque d'interblocage) : on diffère.
      if (event === "SIGNED_IN" || event === "INITIAL_SESSION") scheduleSync(0);
    } else if (event === "SIGNED_OUT") {
      // Déconnexion demandée ici : `signOut` basculera l'écran une fois l'appareil vidé.
      if (!signingOut) setState({ auth: "signed-out", status: "idle", email: undefined, error: undefined });
    } else {
      // Session illisible au lancement (hors ligne, jeton expiré) : on garde l'accès si elle est enregistrée.
      const stored = storedSession();
      setState({ auth: stored ? "signed-in" : "signed-out", email: stored?.user?.email });
      if (stored) scheduleSync(0);
    }
  });

  onPendingChange(() => scheduleSync());
  window.addEventListener("online", () => void syncNow());
  window.addEventListener("offline", () => setState({ status: "offline" }));
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") void syncNow();
  });
  setInterval(() => {
    if (document.visibilityState === "visible") void syncNow();
  }, PERIODIC_MS);
}

/* ---------- Connexion / déconnexion ---------- */

export async function signIn(email: string, password: string): Promise<void> {
  const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
  if (error) throw new Error(describeError(error));
}

/** Nombre de modifications pas encore envoyées au serveur. */
export function pendingChanges(): Promise<number> {
  return db.outbox.count();
}

/**
 * Déconnexion de cet appareil seulement : la session est fermée et les données
 * locales sont effacées (elles restent sur le serveur).
 */
export async function signOut(): Promise<void> {
  signingOut = true;
  try {
    // Une synchronisation en cours pourrait réécrire des données après l'effacement.
    clearTimeout(debounceTimer);
    await running;
    const { error } = await supabase.auth.signOut({ scope: "local" });
    if (error) throw new Error(describeError(error));
    await clearLocalData();
    setState({ auth: "signed-out", status: "idle", email: undefined, error: undefined, lastSyncedAt: undefined });
  } finally {
    signingOut = false;
  }
}

function describeError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (/invalid login credentials/i.test(message)) return "E-mail ou mot de passe incorrect.";
  if (/jwt|invalid claim|not authorized|401/i.test(message)) {
    return "Le serveur refuse la session de cet appareil. Déconnecte-toi puis reconnecte-toi.";
  }
  if (/failed to fetch|network|load failed|délai dépassé|timeout|abort/i.test(message)) {
    return "Serveur injoignable. Vérifie ta connexion (ou le projet Supabase est en pause).";
  }
  return message;
}
