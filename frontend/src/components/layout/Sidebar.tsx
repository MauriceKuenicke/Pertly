import { useState } from "react";
import { IconList, IconPlus, IconSignOut, IconSliders, IconUser, IconUsers } from "../ui/Icon";
import { Button } from "../ui/Button";
import { Modal } from "../ui/Modal";
import { displayName, useAuth } from "../../state/AuthContext";
import { useEstimates } from "../../state/EstimatesContext";
import styles from "./Sidebar.module.css";

interface SidebarProps {
  activeView: "list" | "wizard" | "settings" | "account" | "users" | null;
  onGoToList: () => void;
  onNewEstimate: () => void;
  onGoToSettings?: () => void;
}

function initials(first: string, last: string, email: string): string {
  const fromName = `${first.trim().charAt(0)}${last.trim().charAt(0)}`;
  return (fromName || email.charAt(0)).toUpperCase();
}

export function Sidebar({ activeView, onGoToList, onNewEstimate, onGoToSettings }: SidebarProps) {
  // The account block reads app-wide state directly instead of taking more
  // props: every screen renders the Sidebar, and threading user/account
  // callbacks through WizardLayout and all wizard screens adds nothing.
  const { user, logout } = useAuth();
  const { goToAccount, goToUsers, flushPendingSaves, hasUnsyncedChanges } = useEstimates();
  const [signingOut, setSigningOut] = useState(false);
  const [confirmSignOut, setConfirmSignOut] = useState(false);

  const handleSignOut = async () => {
    setSigningOut(true);
    await flushPendingSaves();
    if (hasUnsyncedChanges()) {
      setSigningOut(false);
      setConfirmSignOut(true);
      return;
    }
    await logout();
  };

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

      {user && (
        <div className={styles.userBlock}>
          <div className={styles.userRow}>
            <span className={styles.avatar} aria-hidden>
              {initials(user.first_name, user.last_name, user.email)}
            </span>
            <div className={styles.userText}>
              <span className={styles.userName}>{displayName(user)}</span>
              <span className={styles.userEmail}>{user.email}</span>
            </div>
          </div>

          <button
            className={`${styles.navItem} ${activeView === "account" ? styles.navItemActive : ""}`}
            onClick={goToAccount}
          >
            <span className={styles.iconBadge}>
              <IconUser width={13} height={13} strokeWidth={2} />
            </span>
            <span>Account</span>
          </button>

          {user.is_admin && (
            <button
              className={`${styles.navItem} ${activeView === "users" ? styles.navItemActive : ""}`}
              onClick={goToUsers}
            >
              <span className={styles.iconBadge}>
                <IconUsers width={13} height={13} strokeWidth={2} />
              </span>
              <span>Users</span>
            </button>
          )}

          <button className={styles.navItem} onClick={handleSignOut} disabled={signingOut}>
            <span className={styles.iconBadge}>
              <IconSignOut width={13} height={13} strokeWidth={2} />
            </span>
            <span>{signingOut ? "Signing out…" : "Sign Out"}</span>
          </button>
        </div>
      )}

      {confirmSignOut && (
        <Modal
          title="Sign Out Without Saving?"
          description="Some of your latest changes couldn't be saved to the server yet. If you sign out now, they'll be lost."
          onClose={() => setConfirmSignOut(false)}
        >
          <div className={styles.modalActions}>
            <Button variant="ghost" onClick={() => setConfirmSignOut(false)}>
              Stay Signed In
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                setConfirmSignOut(false);
                setSigningOut(true);
                void logout();
              }}
            >
              Sign Out Anyway
            </Button>
          </div>
        </Modal>
      )}
    </aside>
  );
}
