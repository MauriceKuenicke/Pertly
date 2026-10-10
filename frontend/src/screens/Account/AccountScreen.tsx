import { useState, type FormEvent } from "react";
import { Sidebar } from "../../components/layout";
import { Badge, Button, Card, Field } from "../../components/ui";
import { useEstimates } from "../../state/EstimatesContext";
import { displayName, useAuth } from "../../state/AuthContext";
import { usersApi, type ChangePasswordForm } from "../../lib/api";
import { errorCode, friendlyErrorMessage, PASSWORD_RULES } from "../../lib/apiErrors";
import { formatDate } from "../../lib/date";
import { useDocumentTitle } from "../../lib/useDocumentTitle";
import styles from "./AccountScreen.module.css";

type FieldErrors = Partial<Record<keyof ChangePasswordForm, string>>;

const EMPTY_FORM: ChangePasswordForm = { current_password: "", new_password: "", confirm_password: "" };

export function AccountScreen() {
  const { user } = useAuth();
  const { goToList, goToSettings, createAndOpenEstimate } = useEstimates();
  const [form, setForm] = useState<ChangePasswordForm>(EMPTY_FORM);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  useDocumentTitle("Pertly - Account");

  if (!user) return null;

  const update = (key: keyof ChangePasswordForm, value: string) => {
    setForm((f) => ({ ...f, [key]: value }));
    setFieldErrors((errs) => ({ ...errs, [key]: undefined }));
    setSuccess(false);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    if (form.new_password !== form.confirm_password) {
      setFieldErrors({ confirm_password: "The passwords don't match." });
      return;
    }
    setSubmitting(true);
    setFieldErrors({});
    try {
      await usersApi.changePassword(form);
      setForm(EMPTY_FORM);
      setSuccess(true);
    } catch (err) {
      const code = errorCode(err);
      if (code === "INVALID_CREDENTIALS") setFieldErrors({ current_password: "Your current password is incorrect." });
      else if (code === "PASSWORD_REQUIREMENT") setFieldErrors({ new_password: friendlyErrorMessage(err) });
      else if (code === "PASSWORD_MISMATCH") setFieldErrors({ confirm_password: friendlyErrorMessage(err) });
      else setError(friendlyErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const complete = form.current_password !== "" && form.new_password !== "" && form.confirm_password !== "";

  return (
    <div className={styles.window}>
      <div className={styles.contentRow}>
        <Sidebar
          activeView="account"
          onGoToList={goToList}
          onNewEstimate={createAndOpenEstimate}
          onGoToSettings={goToSettings}
        />
        <div className={styles.main}>
          <div className={styles.header}>
            <h1 className={styles.title}>Account</h1>
            <p className={styles.subtitle}>Your profile and sign-in details.</p>
          </div>

          <div className={styles.body}>
            <div className={styles.formColumn}>
              <Card title="Profile">
                <dl className={styles.profileList}>
                  <dt className={styles.profileLabel}>Name</dt>
                  <dd className={styles.profileValue}>{displayName(user)}</dd>
                  <dt className={styles.profileLabel}>Email</dt>
                  <dd className={styles.profileValue}>{user.email}</dd>
                  <dt className={styles.profileLabel}>Role</dt>
                  <dd className={styles.profileValue}>
                    <Badge type={user.is_admin ? "likely" : "neutral"} label={user.is_admin ? "ADMIN" : "MEMBER"} />
                  </dd>
                  <dt className={styles.profileLabel}>Member Since</dt>
                  <dd className={styles.profileValue}>{formatDate(new Date(user.created_at))}</dd>
                </dl>
              </Card>

              <Card
                title="Change Password"
                description="Changing your password signs you out everywhere else; this browser stays signed in."
              >
                <form className={styles.form} onSubmit={handleSubmit}>
                  <Field
                    label="Current Password"
                    type="password"
                    autoComplete="current-password"
                    value={form.current_password}
                    error={fieldErrors.current_password}
                    onChange={(e) => update("current_password", e.target.value)}
                  />
                  <Field
                    label="New Password"
                    type="password"
                    autoComplete="new-password"
                    value={form.new_password}
                    helpText={PASSWORD_RULES}
                    error={fieldErrors.new_password}
                    onChange={(e) => update("new_password", e.target.value)}
                  />
                  <Field
                    label="Confirm New Password"
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
                  {success && (
                    <p className={styles.success} role="status">
                      Password changed. Any other devices signed in to your account have been signed out.
                    </p>
                  )}
                  <div className={styles.formActions}>
                    <Button type="submit" disabled={submitting || !complete}>
                      {submitting ? "Changing…" : "Change Password"}
                    </Button>
                  </div>
                </form>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
