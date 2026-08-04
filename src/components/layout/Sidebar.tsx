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
        <span className={styles.ctaPlus}>+</span>
        <span>New estimate</span>
      </button>

      <span className={styles.sectionLabel}>WORKSPACE</span>

      <button
        className={`${styles.navItem} ${activeView === "list" ? styles.navItemActive : ""}`}
        onClick={onGoToList}
      >
        <span className={styles.iconBadge}>A</span>
        <span>All Estimates</span>
      </button>

      <button
        className={`${styles.navItem} ${activeView === "wizard" ? styles.navItemActive : ""}`}
        onClick={onNewEstimate}
      >
        <span className={styles.iconBadge}>E</span>
        <span>New Estimate</span>
      </button>

      <div className={styles.spacer} />

      {onGoToSettings && (
        <button
          className={`${styles.navItem} ${activeView === "settings" ? styles.navItemActive : ""}`}
          onClick={onGoToSettings}
        >
          <span className={styles.iconBadge}>S</span>
          <span>Settings</span>
        </button>
      )}
    </aside>
  );
}
