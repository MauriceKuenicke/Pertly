import { IconList, IconPlus, IconSliders } from "../ui/Icon";
import styles from "./Sidebar.module.css";

interface SidebarProps {
  activeView: "list" | "wizard" | "settings" | null;
  onGoToList: () => void;
  onNewEstimate: () => void;
  onGoToSettings?: () => void;
}

export function Sidebar({ activeView, onGoToList, onNewEstimate, onGoToSettings }: SidebarProps) {
  return (
    <aside className={styles.sidebar}>
      <div className={styles.logoRow}>
        <div className={styles.logoMark}>P</div>
        <span className={styles.logoText}>Pertly</span>
      </div>

      <button className={styles.cta} onClick={onNewEstimate}>
        <IconPlus width={14} height={14} strokeWidth={2.25} />
        <span>New Estimate</span>
      </button>

      <span className={styles.sectionLabel}>Workspace</span>

      <button
        className={`${styles.navItem} ${activeView === "list" ? styles.navItemActive : ""}`}
        onClick={onGoToList}
      >
        <span className={styles.iconBadge}>
          <IconList width={13} height={13} strokeWidth={2} />
        </span>
        <span>All Estimates</span>
      </button>

      <button
        className={`${styles.navItem} ${activeView === "wizard" ? styles.navItemActive : ""}`}
        onClick={onNewEstimate}
      >
        <span className={styles.iconBadge}>
          <IconPlus width={13} height={13} strokeWidth={2} />
        </span>
        <span>New Estimate</span>
      </button>

      <div className={styles.spacer} />

      {onGoToSettings && (
        <button
          className={`${styles.navItem} ${activeView === "settings" ? styles.navItemActive : ""}`}
          onClick={onGoToSettings}
        >
          <span className={styles.iconBadge}>
            <IconSliders width={13} height={13} strokeWidth={2} />
          </span>
          <span>Settings</span>
        </button>
      )}
    </aside>
  );
}
