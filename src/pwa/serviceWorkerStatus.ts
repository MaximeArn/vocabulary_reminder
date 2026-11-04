/** État du service worker, pour l'écran Diagnostic. */

export type ServiceWorkerStatus = "unsupported" | "not-registered" | "installing" | "active";

export async function readServiceWorkerStatus(): Promise<ServiceWorkerStatus> {
  if (!("serviceWorker" in navigator)) return "unsupported";
  const registration = await navigator.serviceWorker.getRegistration();
  if (!registration) return "not-registered";
  if (registration.active) return "active";
  return "installing";
}
