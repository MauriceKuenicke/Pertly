import { useState, type FormEvent } from "react";
import { CenteredPage } from "../../components/layout";
import { Button, Card, Field } from "../../components/ui";
import { useAuth } from "../../state/AuthContext";
import type { RegisterForm } from "../../lib/api";
import { errorCode, friendlyErrorMessage, PASSWORD_RULES } from "../../lib/apiErrors";
import { useDocumentTitle } from "../../lib/useDocumentTitle";
import styles from "./Auth.module.css";

interface RegisterScreenProps {
  onGoToLogin: () => void;
}

type FieldErrors = Partial<Record<keyof RegisterForm, string>>;

// Backend error codes that belong to one specific input.
const FIELD_FOR_CODE: Record<string, keyof RegisterForm> = {
  INVALID_MAIL: "email",
  ALREADY_IN_USE: "email",
  PASSWORD_REQUIREMENT: "password",
  PASSWORD_MISMATCH: "confirm_password",
};

const EMPTY_FORM: RegisterForm = { first_name: "", last_name: "", email: "", password: "", confirm_password: "" };

export function RegisterScreen({ onGoToLogin }: RegisterScreenProps) {
  const { register } = useAuth();
  const [form, setForm] = useState<RegisterForm>(EMPTY_FORM);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  useDocumentTitle("Pertly - Create Account");

  const update = (key: keyof RegisterForm, value: string) => {
    setForm((f) => ({ ...f, [key]: value }));
    setFieldErrors((errs) => ({ ...errs, [key]: undefined }));
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (form.password !== form.confirm_password) {
      setFieldErrors({ confirm_password: "The passwords don't match." });
      return;
    }
    setSubmitting(true);
    setFieldErrors({});
    try {
      await register({ ...form, email: form.email.trim(), first_name: form.first_name.trim(), last_name: form.last_name.trim() });
    } catch (err) {
      const code = errorCode(err);
      const field = code ? FIELD_FOR_CODE[code] : undefined;
      if (field) setFieldErrors({ [field]: friendlyErrorMessage(err) });
      else setError(friendlyErrorMessage(err));
      setSubmitting(false);
    }
  };

  const complete = Object.values(form).every((v) => v.trim() !== "");

  return (
    <CenteredPage width="regular">
      <Card title="Create Your Account" description="Set up your Pertly account to start pricing projects.">
        <form className={styles.form} onSubmit={handleSubmit}>
          <div className={styles.row2}>
            <Field
              label="First Name"
              autoComplete="given-name"
              autoFocus
              value={form.first_name}
              error={fieldErrors.first_name}
              onChange={(e) => update("first_name", e.target.value)}
            />
            <Field
              label="Last Name"
              autoComplete="family-name"
              value={form.last_name}
              error={fieldErrors.last_name}
              onChange={(e) => update("last_name", e.target.value)}
            />
          </div>
          <Field
            label="Email"
            type="email"
            autoComplete="email"
            value={form.email}
            error={fieldErrors.email}
            onChange={(e) => update("email", e.target.value)}
          />
          <Field
            label="Password"
            type="password"
            autoComplete="new-password"
            value={form.password}
            helpText={PASSWORD_RULES}
            error={fieldErrors.password}
            onChange={(e) => update("password", e.target.value)}
          />
          <Field
            label="Confirm Password"
            type="password"
            autoComplete="new-password"
            value={form.confirm_password}
            error={fieldErrors.confirm_password}
            onChange={(e) => update("confirm_password", e.target.value)}
          />
          {error && (
            <p className={styles.error} role="alert">
              {error}
            </p>
          )}
          <Button type="submit" className={styles.submit} disabled={submitting || !complete}>
            {submitting ? "Creating Account…" : "Create Account"}
          </Button>
        </form>
      </Card>
      <p className={styles.switch}>
        Already have an account?{" "}
        <button type="button" className={styles.link} onClick={onGoToLogin}>
          Sign in
        </button>
      </p>
    </CenteredPage>
  );
}
