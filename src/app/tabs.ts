import { CollectionIcon, ProgressIcon, SettingsIcon, TodayIcon } from "../ui/icons";

/** Les onglets de la barre de navigation, dans l'ordre d'affichage. */
export type TabId = "today" | "collection" | "progress" | "settings";

export interface Tab {
  id: TabId;
  label: string;
  /** Fragment d'URL (#…) : l'onglet est conservé au rechargement. */
  hash: string;
  Icon: (props: { size?: number }) => React.ReactNode;
}

export const TABS: Tab[] = [
  { id: "today", label: "Aujourd’hui", hash: "aujourdhui", Icon: TodayIcon },
  { id: "collection", label: "Collection", hash: "collection", Icon: CollectionIcon },
  { id: "progress", label: "Progrès", hash: "progres", Icon: ProgressIcon },
  { id: "settings", label: "Réglages", hash: "reglages", Icon: SettingsIcon },
];

/** Onglet correspondant au fragment d'URL actuel, « Aujourd'hui » par défaut. */
export function tabFromLocation(): TabId {
  const hash = window.location.hash.slice(1);
  return TABS.find((tab) => tab.hash === hash)?.id ?? "today";
}

/** Inscrit l'onglet dans l'URL, sans ajouter d'entrée à l'historique. */
export function saveTabInLocation(id: TabId): void {
  const tab = TABS.find((candidate) => candidate.id === id);
  if (tab) window.history.replaceState(null, "", `#${tab.hash}`);
}
