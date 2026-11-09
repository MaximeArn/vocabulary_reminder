import type { Session } from "@supabase/supabase-js";
import { db } from "../data/db";
import { onPendingChange } from "../data/outbox";
import { synchronize } from "./engine";
import { supabase } from "./supabase";

/**
 * Service de synchronisation : décide quand synchroniser et publie son état
 * pour l'interface. L'app fonctionne entièrement sans lui (local d'abord).
 */

export type SyncStatus = "signed-out" | "idle" | "syncing" | "offline" | "error";

export interface SyncState {
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

let state: SyncState = { status: "signed-out" };
let session: Session | null = null;
let running: Promise<void> | null = null;
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
  if (!session) return setState({ status: "signed-out", error: undefined });
  if (!navigator.onLine) return setState({ status: "offline" });
  setState({ status: "syncing", error: undefined });
  try {
    await synchronize(session.user.id);
    const now = Date.now();
    await db.settings.put({ key: LAST_SYNC_KEY, value: now });
    setState({ status: "idle", lastSyncedAt: now });
  } catch (error) {
    setState({ status: navigator.onLine ? "error" : "offline", error: describeError(error) });
  }
}

function scheduleSync() {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => void syncNow(), DEBOUNCE_MS);
}

/** Démarre le service : session, déclencheurs, première synchronisation. */
export function startSyncService(): void {
  db.settings.get(LAST_SYNC_KEY).then((setting) => {
    if (typeof setting?.value === "number") setState({ lastSyncedAt: setting.value });
  });

  supabase.auth.onAuthStateChange((_event, newSession) => {
    const changedUser = newSession?.user.id !== session?.user.id;
    session = newSession;
    setState({ email: newSession?.user.email, status: newSession ? state.status : "signed-out" });
    if (newSession && changedUser) void syncNow();
  });

  onPendingChange(scheduleSync);
  window.addEventListener("online", () => void syncNow());
  window.addEventListener("offline", () => setState({ status: "offline" }));
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") void syncNow();
  });
  setInterval(() => {
    if (document.visibilityState === "visible") void syncNow();
  }, PERIODIC_MS);
}

/* ---------- Connexion ---------- */

export async function signIn(email: string, password: string): Promise<void> {
  const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
  if (error) throw new Error(describeError(error));
}

/** Déconnexion : les données restent sur l'appareil (l'app fonctionne sans compte). */
export async function signOut(): Promise<void> {
  await supabase.auth.signOut();
  setState({ status: "signed-out", error: undefined });
}

function describeError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (/invalid login credentials/i.test(message)) return "E-mail ou mot de passe incorrect.";
  if (/failed to fetch|network|load failed/i.test(message)) {
    return "Serveur injoignable. Vérifie ta connexion (ou le projet Supabase est en pause).";
  }
  return message;
}
