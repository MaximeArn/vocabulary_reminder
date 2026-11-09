import { useState } from "react";
import { TabBar } from "./TabBar";
import { saveTabInLocation, tabFromLocation, type TabId } from "./tabs";
import { ToastProvider } from "../ui/Toast";
import { UpdateBanner } from "../pwa/UpdateBanner";
import { TodayScreen } from "../features/today/TodayScreen";
import { CollectionScreen } from "../features/collection/CollectionScreen";
import { ItemFormSheet } from "../features/collection/ItemFormSheet";
import { ProgressScreen } from "../features/progress/ProgressScreen";
import { SettingsScreen } from "../features/settings/SettingsScreen";
import styles from "./App.module.css";

function CurrentScreen({ tab }: { tab: TabId }) {
  switch (tab) {
    case "today":
      return <TodayScreen />;
    case "collection":
      return <CollectionScreen />;
    case "progress":
      return <ProgressScreen />;
    case "settings":
      return <SettingsScreen />;
  }
}

export function App() {
  const [tab, setTab] = useState<TabId>(tabFromLocation);
  const [adding, setAdding] = useState(false);

  const selectTab = (next: TabId) => {
    setTab(next);
    saveTabInLocation(next);
  };

  return (
    <ToastProvider>
      <div className={styles.app}>
        <UpdateBanner />
        {/* La clé force le remontage : chaque écran repart en haut, avec son animation d'entrée. */}
        <main className={styles.content} key={tab}>
          <CurrentScreen tab={tab} />
        </main>
        <TabBar current={tab} onSelect={selectTab} onAdd={() => setAdding(true)} />
      </div>
      {/* Une seule catégorie pour l'instant ; le choix de la catégorie viendra avec la deuxième. */}
      {adding && <ItemFormSheet kind="vocabulary" onClose={() => setAdding(false)} />}
    </ToastProvider>
  );
}
