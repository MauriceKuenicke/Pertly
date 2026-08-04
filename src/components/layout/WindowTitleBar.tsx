import styles from "./WindowTitleBar.module.css";

interface WindowTitleBarProps {
  title: string;
}

export function WindowTitleBar({ title }: WindowTitleBarProps) {
  return (
    <div className={styles.bar}>
      <span className={styles.title}>{title}</span>
    </div>
  );
}
