import { TABS, type TabId } from "./tabs";
import styles from "./TabBar.module.css";

interface TabBarProps {
  current: TabId;
  onSelect: (tab: TabId) => void;
}

export function TabBar({ current, onSelect }: TabBarProps) {
  return (
    <nav className={styles.tabBar} aria-label="Navigation principale">
      {TABS.map(({ id, label, Icon }) => (
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
      ))}
    </nav>
  );
}
