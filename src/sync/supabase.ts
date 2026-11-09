import { createClient } from "@supabase/supabase-js";

/**
 * Client Supabase. La session de connexion est conservée dans le stockage de
 * l'app (celui de l'app installée sur iOS, distinct de Safari) et renouvelée
 * automatiquement.
 */
export const supabase = createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    // Pas de lien magique : rien à lire dans l'URL.
    detectSessionInUrl: false,
    storageKey: "mneme.auth",
  },
});
