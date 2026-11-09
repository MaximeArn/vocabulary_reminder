import { supabase } from "../sync/supabase";
import { isIOS, isStandalone } from "./displayMode";
import { getServiceWorkerRegistration } from "./serviceWorkerStatus";

/**
 * Rappel quotidien : abonnement de l'appareil aux notifications (Web Push).
 *
 * Sur iPhone, les notifications ne sont possibles que dans l'app installée sur
 * l'écran d'accueil, et la permission doit être demandée en réponse à un toucher.
 * L'abonnement (adresse d'envoi + clés de chiffrement) est enregistré sur le
 * serveur, qui envoie le rappel (fonction « daily-reminder »).
 */

export type PushAvailability =
  /** Navigateur sans notifications Web Push. */
  | "unsupported"
  /** iPhone, dans Safari : il faut l'app installée sur l'écran d'accueil. */
  | "needs-install"
  /** Notifications refusées : à réautoriser dans les réglages de l'appareil. */
  | "denied"
  | "available";

export function pushAvailability(): PushAvailability {
  if (isIOS() && !isStandalone()) return "needs-install";
  if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) return "unsupported";
  if (Notification.permission === "denied") return "denied";
  return "available";
}

/** Abonnement de cet appareil, s'il existe et que la permission est toujours accordée. */
export async function currentSubscription(): Promise<PushSubscription | null> {
  if (pushAvailability() !== "available" || Notification.permission !== "granted") return null;
  const registration = await getServiceWorkerRegistration();
  return (await registration?.pushManager.getSubscription()) ?? null;
}

/** Clé publique VAPID (base64url) → octets, format attendu par `subscribe`. */
function decodeKey(base64url: string): Uint8Array<ArrayBuffer> {
  const base64 = base64url.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(base64url.length / 4) * 4, "=");
  const binary = atob(base64);
  const bytes = new Uint8Array(new ArrayBuffer(binary.length));
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

/**
 * Active le rappel sur cet appareil. À appeler directement depuis un toucher :
 * iOS n'affiche la demande de permission qu'en réponse à un geste.
 */
export async function enableReminder(): Promise<void> {
  // Première instruction, sans attente préalable : le geste de l'utilisateur doit être encore « actif ».
  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    throw new Error(
      permission === "denied"
        ? "Notifications refusées. Pour les autoriser : Réglages de l’iPhone › Notifications › Mnémé."
        : "Les notifications n’ont pas été autorisées.",
    );
  }
  const registration = await getServiceWorkerRegistration();
  if (!registration) throw new Error("L’app n’est pas encore prête : réessaie dans un instant.");
  const subscription =
    (await registration.pushManager.getSubscription()) ??
    (await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: decodeKey(import.meta.env.VITE_VAPID_PUBLIC_KEY),
    }));
  const keys = subscription.toJSON().keys ?? {};
  const { error } = await supabase.rpc("save_push_subscription", {
    p_endpoint: subscription.endpoint,
    p_p256dh: keys.p256dh ?? "",
    p_auth: keys.auth ?? "",
  });
  if (error) {
    await subscription.unsubscribe().catch(() => {});
    throw new Error("Le serveur est injoignable : réessaie une fois en ligne.");
  }
}

/** Désactive le rappel sur cet appareil (les autres appareils ne changent pas). */
export async function disableReminder(): Promise<void> {
  const subscription = await currentSubscription();
  if (!subscription) return;
  await supabase.from("push_subscriptions").delete().eq("endpoint", subscription.endpoint);
  await subscription.unsubscribe();
}

/** Envoie tout de suite un rappel d'essai à tous les appareils abonnés du compte. */
export async function sendTestReminder(): Promise<void> {
  const { error } = await supabase.functions.invoke("daily-reminder", { body: { test: true } });
  if (error) throw new Error("Le rappel d’essai n’a pas pu être envoyé.");
}
