import { useRegisterSW } from "virtual:pwa-register/react";

/**
 * Enregistre le service worker et signale quand une nouvelle version est prête.
 *
 * Sur iOS, une app installée vérifie rarement les mises à jour d'elle-même :
 * on force donc une vérification à chaque retour au premier plan.
 */
export function useServiceWorker() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, registration) {
      if (!registration) return;
      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState !== "visible") return;
        // Hors ligne, la vérification échoue : ce n'est pas une erreur.
        registration.update().catch(() => {});
      });
    },
    onRegisterError(error) {
      console.error("Échec de l'enregistrement du service worker", error);
    },
  });

  return {
    updateAvailable: needRefresh,
    installUpdate: () => updateServiceWorker(true),
    dismissUpdate: () => setNeedRefresh(false),
  };
}
