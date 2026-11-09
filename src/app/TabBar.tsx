import { PlusIcon } from "../ui/icons";
import { TABS, type Tab, type TabId } from "./tabs";
import styles from "./TabBar.module.css";

interface TabBarProps {
  current: TabId;
  onSelect: (tab: TabId) => void;
  /** Bouton central : ajouter un mot, accessible depuis tous les écrans. */
  onAdd: () => void;
}

export function TabBar({ current, onSelect, onAdd }: TabBarProps) {
  const middle = Math.ceil(TABS.length / 2);

  const renderTab = ({ id, label, Icon }: Tab) => (
    <button
      key={id}
      type="button"
      className={`${styles.tab} ${id === current ? styles.active : ""}`}
      aria-current={id === current ? "page" : undefined}
      onClick={() => onSelect(id)}
    >
      <Icon />
      {label}
    </button>
  );

  return (
    <nav className={styles.tabBar} aria-label="Navigation principale">
      {TABS.slice(0, middle).map(renderTab)}
      <div className={styles.addSlot}>
        <button type="button" className={styles.add} onClick={onAdd} aria-label="Ajouter une fiche">
          <PlusIcon size={26} />
        </button>
      </div>
      {TABS.slice(middle).map(renderTab)}
    </nav>
  );
}
