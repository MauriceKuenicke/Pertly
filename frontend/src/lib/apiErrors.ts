import { isApiError } from "./api";

export const PASSWORD_RULES = "At least 8 characters, with a digit, a lower-case and an upper-case letter.";

const FRIENDLY_MESSAGES: Record<string, string> = {
  NETWORK_ERROR: "Couldn't reach the Pertly server. Check your connection and try again.",
  INVALID_CREDENTIALS: "That email and password don't match.",
  USER_INACTIVE: "This account has been deactivated. Ask an admin to reactivate it.",
  REGISTRATION_DISABLED: "Registration is closed. Ask an admin to create an account for you.",
  INVALID_MAIL: "Enter a valid email address.",
  PASSWORD_MISMATCH: "The passwords don't match.",
  PASSWORD_REQUIREMENT: `Password too weak. ${PASSWORD_RULES}`,
  NAME_REQUIRED: "First and last name are required.",
  ALREADY_IN_USE: "An account with this email already exists.",
  LAST_ADMIN: "There has to be at least one active admin. Make someone else an admin first.",
  CANNOT_MODIFY_SELF: "You can't change or delete your own account here. Ask another admin to do it.",
  USER_NOT_FOUND: "That user no longer exists.",
  FORBIDDEN: "Only admins can do that.",
  PDF_UNAVAILABLE: "The PDF renderer is unavailable right now. Try again in a moment.",
  DOCUMENT_TOO_LARGE: "This document is too large to save or export.",
};

/** Turns any thrown value into a sentence suitable for showing inline. */
export function friendlyErrorMessage(err: unknown): string {
  if (isApiError(err)) return FRIENDLY_MESSAGES[err.code] ?? err.message;
  if (err instanceof Error && err.message) return err.message;
  return "Something went wrong. Please try again.";
}

export function errorCode(err: unknown): string | null {
  return isApiError(err) ? err.code : null;
}

/**
 * True if retrying the same request can't succeed: a 4xx other than 401
 * (session; handled by re-login), 408 or 429 (transient). Network errors
 * (status 0) and 5xx are transient too.
 */
export function isPermanentRejection(err: unknown): boolean {
  if (!isApiError(err)) return false;
  return err.status >= 400 && err.status < 500 && err.status !== 401 && err.status !== 408 && err.status !== 429;
}
