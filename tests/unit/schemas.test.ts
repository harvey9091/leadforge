import { describe, it, expect } from "vitest";
import {
  loginSchema,
  registerSchema,
  emailSchema,
  passwordSchema,
} from "@/server/utils/schemas";

describe("emailSchema", () => {
  it("accepts valid emails", () => {
    expect(emailSchema.safeParse("user@example.com").success).toBe(true);
    expect(emailSchema.safeParse("a.b+c@sub.example.co").success).toBe(true);
  });
  it("rejects invalid emails", () => {
    expect(emailSchema.safeParse("notanemail").success).toBe(false);
    expect(emailSchema.safeParse("@example.com").success).toBe(false);
    expect(emailSchema.safeParse("user@").success).toBe(false);
    expect(emailSchema.safeParse("").success).toBe(false);
  });
});

describe("passwordSchema", () => {
  it("requires at least 8 chars, upper, lower, digit", () => {
    expect(passwordSchema.safeParse("Abcdefg1").success).toBe(true);
    expect(passwordSchema.safeParse("Abcdefg").success).toBe(false); // no digit
    expect(passwordSchema.safeParse("abcdefg1").success).toBe(false); // no upper
    expect(passwordSchema.safeParse("ABCDEFG1").success).toBe(false); // no lower
    expect(passwordSchema.safeParse("Ab1").success).toBe(false); // too short
  });
});

describe("loginSchema", () => {
  it("accepts valid login input", () => {
    expect(loginSchema.safeParse({ email: "a@b.com", password: "Abcdefg1" }).success).toBe(true);
  });
  it("rejects missing password", () => {
    expect(loginSchema.safeParse({ email: "a@b.com", password: "" }).success).toBe(false);
  });
});

describe("registerSchema", () => {
  it("requires passwords to match", () => {
    const valid = { name: "Ada", email: "a@b.com", password: "Abcdefg1", confirmPassword: "Abcdefg1" };
    expect(registerSchema.safeParse(valid).success).toBe(true);
    const mismatched = { ...valid, confirmPassword: "Different1" };
    expect(registerSchema.safeParse(mismatched).success).toBe(false);
  });
});
