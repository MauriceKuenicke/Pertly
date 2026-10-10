import type { SaveRejection } from "./storeDiff";

/**
 * "error": a save failed for a transient reason (network, server, expired
 * session) and will be retried. "rejected": the server refused a change for
 * good; it stays unsaved until the user edits it again.
 */
export type SaveStatus = "idle" | "saving" | "saved" | "error" | "rejected";

/** The save indicator text shown in the wizard top bar and on Settings. */
export function saveStatusLabel(status: SaveStatus, rejection?: SaveRejection | null): string {
  switch (status) {
    case "saving":
      return "Saving…";
    case "error":
      return "Not saved – retrying…";
    case "rejected": {
      const subject = rejection?.kind === "settings" ? "settings" : "estimate";
      const reason = rejection?.code === "DOCUMENT_TOO_LARGE" ? "too large" : "rejected by server";
      return `Not saved – ${subject} ${reason}`;
    }
    default:
      return "Saved just now";
  }
}
