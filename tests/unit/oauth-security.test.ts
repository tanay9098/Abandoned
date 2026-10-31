import { describe, expect, it } from "vitest";
import { decodeTransaction, encodeTransaction, newTransaction, validateCallback } from "@/server/integrations/google-calendar/oauth";
import { decryptJson, encryptJson } from "@/server/integrations/google-calendar/crypto";
import { signSession, verifySession } from "@/server/auth/session";

const NOW = Date.parse("2026-11-02T09:00:00Z");
const U = "11111111-1111-4111-8111-111111111111";

describe("OAuth callback validation", () => {
  const tx = newTransaction(U, NOW);
  const ok = { state: tx.state, code: "abc", error: null };

  it("accepts a matching state for the same user", () => {
    expect(validateCallback(tx, ok, U, NOW + 1000)).toEqual({ code: "abc", verifier: tx.verifier });
  });
  it("rejects a mismatched state", () => {
    expect(() => validateCallback(tx, { ...ok, state: "x".repeat(tx.state.length) }, U, NOW)).toThrow(/state/i);
    expect(() => validateCallback(tx, { ...ok, state: null }, U, NOW)).toThrow();
  });
  it("rejects a missing, expired, or other-user transaction", () => {
    expect(() => validateCallback(null, ok, U, NOW)).toThrow(/session not found/i);
    expect(() => validateCallback(tx, ok, U, NOW + 11 * 60_000)).toThrow(/expired/i);
    expect(() => validateCallback(tx, ok, "22222222-2222-4222-8222-222222222222", NOW)).toThrow(/different session/i);
  });
  it("surfaces provider errors and missing codes", () => {
    expect(() => validateCallback(tx, { ...ok, error: "access_denied" }, U, NOW)).toThrow(/not granted/i);
    expect(() => validateCallback(tx, { ...ok, code: null }, U, NOW)).toThrow(/code/i);
  });
  it("the cookie is tamper-evident", () => {
    const cookie = encodeTransaction(tx);
    expect(decodeTransaction(cookie)?.state).toBe(tx.state);
    const [payload, mac] = cookie.split(".");
    const forged = Buffer.from(JSON.stringify({ ...tx, userId: "22222222-2222-4222-8222-222222222222" })).toString("base64url");
    expect(decodeTransaction(`${forged}.${mac}`)).toBeNull();
    expect(decodeTransaction(`${payload}.bad`)).toBeNull();
    expect(decodeTransaction(undefined)).toBeNull();
    expect(decodeTransaction("garbage")).toBeNull();
  });
});

describe("token encryption", () => {
  it("round-trips and does not leak plaintext", () => {
    const e = encryptJson({ accessToken: "super-secret", refreshToken: "r" });
    expect(e).not.toContain("super-secret");
    expect(decryptJson<{ accessToken: string }>(e).accessToken).toBe("super-secret");
  });
  it("uses a fresh IV each time and detects tampering", () => {
    const a = encryptJson({ x: 1 });
    const b = encryptJson({ x: 1 });
    expect(a).not.toBe(b);
    const parts = a.split(".");
    parts[3] = Buffer.from("tampered").toString("base64url");
    expect(() => decryptJson(parts.join("."))).toThrow();
    expect(() => decryptJson("nonsense")).toThrow();
  });
});

describe("session cookie", () => {
  it("verifies signed cookies and rejects tampering", () => {
    const token = signSession(U);
    expect(verifySession(token)).toBe(U);
    expect(verifySession(token.replace(U, "22222222-2222-4222-8222-222222222222"))).toBeNull();
    expect(verifySession(`${U}.`)).toBeNull();
    expect(verifySession("nope")).toBeNull();
    expect(verifySession(undefined)).toBeNull();
    expect(verifySession(`not-a-uuid.${token.split(".")[1]}`)).toBeNull();
  });
});
