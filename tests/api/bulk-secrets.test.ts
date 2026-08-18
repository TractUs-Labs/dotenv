import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/db/client", () => ({ getDb: vi.fn(() => ({})) }));
vi.mock("@/lib/auth/session", () => ({
  requireUser: vi.fn(async () => ({ id: "user-1" })),
  UnauthorizedError: class UnauthorizedError extends Error {},
}));
vi.mock("@/lib/access/authorize", () => ({
  effectiveRoleForEnv: vi.fn(async () => "member"),
}));
vi.mock("@/lib/access/roles", () => ({
  roleAtLeast: vi.fn(() => true),
}));
vi.mock("@/lib/crypto/kek", () => ({
  loadKek: vi.fn(() => Buffer.from("key")),
}));
vi.mock("@/lib/env", () => ({
  env: { kekFile: vi.fn(() => "/tmp/kek") },
}));

const mockCreateSecret = vi.fn(async (_db: unknown, _kek: Buffer, input: { key: string }) =>
  ({ id: `secret-${input.key}`, key: input.key })
);
vi.mock("@/lib/secrets/secrets", () => ({
  createSecret: (...args: unknown[]) => mockCreateSecret(...args),
}));

function makeRequest(body: unknown) {
  return new NextRequest("http://localhost/api/environments/env-1/secrets/bulk", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

describe("POST /api/environments/[envId]/secrets/bulk", () => {
  beforeEach(() => vi.clearAllMocks());

  it("creates all valid secrets and returns count", async () => {
    mockCreateSecret.mockResolvedValueOnce({ id: "s1", key: "FOO" });
    mockCreateSecret.mockResolvedValueOnce({ id: "s2", key: "BAR" });

    const { POST } = await import("@/app/api/environments/[envId]/secrets/bulk/route");
    const res = await POST(makeRequest({ secrets: [{ key: "FOO", value: "foo" }, { key: "BAR", value: "bar" }] }), {
      params: Promise.resolve({ envId: "env-1" }),
    });

    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.created).toBe(2);
    expect(json.skipped).toEqual([]);
  });

  it("skips keys that already exist (createSecret throws) and continues", async () => {
    mockCreateSecret.mockRejectedValueOnce(new Error("unique constraint"));
    mockCreateSecret.mockResolvedValueOnce({ id: "s2", key: "BAR" });

    const { POST } = await import("@/app/api/environments/[envId]/secrets/bulk/route");
    const res = await POST(makeRequest({ secrets: [{ key: "FOO", value: "foo" }, { key: "BAR", value: "bar" }] }), {
      params: Promise.resolve({ envId: "env-1" }),
    });

    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.created).toBe(1);
    expect(json.skipped).toEqual(["FOO"]);
  });

  it("returns 403 when user lacks member role", async () => {
    const { roleAtLeast } = await import("@/lib/access/roles");
    vi.mocked(roleAtLeast).mockReturnValueOnce(false);

    const { POST } = await import("@/app/api/environments/[envId]/secrets/bulk/route");
    const res = await POST(makeRequest({ secrets: [] }), {
      params: Promise.resolve({ envId: "env-1" }),
    });
    expect(res.status).toBe(403);
  });

  it("returns 400 on invalid body", async () => {
    const { POST } = await import("@/app/api/environments/[envId]/secrets/bulk/route");
    const res = await POST(makeRequest({ wrong: true }), {
      params: Promise.resolve({ envId: "env-1" }),
    });
    expect(res.status).toBe(400);
  });
});
