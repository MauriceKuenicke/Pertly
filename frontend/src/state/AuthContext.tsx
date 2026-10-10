import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { authApi, isApiError, onUnauthorized, usersApi, type RegisterForm, type UserRead } from "../lib/api";
import { friendlyErrorMessage } from "../lib/apiErrors";

type BeforeLogoutHook = () => Promise<void>;

interface AuthContextValue {
  /** The signed-in user, or null when signed out. */
  user: UserRead | null;
  /** True until the initial `GET /api/users/me` has settled. */
  initializing: boolean;
  /** Set when the initial session check failed for a reason other than "not signed in". */
  initError: string | null;
  retryInit: () => void;
  registrationOpen: boolean;
  /**
   * The server answered 401 while a user was signed in. The user and all
   * in-memory state stay mounted (so unsaved edits survive); the UI asks
   * them to sign in again.
   */
  sessionExpired: boolean;
  login: (email: string, password: string) => Promise<UserRead>;
  register: (form: RegisterForm) => Promise<UserRead>;
  /** Runs every registered before-logout hook (e.g. flushing unsaved estimates), then signs out. */
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  /** Registers work that must finish before a sign-out. Returns an unregister function. */
  registerBeforeLogout: (hook: BeforeLogoutHook) => () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserRead | null>(null);
  const [initializing, setInitializing] = useState(true);
  const [initError, setInitError] = useState<string | null>(null);
  const [initAttempt, setInitAttempt] = useState(0);
  const [registrationOpen, setRegistrationOpen] = useState(false);
  const [sessionExpired, setSessionExpired] = useState(false);
  const userRef = useRef<UserRead | null>(null);
  userRef.current = user;
  const beforeLogoutHooks = useRef(new Set<BeforeLogoutHook>());

  const refreshConfig = useCallback(async () => {
    try {
      const config = await authApi.config();
      setRegistrationOpen(config.registration_open);
    } catch {
      // Non-critical: without it we just don't offer the register link.
    }
  }, []);

  useEffect(() => {
    let ignore = false;
    setInitializing(true);
    setInitError(null);
    const me = usersApi.me().then(
      (current) => {
        if (!ignore) setUser(current);
      },
      (err) => {
        if (ignore) return;
        if (isApiError(err) && err.status === 401) setUser(null);
        else setInitError(friendlyErrorMessage(err));
      },
    );
    const config = authApi.config().then(
      (c) => {
        if (!ignore) setRegistrationOpen(c.registration_open);
      },
      () => undefined,
    );
    Promise.all([me, config]).then(() => {
      if (!ignore) setInitializing(false);
    });
    return () => {
      ignore = true;
    };
  }, [initAttempt]);

  useEffect(
    () =>
      onUnauthorized(() => {
        if (userRef.current) setSessionExpired(true);
      }),
    [],
  );

  const retryInit = useCallback(() => setInitAttempt((n) => n + 1), []);

  const login = useCallback(async (email: string, password: string) => {
    const signedIn = await authApi.login(email, password);
    // Same user re-authenticating after an expired session keeps all
    // in-memory state (EstimatesProvider is keyed by user id); a different
    // user swaps the key, which remounts and resets everything.
    setUser(signedIn);
    setSessionExpired(false);
    return signedIn;
  }, []);

  const register = useCallback(async (form: RegisterForm) => {
    const created = await authApi.register(form);
    setUser(created);
    setSessionExpired(false);
    return created;
  }, []);

  const logout = useCallback(async () => {
    for (const hook of Array.from(beforeLogoutHooks.current)) {
      try {
        await hook();
      } catch {
        // A failing hook must never trap the user in a signed-in state.
      }
    }
    try {
      await authApi.logout();
    } catch {
      // The session cookie is HttpOnly, so there's nothing more we can do
      // client-side; drop the local session regardless.
    }
    setUser(null);
    setSessionExpired(false);
    void refreshConfig();
  }, [refreshConfig]);

  const refreshUser = useCallback(async () => {
    const current = await usersApi.me();
    setUser(current);
  }, []);

  const registerBeforeLogout = useCallback((hook: BeforeLogoutHook) => {
    beforeLogoutHooks.current.add(hook);
    return () => {
      beforeLogoutHooks.current.delete(hook);
    };
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      initializing,
      initError,
      retryInit,
      registrationOpen,
      sessionExpired,
      login,
      register,
      logout,
      refreshUser,
      registerBeforeLogout,
    }),
    [user, initializing, initError, retryInit, registrationOpen, sessionExpired, login, register, logout, refreshUser, registerBeforeLogout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

export function displayName(user: UserRead): string {
  const name = `${user.first_name} ${user.last_name}`.trim();
  return name || user.email;
}
