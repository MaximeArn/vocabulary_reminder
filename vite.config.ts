/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import packageJson from "./package.json" with { type: "json" };

// Chemin de publication. "/" pour un hébergement à la racine d'un domaine,
// "/nom-du-depot/" pour GitHub Pages. Fixé une fois pour toutes : les données
// IndexedDB sont liées à l'origine, et le scope du service worker à ce chemin.
const base = process.env.BASE_PATH ?? "/";

const paperLight = "#f5f0e6";

export default defineConfig({
  base,
  define: {
    // Affichées dans Réglages : permettent de vérifier qu'une mise à jour est bien arrivée.
    __APP_VERSION__: JSON.stringify(packageJson.version),
    __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
  },
  plugins: [
    react(),
    VitePWA({
      // "prompt" : une nouvelle version n'est jamais activée en pleine session,
      // l'utilisateur choisit quand recharger (voir UpdateBanner).
      registerType: "prompt",
      injectRegister: false,
      includeAssets: ["icons/apple-touch-icon.png", "icons/favicon-64.png"],
      manifest: {
        id: base,
        name: "Mnémé",
        short_name: "Mnémé",
        description: "Mon carnet de mémorisation : mots, dates et connaissances rencontrés en lisant.",
        lang: "fr",
        dir: "ltr",
        start_url: base,
        scope: base,
        display: "standalone",
        orientation: "portrait",
        background_color: "#ffffff", // fond blanc de l'icône : écran de lancement assorti
        theme_color: paperLight,
        icons: [
          { src: "icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
          { src: "icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
          { src: "icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      workbox: {
        // Tout le nécessaire est pré-caché : l'app fonctionne entièrement hors ligne.
        globPatterns: ["**/*.{js,css,html,svg,png,woff2}"],
        navigateFallback: "index.html",
        cleanupOutdatedCaches: true,
      },
    }),
  ],
  test: {
    include: ["src/**/*.test.ts"],
    passWithNoTests: true,
  },
});
