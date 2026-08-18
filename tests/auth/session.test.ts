import { describe, it, expect, vi } from "vitest";

// Mock the Auth.js module so next-auth/next/server is not loaded in vitest
vi.mock("@/lib/auth/auth", () => ({ auth: vi.fn() }));

import { UnauthorizedError } from "@/lib/auth/session";

describe("session", () => {
  it("UnauthorizedError has the right name", () => {
    const e = new UnauthorizedError();
    expect(e).toBeInstanceOf(Error);
    expect(e.name).toBe("UnauthorizedError");
  });
});
