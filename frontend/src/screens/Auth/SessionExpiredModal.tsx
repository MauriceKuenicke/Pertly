import { useState, type FormEvent } from "react";
import { Button, Field, Modal } from "../../components/ui";
import { useAuth } from "../../state/AuthContext";
import { useEstimates } from "../../state/EstimatesContext";
import { friendlyErrorMessage } from "../../lib/apiErrors";
import styles from "./Auth.module.css";

/**
 * Shown over the app when the server reports the session is gone (expired,
 * revoked by a password change elsewhere, or the account was deactivated).
 * Everything stays mounted underneath, so signing in again as the same user
 * picks up exactly where they left off, unsaved edits included. Signing in
 * as someone else resets the app to that user's data.
 */
export function SessionExpiredModal() {
  const { user, login, logout } = useAuth();
  const { hasUnsyncedChanges } = useEstimates();
  const [email, setEmail] = useState(user?.email ?? "");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [confirmSignOut, setConfirmSignOut] = useState(false);

  const differentUser = user !== null && email.trim() !== "" && email.trim().toLowerCase() !== user.email.toLowerCase();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await login(email.trim(), password);
    } catch (err) {
      setError(friendlyErrorMessage(err));
      setSubmitting(false);
    }
  };

  const signOut = () => {
    setSubmitting(true);
    void logout();
  };

  if (confirmSignOut) {
    return (
      <Modal
        title="Sign Out Without Saving?"
        description="Some of your latest changes couldn't be saved to the server yet. If you sign out now, they'll be lost."
        dismissible={false}
        onClose={() => undefined}
      >
        <div className={styles.actions}>
          <Button variant="ghost" disabled={submitting} onClick={() => setConfirmSignOut(false)}>
            Back to Sign In
          </Button>
          <Button variant="danger" disabled={submitting} onClick={signOut}>
            Sign Out Anyway
          </Button>
        </div>
      </Modal>
    );
  }

  return (
    <Modal
      title="Your Session Expired"
      description="Sign in again to keep working. Changes you haven't saved yet are kept and will be saved once you're back."
      dismissible={false}
      onClose={() => undefined}
    >
      <form className={styles.form} onSubmit={handleSubmit}>
        <Field
          label="Email"
          type="email"
          autoComplete="username"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <Field
          label="Password"
          type="password"
          autoComplete="current-password"
          autoFocus
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        {differentUser && (
          <p className={styles.note}>
            Signing in as a different user discards any unsaved changes made as {user?.email}.
          </p>
        )}
        {error && (
          <p className={styles.error} role="alert">
            {error}
          </p>
        )}
        <div className={styles.actions}>
          <Button
            type="button"
            variant="ghost"
            disabled={submitting}
            onClick={() => (hasUnsyncedChanges() ? setConfirmSignOut(true) : signOut())}
          >
            Sign Out
          </Button>
          <Button type="submit" disabled={submitting || !email.trim() || !password}>
            {submitting ? "Signing In…" : "Sign In"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
