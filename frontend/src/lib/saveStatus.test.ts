import { describe, expect, it } from "vitest";
import { saveStatusLabel } from "./saveStatus";

describe("saveStatusLabel", () => {
  it("shows the in-progress label while saving", () => {
    expect(saveStatusLabel("saving")).toBe("Saving…");
  });

  it("shows the same 'saved' label for idle and saved, as before the web migration", () => {
    expect(saveStatusLabel("saved")).toBe("Saved just now");
    expect(saveStatusLabel("idle")).toBe("Saved just now");
  });

  it("tells the user a failed save is being retried", () => {
    expect(saveStatusLabel("error")).toBe("Not saved – retrying…");
  });

  it("names what was rejected and why", () => {
    expect(saveStatusLabel("rejected", { kind: "estimate", code: "DOCUMENT_TOO_LARGE", message: "" })).toBe(
      "Not saved – estimate too large",
    );
    expect(saveStatusLabel("rejected", { kind: "settings", code: "DOCUMENT_TOO_LARGE", message: "" })).toBe(
      "Not saved – settings too large",
    );
    expect(saveStatusLabel("rejected", { kind: "estimate", code: "INVALID_ESTIMATE", message: "" })).toBe(
      "Not saved – estimate rejected by server",
    );
    expect(saveStatusLabel("rejected", null)).toBe("Not saved – estimate rejected by server");
  });
});
