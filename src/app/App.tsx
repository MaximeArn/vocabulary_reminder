import { useState } from "react";
import { TabBar } from "./TabBar";
import { saveTabInLocation, tabFromLocation, type TabId } from "./tabs";
import { ToastProvider } from "../ui/Toast";
import { ActionSheet } from "../ui/ActionSheet";
import { CATEGORIES } from "../categories/registry";
import { UpdateBanner } from "../pwa/UpdateBanner";
import { ReviseScreen } from "../features/revise/ReviseScreen";
import { CollectionScreen } from "../features/collection/CollectionScreen";
import { ItemFormSheet } from "../features/collection/ItemFormSheet";
import { BatchAddSheet } from "../features/collection/BatchAddSheet";
import { ProgressScreen } from "../features/progress/ProgressScreen";
import { SettingsScreen } from "../features/settings/SettingsScreen";
import styles from "./App.module.css";

function CurrentScreen({ tab }: { tab: TabId }) {
  switch (tab) {
    case "revise":
      return <ReviseScreen />;
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
  /** Ajout en cours : choix, puis formulaire d'une catégorie ou ajout de plusieurs fiches (« batch »). */
  const [adding, setAdding] = useState<"choosing" | "batch" | string | null>(null);

  const startAdding = () => setAdding("choosing");

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
        <TabBar current={tab} onSelect={selectTab} onAdd={startAdding} />
      </div>
      {adding === "choosing" && (
        <ActionSheet
          title="Ajouter à ta collection"
          options={[
            ...CATEGORIES.map((category) => ({ label: category.addLabel, onSelect: () => setAdding(category.kind) })),
            { label: "Plusieurs à la fois", onSelect: () => setAdding("batch") },
          ]}
          onCancel={() => setAdding(null)}
        />
      )}
      {adding === "batch" && <BatchAddSheet onClose={() => setAdding(null)} />}
      {adding && adding !== "choosing" && adding !== "batch" && <ItemFormSheet kind={adding} onClose={() => setAdding(null)} />}
    </ToastProvider>
  );
}
