/// <reference types="vite/client" />

/** Injectées au build par vite.config.ts */
declare const __APP_VERSION__: string;
declare const __BUILD_TIME__: string;

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_PUBLISHABLE_KEY: string;
  /** Clé publique VAPID du rappel quotidien (publique par conception). */
  readonly VITE_VAPID_PUBLIC_KEY: string;
}
