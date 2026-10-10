import { describe, expect, it } from "vitest";
import { ApiError } from "./api";
import { friendlyErrorMessage, isPermanentRejection } from "./apiErrors";

describe("isPermanentRejection", () => {
  it("treats validation and size rejections as permanent", () => {
    expect(isPermanentRejection(new ApiError(413, "DOCUMENT_TOO_LARGE", ""))).toBe(true);
    expect(isPermanentRejection(new ApiError(422, "INVALID_ESTIMATE", ""))).toBe(true);
    expect(isPermanentRejection(new ApiError(422, "ID_MISMATCH", ""))).toBe(true);
    expect(isPermanentRejection(new ApiError(422, "VALIDATION_ERROR", ""))).toBe(true);
    expect(isPermanentRejection(new ApiError(403, "CLIENT_HEADER_MISSING", ""))).toBe(true);
  });

  it("treats auth, timeouts, rate limits, server and network errors as retryable", () => {
    expect(isPermanentRejection(new ApiError(401, "UNAUTHORIZED", ""))).toBe(false);
    expect(isPermanentRejection(new ApiError(408, "UNKNOWN", ""))).toBe(false);
    expect(isPermanentRejection(new ApiError(429, "UNKNOWN", ""))).toBe(false);
    expect(isPermanentRejection(new ApiError(500, "UNKNOWN", ""))).toBe(false);
    expect(isPermanentRejection(new ApiError(503, "UNKNOWN", ""))).toBe(false);
    expect(isPermanentRejection(new ApiError(0, "NETWORK_ERROR", ""))).toBe(false);
  });

  it("is false for non-API errors", () => {
    expect(isPermanentRejection(new Error("boom"))).toBe(false);
    expect(isPermanentRejection(undefined)).toBe(false);
  });
});

describe("friendlyErrorMessage", () => {
  it("maps known codes and falls back to the server message", () => {
    expect(friendlyErrorMessage(new ApiError(409, "LAST_ADMIN", "x"))).toMatch(/at least one active admin/);
    expect(friendlyErrorMessage(new ApiError(418, "SOMETHING_NEW", "Server says no."))).toBe("Server says no.");
    expect(friendlyErrorMessage(new Error("Plain error"))).toBe("Plain error");
    expect(friendlyErrorMessage(null)).toMatch(/Something went wrong/);
  });
});
