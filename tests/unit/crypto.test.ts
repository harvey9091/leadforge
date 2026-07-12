import { describe, it, expect } from "vitest";
import { hashPassword, verifyPassword, generateToken, hashToken } from "@/server/utils/crypto";

describe("hashPassword / verifyPassword", () => {
  it("hashes a password and verifies it", () => {
    const password = "Leadforge123";
    const hash = hashPassword(password);
    expect(hash).not.toBe(password);
    expect(hash.startsWith("pbkdf2$")).toBe(true);
    expect(verifyPassword(password, hash)).toBe(true);
  });

  it("rejects a wrong password", () => {
    const hash = hashPassword("Correct123");
    expect(verifyPassword("Wrong123", hash)).toBe(false);
  });

  it("produces different hashes for the same password (salt)", () => {
    const a = hashPassword("SamePass1");
    const b = hashPassword("SamePass1");
    expect(a).not.toBe(b);
  });
});

describe("generateToken / hashToken", () => {
  it("generates a URL-safe token of expected length", () => {
    const token = generateToken(32);
    expect(token.length).toBeGreaterThan(40); // 32 bytes = ~43 base64url chars
    expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it("hashes tokens deterministically", () => {
    const token = "abc123";
    expect(hashToken(token)).toBe(hashToken(token));
  });
});
