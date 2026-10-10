import type { Estimate, Settings } from "../types/estimate";

/**
 * Thin fetch wrapper around the Pertly HTTP API (docs/API.md). Every request
 * goes to the same origin (Vite proxies /api in development, nginx in
 * production), carries the session cookie, and sends the `X-Pertly-Client`
 * header the backend's CSRF guard requires on unsafe methods.
 */

const API_BASE = "/api";

/** Returned by every user endpoint. */
export interface UserRead {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  is_admin: boolean;
  is_active: boolean;
  created_at: string;
}

export interface AuthConfig {
  registration_open: boolean;
}

export interface RegisterForm {
  first_name: string;
  last_name: string;
  email: string;
  password: string;
  confirm_password: string;
}

export interface CreateUserForm {
  first_name: string;
  last_name: string;
  email: string;
  password: string;
  is_admin: boolean;
}

export interface ChangePasswordForm {
  current_password: string;
  new_password: string;
  confirm_password: string;
}

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

export function isApiError(err: unknown): err is ApiError {
  return err instanceof ApiError;
}

// --- "unauthorized" event -------------------------------------------------

type UnauthorizedListener = () => void;
const unauthorizedListeners = new Set<UnauthorizedListener>();

/**
 * Subscribes to "the session is no longer valid" (any 401 outside of the
 * login/register calls, and outside of a wrong *current* password on the
 * change-password call). Returns an unsubscribe function.
 */
export function onUnauthorized(listener: UnauthorizedListener): () => void {
  unauthorizedListeners.add(listener);
  return () => {
    unauthorizedListeners.delete(listener);
  };
}

// Paths whose 401 means "wrong credentials", not "session expired".
const CREDENTIAL_PATHS = new Set(["/auth/login", "/auth/register"]);

// --- core request ---------------------------------------------------------

type Body = { kind: "json"; value: unknown } | { kind: "form"; value: Record<string, string> };
type Expect = "json" | "none" | "blob";

interface RequestOptions {
  body?: Body;
  expect?: Expect;
  /** Ask the browser to finish the request even if the page goes away (small bodies only). */
  keepalive?: boolean;
}

// Browsers cap the combined body size of in-flight keepalive requests at
// 64 KiB and reject the fetch outright above it, so only use keepalive for
// bodies comfortably below that.
const KEEPALIVE_MAX_BYTES = 60_000;

async function request<T>(method: string, path: string, options: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = {
    Accept: "application/json",
    "X-Pertly-Client": "1",
  };
  let body: string | undefined;
  if (options.body?.kind === "json") {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(options.body.value);
  } else if (options.body?.kind === "form") {
    headers["Content-Type"] = "application/x-www-form-urlencoded";
    body = new URLSearchParams(options.body.value).toString();
  }

  const keepalive =
    options.keepalive === true && (body === undefined || new TextEncoder().encode(body).length < KEEPALIVE_MAX_BYTES);

  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      method,
      headers,
      body,
      credentials: "same-origin",
      keepalive,
    });
  } catch {
    throw new ApiError(0, "NETWORK_ERROR", "Couldn't reach the Pertly server. Check your connection and try again.");
  }

  if (!response.ok) {
    const error = await parseError(response);
    if (response.status === 401 && !CREDENTIAL_PATHS.has(path) && error.code !== "INVALID_CREDENTIALS") {
      unauthorizedListeners.forEach((listener) => listener());
    }
    throw error;
  }

  const expect = options.expect ?? "json";
  if (expect === "none" || response.status === 204) return undefined as T;
  if (expect === "blob") return (await response.blob()) as T;
  return (await response.json()) as T;
}

async function parseError(response: Response): Promise<ApiError> {
  const fallbackMessage = `Request failed (${response.status}).`;
  try {
    const data = (await response.json()) as { detail?: unknown };
    const detail = data?.detail;
    if (detail && typeof detail === "object" && !Array.isArray(detail)) {
      const { code, message } = detail as { code?: unknown; message?: unknown };
      return new ApiError(
        response.status,
        typeof code === "string" ? code : "UNKNOWN",
        typeof message === "string" && message ? message : fallbackMessage,
      );
    }
    if (typeof detail === "string" && detail) return new ApiError(response.status, "UNKNOWN", detail);
  } catch {
    // Non-JSON error body (proxy error page, etc.): fall through.
  }
  return new ApiError(response.status, "UNKNOWN", fallbackMessage);
}

const json = (value: unknown): Body => ({ kind: "json", value });
const form = (value: Record<string, string>): Body => ({ kind: "form", value });

// --- endpoint groups ------------------------------------------------------

export const authApi = {
  config: () => request<AuthConfig>("GET", "/auth/config"),
  register: (data: RegisterForm) => request<UserRead>("POST", "/auth/register", { body: form({ ...data }) }),
  login: (email: string, password: string) =>
    request<UserRead>("POST", "/auth/login", { body: form({ email, password }) }),
  logout: () => request<void>("POST", "/auth/logout", { expect: "none" }),
};

export const usersApi = {
  me: () => request<UserRead>("GET", "/users/me"),
  changePassword: (data: ChangePasswordForm) =>
    request<void>("PUT", "/users/me/password", { body: form({ ...data }), expect: "none" }),
  list: () => request<UserRead[]>("GET", "/users"),
  create: (data: CreateUserForm) =>
    request<UserRead>("POST", "/users", { body: form({ ...data, is_admin: data.is_admin ? "true" : "false" }) }),
  update: (id: string, patch: { is_active?: boolean; is_admin?: boolean }) =>
    request<UserRead>("PATCH", `/users/${encodeURIComponent(id)}`, { body: json(patch) }),
  remove: (id: string) => request<void>("DELETE", `/users/${encodeURIComponent(id)}`, { expect: "none" }),
  resetPassword: (id: string, newPassword: string) =>
    request<void>("POST", `/users/${encodeURIComponent(id)}/password`, {
      body: form({ new_password: newPassword }),
      expect: "none",
    }),
};

export interface SyncRequestOptions {
  keepalive?: boolean;
}

export const estimatesApi = {
  list: () => request<Estimate[]>("GET", "/estimates"),
  put: (estimate: Estimate, options: SyncRequestOptions = {}) =>
    request<Estimate>("PUT", `/estimates/${encodeURIComponent(estimate.id)}`, {
      body: json(estimate),
      keepalive: options.keepalive,
    }),
  remove: (id: string, options: SyncRequestOptions = {}) =>
    request<void>("DELETE", `/estimates/${encodeURIComponent(id)}`, { expect: "none", keepalive: options.keepalive }),
};

export const settingsApi = {
  /** `{}` if the user never saved settings; merge over defaultSettings(). */
  get: () => request<Partial<Settings>>("GET", "/settings"),
  put: (settings: Settings, options: SyncRequestOptions = {}) =>
    request<Settings>("PUT", "/settings", { body: json(settings), keepalive: options.keepalive }),
};

export const proposalApi = {
  /** Renders the self-contained proposal HTML to PDF on the server and downloads it. */
  async downloadPdf(html: string, filename: string): Promise<void> {
    const blob = await request<Blob>("POST", "/proposals/pdf", { body: json({ html, filename }), expect: "blob" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.style.display = "none";
    document.body.appendChild(link);
    link.click();
    link.remove();
    // Revoking synchronously can cancel the download in some browsers.
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  },
};
