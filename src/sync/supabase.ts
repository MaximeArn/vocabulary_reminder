import { createClient } from "@supabase/supabase-js";

/** Clé de stockage de la session : sa présence signifie « un compte est ouvert sur cet appareil ». */
export const AUTH_STORAGE_KEY = "mneme.auth";

/**
 * Délai maximal d'une requête. Sans lui, une requête restée sans réponse (réseau
 * instable) bloquerait la synchronisation indéfiniment ; avec lui, elle échoue et
 * la synchronisation suivante réessaie.
 */
const REQUEST_TIMEOUT_MS = 15_000;

function fetchWithTimeout(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new DOMException("Délai dépassé", "TimeoutError")), REQUEST_TIMEOUT_MS);
  init.signal?.addEventListener("abort", () => controller.abort(init.signal?.reason));
  return fetch(input, { ...init, signal: controller.signal }).finally(() => clearTimeout(timer));
}

/**
 * Client Supabase. La session de connexion est conservée dans le stockage de
 * l'app (celui de l'app installée sur iOS, distinct de Safari) et renouvelée
 * automatiquement.
 */
export const supabase = createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY, {
  global: { fetch: fetchWithTimeout },
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    // Pas de lien magique : rien à lire dans l'URL.
    detectSessionInUrl: false,
    storageKey: AUTH_STORAGE_KEY,
  },
});
