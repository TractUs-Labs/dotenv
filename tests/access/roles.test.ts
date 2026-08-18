import { describe, it, expect } from "vitest";
import { roleAtLeast, highestRole } from "@/lib/access/roles";

describe("roles", () => {
  it("compares ranks", () => {
    expect(roleAtLeast("admin", "member")).toBe(true);
    expect(roleAtLeast("viewer", "member")).toBe(false);
    expect(roleAtLeast("owner", "owner")).toBe(true);
  });
  it("picks the highest role", () => {
    expect(highestRole(["viewer", "admin", "member"])).toBe("admin");
    expect(highestRole([])).toBeNull();
  });
});
