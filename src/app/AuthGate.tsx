import { useSyncExternalStore } from "react";
import { syncStore } from "../sync/service";
import { LoginScreen } from "../features/auth/LoginScreen";

/**
 * Accès à l'app : écran de connexion tant qu'aucun compte n'est ouvert sur
 * l'appareil. Pendant la lecture de la session (quelques millisecondes), rien
 * n'est affiché : le fond papier évite tout clignotement.
 */
export function AuthGate({ children }: { children: React.ReactNode }) {
  const { auth } = useSyncExternalStore(syncStore.subscribe, syncStore.getSnapshot);
  if (auth === "unknown") return null;
  if (auth === "signed-out") return <LoginScreen />;
  return children;
}
