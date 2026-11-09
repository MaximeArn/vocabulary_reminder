import { CardsIcon, CollectionIcon, ProgressIcon, SettingsIcon } from "../ui/icons";

/** Les onglets de la barre de navigation, dans l'ordre d'affichage (le bouton + se place au milieu). */
export type TabId = "revise" | "progress" | "collection" | "settings";

export interface Tab {
  id: TabId;
  label: string;
  /** Fragment d'URL (#…) : l'onglet est conservé au rechargement. */
  hash: string;
  Icon: (props: { size?: number }) => React.ReactNode;
}

export const TABS: Tab[] = [
  { id: "revise", label: "Réviser", hash: "reviser", Icon: CardsIcon },
  { id: "progress", label: "Progrès", hash: "progres", Icon: ProgressIcon },
  { id: "collection", label: "Collection", hash: "collection", Icon: CollectionIcon },
  { id: "settings", label: "Réglages", hash: "reglages", Icon: SettingsIcon },
];

/** Anciennes adresses, encore reconnues (signets, liens). */
const LEGACY_HASHES: Record<string, TabId> = { aujourdhui: "revise" };

/** Onglet correspondant au fragment d'URL actuel, « Réviser » par défaut. */
export function tabFromLocation(): TabId {
  const hash = window.location.hash.slice(1);
  return TABS.find((tab) => tab.hash === hash)?.id ?? LEGACY_HASHES[hash] ?? "revise";
}

/** Inscrit l'onglet dans l'URL, sans ajouter d'entrée à l'historique. */
export function saveTabInLocation(id: TabId): void {
  const tab = TABS.find((candidate) => candidate.id === id);
  if (tab) window.history.replaceState(null, "", `#${tab.hash}`);
}
