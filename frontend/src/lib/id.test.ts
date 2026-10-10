import { afterEach, describe, expect, it, vi } from "vitest";
import { createId, uuidV4FromRandomValues } from "./id";

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("createId", () => {
  it("uses crypto.randomUUID when available", () => {
    const randomUUID = vi.fn(() => "11111111-2222-4333-8444-555555555555");
    vi.stubGlobal("crypto", { randomUUID, getRandomValues: globalThis.crypto.getRandomValues.bind(globalThis.crypto) });
    expect(createId()).toBe("11111111-2222-4333-8444-555555555555");
    expect(randomUUID).toHaveBeenCalledOnce();
  });

  it("falls back to getRandomValues when randomUUID is missing (insecure http:// context)", () => {
    const realCrypto = globalThis.crypto;
    const getRandomValues = vi.fn((array: Uint8Array) => realCrypto.getRandomValues(array));
    vi.stubGlobal("crypto", { getRandomValues });
    const id = createId();
    expect(id).toMatch(UUID_V4);
    expect(getRandomValues).toHaveBeenCalledOnce();
  });

  it("produces ids accepted by the backend's estimate id pattern", () => {
    expect(createId()).toMatch(/^[A-Za-z0-9_-]{1,64}$/);
  });
});

describe("uuidV4FromRandomValues", () => {
  it("always produces a well-formed v4 UUID", () => {
    for (let i = 0; i < 200; i++) expect(uuidV4FromRandomValues()).toMatch(UUID_V4);
  });

  it("sets the version and variant bits even for all-ones / all-zeros random input", () => {
    vi.stubGlobal("crypto", { getRandomValues: (a: Uint8Array) => a.fill(0xff) });
    expect(uuidV4FromRandomValues()).toBe("ffffffff-ffff-4fff-bfff-ffffffffffff");
    vi.stubGlobal("crypto", { getRandomValues: (a: Uint8Array) => a.fill(0) });
    expect(uuidV4FromRandomValues()).toBe("00000000-0000-4000-8000-000000000000");
  });

  it("does not repeat", () => {
    const ids = new Set(Array.from({ length: 1000 }, () => uuidV4FromRandomValues()));
    expect(ids.size).toBe(1000);
  });
});
