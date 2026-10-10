import { useState, type FormEvent } from "react";
import { CenteredPage } from "../../components/layout";
import { Button, Card, Field } from "../../components/ui";
import { useAuth } from "../../state/AuthContext";
import { friendlyErrorMessage } from "../../lib/apiErrors";
import { useDocumentTitle } from "../../lib/useDocumentTitle";
import styles from "./Auth.module.css";

interface LoginScreenProps {
  /** Shown as a "Create an account" link; omitted when registration is closed. */
  onGoToRegister?: () => void;
}

export function LoginScreen({ onGoToRegister }: LoginScreenProps) {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  useDocumentTitle("Pertly - Sign In");

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

  return (
    <CenteredPage>
      <Card title="Sign In" description="Welcome back. Sign in to your Pertly account.">
        <form className={styles.form} onSubmit={handleSubmit}>
          <Field
            label="Email"
            type="email"
            autoComplete="username"
            autoFocus
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <Field
            label="Password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          {error && (
            <p className={styles.error} role="alert">
              {error}
            </p>
          )}
          <Button type="submit" className={styles.submit} disabled={submitting || !email.trim() || !password}>
            {submitting ? "Signing In…" : "Sign In"}
          </Button>
        </form>
      </Card>
      {onGoToRegister && (
        <p className={styles.switch}>
          New to Pertly?{" "}
          <button type="button" className={styles.link} onClick={onGoToRegister}>
            Create an account
          </button>
        </p>
      )}
    </CenteredPage>
  );
}
