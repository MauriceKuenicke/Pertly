import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Sidebar } from "../../components/layout";
import { Badge, Button, Card, Field, Modal } from "../../components/ui";
import { useEstimates } from "../../state/EstimatesContext";
import { displayName, useAuth } from "../../state/AuthContext";
import { usersApi, type CreateUserForm, type UserRead } from "../../lib/api";
import { errorCode, friendlyErrorMessage, PASSWORD_RULES } from "../../lib/apiErrors";
import { formatDate } from "../../lib/date";
import { useDocumentTitle } from "../../lib/useDocumentTitle";
import styles from "./UsersScreen.module.css";

type Notice = { kind: "error" | "success"; text: string };
type CreateFieldErrors = Partial<Record<keyof CreateUserForm, string>>;

const EMPTY_CREATE_FORM: CreateUserForm = { first_name: "", last_name: "", email: "", password: "", is_admin: false };

const CREATE_FIELD_FOR_CODE: Record<string, keyof CreateUserForm> = {
  INVALID_MAIL: "email",
  ALREADY_IN_USE: "email",
  PASSWORD_REQUIREMENT: "password",
};

export function UsersScreen() {
  const { user: currentUser } = useAuth();
  const { goToList, goToSettings, createAndOpenEstimate } = useEstimates();
  const [users, setUsers] = useState<UserRead[] | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [busyUserId, setBusyUserId] = useState<string | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState<CreateUserForm>(EMPTY_CREATE_FORM);
  const [createErrors, setCreateErrors] = useState<CreateFieldErrors>({});
  const [createError, setCreateError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const [resetTarget, setResetTarget] = useState<UserRead | null>(null);
  const [resetPassword, setResetPassword] = useState("");
  const [resetError, setResetError] = useState<string | null>(null);
  const [resetting, setResetting] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<UserRead | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useDocumentTitle("Pertly - Users");

  const isAdmin = currentUser?.is_admin ?? false;

  const loadUsers = useCallback(async () => {
    try {
      setUsers(await usersApi.list());
    } catch (err) {
      setNotice({ kind: "error", text: `Couldn't load users. ${friendlyErrorMessage(err)}` });
    }
  }, []);

  useEffect(() => {
    if (isAdmin) void loadUsers();
  }, [isAdmin, loadUsers]);

  const replaceUser = (updated: UserRead) => setUsers((list) => list?.map((u) => (u.id === updated.id ? updated : u)) ?? null);

  const handleActionError = (err: unknown) => {
    setNotice({ kind: "error", text: friendlyErrorMessage(err) });
    if (errorCode(err) === "USER_NOT_FOUND") void loadUsers();
  };

  const patchUser = async (target: UserRead, patch: { is_active?: boolean; is_admin?: boolean }, successText: string) => {
    setBusyUserId(target.id);
    setNotice(null);
    try {
      replaceUser(await usersApi.update(target.id, patch));
      setNotice({ kind: "success", text: successText });
    } catch (err) {
      handleActionError(err);
    } finally {
      setBusyUserId(null);
    }
  };

  // --- create ---
  const closeCreate = () => {
    setCreateOpen(false);
    setCreateForm(EMPTY_CREATE_FORM);
    setCreateErrors({});
    setCreateError(null);
  };

  const updateCreate = <K extends keyof CreateUserForm>(key: K, value: CreateUserForm[K]) => {
    setCreateForm((f) => ({ ...f, [key]: value }));
    setCreateErrors((errs) => ({ ...errs, [key]: undefined }));
  };

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    setCreating(true);
    setCreateErrors({});
    setCreateError(null);
    try {
      const created = await usersApi.create({
        ...createForm,
        first_name: createForm.first_name.trim(),
        last_name: createForm.last_name.trim(),
        email: createForm.email.trim(),
      });
      setUsers((list) => (list ? [...list, created] : [created]));
      setNotice({ kind: "success", text: `${displayName(created)} can now sign in with ${created.email}.` });
      closeCreate();
    } catch (err) {
      const code = errorCode(err);
      const field = code ? CREATE_FIELD_FOR_CODE[code] : undefined;
      if (field) setCreateErrors({ [field]: friendlyErrorMessage(err) });
      else setCreateError(friendlyErrorMessage(err));
    } finally {
      setCreating(false);
    }
  };

  const createComplete =
    createForm.first_name.trim() !== "" &&
    createForm.last_name.trim() !== "" &&
    createForm.email.trim() !== "" &&
    createForm.password !== "";

  // --- reset password ---
  const closeReset = () => {
    setResetTarget(null);
    setResetPassword("");
    setResetError(null);
  };

  const handleReset = async (e: FormEvent) => {
    e.preventDefault();
    if (!resetTarget) return;
    setResetting(true);
    setResetError(null);
    try {
      await usersApi.resetPassword(resetTarget.id, resetPassword);
      setNotice({
        kind: "success",
        text: `Password for ${displayName(resetTarget)} reset. They've been signed out everywhere and can sign in with the new password.`,
      });
      closeReset();
    } catch (err) {
      if (errorCode(err) === "USER_NOT_FOUND") {
        closeReset();
        handleActionError(err);
      } else {
        setResetError(friendlyErrorMessage(err));
      }
    } finally {
      setResetting(false);
    }
  };

  // --- delete ---
  const closeDelete = () => {
    setDeleteTarget(null);
    setDeleteError(null);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await usersApi.remove(deleteTarget.id);
      setUsers((list) => list?.filter((u) => u.id !== deleteTarget.id) ?? null);
      setNotice({ kind: "success", text: `${displayName(deleteTarget)} and all of their estimates were deleted.` });
      closeDelete();
    } catch (err) {
      if (errorCode(err) === "USER_NOT_FOUND") {
        closeDelete();
        handleActionError(err);
      } else {
        setDeleteError(friendlyErrorMessage(err));
      }
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className={styles.window}>
      <div className={styles.contentRow}>
        <Sidebar activeView="users" onGoToList={goToList} onNewEstimate={createAndOpenEstimate} onGoToSettings={goToSettings} />
        <div className={styles.main}>
          <div className={styles.header}>
            <div>
              <h1 className={styles.title}>Users</h1>
              <p className={styles.subtitle}>Everyone who can sign in to this Pertly workspace. Each user only sees their own estimates.</p>
            </div>
            {isAdmin && (
              <Button variant="primary" onClick={() => setCreateOpen(true)}>
                + New User
              </Button>
            )}
          </div>

          <div className={styles.body}>
            {!isAdmin ? (
              <Card title="Admins Only" description="Only admins can manage users. Ask an admin if you need an account changed." />
            ) : (
              <>
                {notice && (
                  <p
                    className={`${styles.notice} ${notice.kind === "error" ? styles.noticeError : styles.noticeSuccess}`}
                    role={notice.kind === "error" ? "alert" : "status"}
                  >
                    <span>{notice.text}</span>
                    <button type="button" className={styles.noticeDismiss} aria-label="Dismiss" onClick={() => setNotice(null)}>
                      ×
                    </button>
                  </p>
                )}

                <div className={styles.tableWrap}>
                  {users === null ? (
                    <div className={styles.empty}>Loading users…</div>
                  ) : (
                    <table className={styles.table}>
                      <thead>
                        <tr>
                          <th>Name</th>
                          <th>Email</th>
                          <th>Role</th>
                          <th>Status</th>
                          <th>Created</th>
                          <th aria-label="Actions" />
                        </tr>
                      </thead>
                      <tbody>
                        {users.map((u) => {
                          const isSelf = u.id === currentUser?.id;
                          const busy = busyUserId === u.id;
                          return (
                            <tr key={u.id} className={u.is_active ? undefined : styles.rowInactive}>
                              <td>
                                <span className={styles.nameCell} title={displayName(u)}>
                                  <span className={styles.nameText}>{displayName(u)}</span>
                                  {isSelf && <span className={styles.youTag}>YOU</span>}
                                </span>
                              </td>
                              <td className={styles.emailCell} title={u.email}>
                                {u.email}
                              </td>
                              <td>
                                <Badge type={u.is_admin ? "likely" : "neutral"} label={u.is_admin ? "ADMIN" : "MEMBER"} />
                              </td>
                              <td>
                                <Badge type={u.is_active ? "success" : "neutral"} label={u.is_active ? "ACTIVE" : "INACTIVE"} />
                              </td>
                              <td className={styles.dateCell}>{formatDate(new Date(u.created_at))}</td>
                              <td>
                                {isSelf ? (
                                  <div className={styles.actions}>
                                    <span className={styles.selfHint}>Manage yourself under Account</span>
                                  </div>
                                ) : (
                                  <div className={styles.actions}>
                                    <button
                                      type="button"
                                      className={styles.actionBtn}
                                      disabled={busy}
                                      onClick={() =>
                                        patchUser(
                                          u,
                                          { is_admin: !u.is_admin },
                                          u.is_admin
                                            ? `${displayName(u)} is no longer an admin.`
                                            : `${displayName(u)} is now an admin.`,
                                        )
                                      }
                                    >
                                      {u.is_admin ? "Remove Admin" : "Make Admin"}
                                    </button>
                                    <button
                                      type="button"
                                      className={styles.actionBtn}
                                      disabled={busy}
                                      onClick={() =>
                                        patchUser(
                                          u,
                                          { is_active: !u.is_active },
                                          u.is_active
                                            ? `${displayName(u)} was deactivated and signed out everywhere.`
                                            : `${displayName(u)} can sign in again.`,
                                        )
                                      }
                                    >
                                      {u.is_active ? "Deactivate" : "Activate"}
                                    </button>
                                    <button
                                      type="button"
                                      className={styles.actionBtn}
                                      disabled={busy}
                                      onClick={() => setResetTarget(u)}
                                    >
                                      Reset Password
                                    </button>
                                    <button
                                      type="button"
                                      className={`${styles.actionBtn} ${styles.actionDanger}`}
                                      disabled={busy}
                                      onClick={() => setDeleteTarget(u)}
                                    >
                                      Delete
                                    </button>
                                  </div>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {createOpen && (
        <Modal title="New User" description="They can sign in right away with this email and password." onClose={closeCreate}>
          <form className={styles.form} onSubmit={handleCreate}>
            <div className={styles.row2}>
              <Field
                label="First Name"
                autoFocus
                value={createForm.first_name}
                error={createErrors.first_name}
                onChange={(e) => updateCreate("first_name", e.target.value)}
              />
              <Field
                label="Last Name"
                value={createForm.last_name}
                error={createErrors.last_name}
                onChange={(e) => updateCreate("last_name", e.target.value)}
              />
            </div>
            <Field
              label="Email"
              type="email"
              autoComplete="off"
              value={createForm.email}
              error={createErrors.email}
              onChange={(e) => updateCreate("email", e.target.value)}
            />
            <Field
              label="Initial Password"
              type="password"
              autoComplete="new-password"
              helpText={PASSWORD_RULES}
              value={createForm.password}
              error={createErrors.password}
              onChange={(e) => updateCreate("password", e.target.value)}
            />
            <label className={styles.checkboxRow}>
              <input
                type="checkbox"
                checked={createForm.is_admin}
                onChange={(e) => updateCreate("is_admin", e.target.checked)}
              />
              Make this user an admin
            </label>
            {createError && (
              <p className={styles.modalError} role="alert">
                {createError}
              </p>
            )}
            <div className={styles.modalActions}>
              <Button type="button" variant="ghost" onClick={closeCreate}>
                Cancel
              </Button>
              <Button type="submit" disabled={creating || !createComplete}>
                {creating ? "Creating…" : "Create User"}
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {resetTarget && (
        <Modal
          title="Reset Password"
          description={`Set a new password for ${displayName(resetTarget)}. They'll be signed out everywhere.`}
          onClose={closeReset}
        >
          <form className={styles.form} onSubmit={handleReset}>
            <Field
              label="New Password"
              type="password"
              autoComplete="new-password"
              autoFocus
              helpText={PASSWORD_RULES}
              value={resetPassword}
              onChange={(e) => {
                setResetPassword(e.target.value);
                setResetError(null);
              }}
            />
            {resetError && (
              <p className={styles.modalError} role="alert">
                {resetError}
              </p>
            )}
            <div className={styles.modalActions}>
              <Button type="button" variant="ghost" onClick={closeReset}>
                Cancel
              </Button>
              <Button type="submit" disabled={resetting || !resetPassword}>
                {resetting ? "Resetting…" : "Reset Password"}
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {deleteTarget && (
        <Modal
          title="Delete This User?"
          description={`${displayName(deleteTarget)} (${deleteTarget.email}) and all of their estimates will be permanently deleted. This can't be undone.`}
          onClose={closeDelete}
        >
          {deleteError && (
            <p className={styles.modalError} role="alert">
              {deleteError}
            </p>
          )}
          <div className={styles.modalActions}>
            <Button variant="ghost" onClick={closeDelete}>
              Cancel
            </Button>
            <Button variant="danger" disabled={deleting} onClick={handleDelete}>
              {deleting ? "Deleting…" : "Delete"}
            </Button>
          </div>
        </Modal>
      )}
    </div>
  );
}
