/** État du service worker, pour l'écran Diagnostic. */

export type ServiceWorkerStatus = "unsupported" | "not-registered" | "installing" | "active";

/** Au tout premier lancement, l'installation du service worker prend quelques secondes. */
const READY_TIMEOUT_MS = 5000;

export async function readServiceWorkerStatus(): Promise<ServiceWorkerStatus> {
  if (!("serviceWorker" in navigator)) return "unsupported";

  const registration = await waitForActiveRegistration();
  if (!registration) return "not-registered";
  if (registration.active) return "active";
  return "installing";
}

/**
 * `navigator.serviceWorker.ready` se résout dès qu'un service worker est actif,
 * mais ne se résout jamais s'il n'y en a pas : on borne donc l'attente.
 */
async function waitForActiveRegistration(): Promise<ServiceWorkerRegistration | undefined> {
  const timeout = new Promise<undefined>((resolve) => setTimeout(() => resolve(undefined), READY_TIMEOUT_MS));
  const ready = await Promise.race([navigator.serviceWorker.ready, timeout]);
  return ready ?? (await navigator.serviceWorker.getRegistration());
}
