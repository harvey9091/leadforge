import { describe, it, expect } from "vitest";
import { signJwt, verifyJwt } from "@/server/utils/jwt";
import { AuthError } from "@/server/utils/errors";

describe("signJwt / verifyJwt", () => {
  it("round-trips a valid token", () => {
    const token = signJwt({ sub: "user-1", email: "a@b.com", role: "ADMIN" });
    const payload = verifyJwt(token);
    expect(payload.sub).toBe("user-1");
    expect(payload.email).toBe("a@b.com");
    expect(payload.role).toBe("ADMIN");
    expect(payload.type).toBe("access");
  });

  it("rejects a tampered token", () => {
    const token = signJwt({ sub: "user-1", email: "a@b.com", role: "USER" });
    const tampered = token.slice(0, -2) + "XX";
    expect(() => verifyJwt(tampered)).toThrow(AuthError);
  });

  it("rejects a malformed token", () => {
    expect(() => verifyJwt("not.a.jwt")).toThrow(AuthError);
    expect(() => verifyJwt("malformed")).toThrow(AuthError);
  });
});
