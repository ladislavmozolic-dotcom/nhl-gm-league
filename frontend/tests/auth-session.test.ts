import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { runInNewContext } from "node:vm";
import * as crypto from "node:crypto";
import ts from "typescript";
import { authConfig } from "../lib/auth-config";
import * as tokens from "../lib/session-token";

const secret = "a".repeat(64);
const hash = crypto.createHash("sha256").update("profinhl-saltpassword").digest("hex");
const now = Date.now();

test("production rejects missing, short and known sample secrets", () => {
  for (const value of [undefined, "", "short", "profinhl-dev-secret-change-me", "CHANGE-ME-".repeat(8)]) {
    assert.throws(() => authConfig({ NODE_ENV: "production", AUTH_SECRET: value, AUTH_SALT: "profinhl-salt" }), /AUTH_SECRET/);
  }
  assert.throws(() => authConfig({ NODE_ENV: "production", AUTH_SECRET: secret }), /AUTH_SALT/);
  assert.deepEqual(authConfig({ NODE_ENV: "production", AUTH_SECRET: secret, AUTH_SALT: "profinhl-salt" }), { secret, salt: "profinhl-salt" });
});

test("session signature, format and absolute expiry are enforced", () => {
  const token = tokens.encodeSession(1, 2, hash, secret, now);
  assert.equal(tokens.decodeSession(token, secret, now)?.teamId, 1);
  assert.equal(tokens.decodeSession(token, secret, now + tokens.SESSION_TTL_SECONDS * 1000), null);
  for (const bad of [token + ".extra", token.slice(0, -1), "1.signature", "x".repeat(1025), token.replace("v1.", "v2.")]) {
    assert.equal(tokens.decodeSession(bad, secret, now), null);
  }
  assert.equal(tokens.decodeSession(token, "b".repeat(64), now), null);
  const parts = token.split(".");
  const claims = JSON.parse(Buffer.from(parts[1], "base64url").toString());
  claims.teamId = 2;
  parts[1] = Buffer.from(JSON.stringify(claims)).toString("base64url");
  assert.equal(tokens.decodeSession(parts.join("."), secret, now), null);
  for (const id of [0, -1, 1.5]) assert.equal(tokens.decodeSession(tokens.encodeSession(id, 0, hash, secret, now), secret, now), null);
});

// Real auth functions and cryptography, with only DB/cookie/framework boundaries
// replaced. No real DB connection, production writes or network requests.
function harness() {
  let team: { passwordHash: string | null; sessionVersion: number } | null = { passwordHash: hash, sessionVersion: 0 };
  let cookie: string | undefined;
  const writes: Array<{ token: string; options: { expires: Date; httpOnly: boolean; secure: boolean } }> = [];
  const exports: {
    setTeamSession: (id: number, hash: string) => Promise<string>;
    getTeamSession: () => Promise<number | null>;
    resumeTeamSession: (token: string | null) => Promise<boolean>;
    verifyPassword: (password: string, hash: string) => boolean;
  } = {} as never;
  const source = readFileSync(resolve(import.meta.dirname, "../lib/auth.ts"), "utf8");
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  const dependencies: Record<string, unknown> = {
    react: { cache: (fn: unknown) => fn },
    "next/headers": { cookies: async () => ({
      get: () => cookie ? { value: cookie } : undefined,
      set: (_name: string, value: string, options: typeof writes[number]["options"]) => { cookie = value; writes.push({ token: value, options }); },
    }) },
    "node:crypto": crypto,
    "./prisma": { prisma: { team: { findUnique: async () => team } } },
    "./auth-config": { authConfig: () => ({ secret, salt: "profinhl-salt" }) },
    "./session-token": tokens,
  };
  runInNewContext(code, { exports, Buffer, process: { env: { NODE_ENV: "production" } }, require: (name: string) => {
    assert.ok(name in dependencies, `Unexpected dependency ${name}`);
    return dependencies[name];
  } });
  return { auth: exports, writes, setTeam: (value: typeof team) => { team = value; }, setCookie: (value: string) => { cookie = value; } };
}

test("existing password hashes still verify and issued cookies are secure", async () => {
  const h = harness();
  assert.equal(h.auth.verifyPassword("password", hash), true);
  assert.equal(h.auth.verifyPassword("wrong", hash), false);
  await h.auth.setTeamSession(1, hash);
  assert.equal(await h.auth.getTeamSession(), 1);
  assert.equal(h.writes[0].options.httpOnly, true);
  assert.equal(h.writes[0].options.secure, true);
});

test("resume restores the original token without extending expiry", async () => {
  const h = harness();
  const token = tokens.encodeSession(1, 0, hash, secret, now - 86400_000);
  assert.equal(await h.auth.resumeTeamSession(token), true);
  assert.equal(h.writes[0].token, token);
  assert.equal(h.writes[0].options.expires.getTime(), tokens.decodeSession(token, secret)!.expiresAt * 1000);
});

for (const [name, state] of [
  ["removed team", null],
  ["vacated team", { passwordHash: null, sessionVersion: 0 }],
  ["changed password", { passwordHash: "new-hash", sessionVersion: 0 }],
  ["reassigned or reclaimed seat, even with identical password", { passwordHash: hash, sessionVersion: 1 }],
] as const) {
  test(`${name} invalidates cookies and remember-tokens`, async () => {
    const h = harness();
    const token = await h.auth.setTeamSession(1, hash);
    h.setTeam(state);
    assert.equal(await h.auth.getTeamSession(), null);
    assert.equal(await h.auth.resumeTeamSession(token), false);
    assert.equal(h.writes.length, 1);
  });
}

test("legacy and expired remember-tokens cannot mint new sessions", async () => {
  const h = harness();
  for (const token of ["1.signature", tokens.encodeSession(1, 0, hash, secret, now - 31 * 86400_000)]) {
    h.setCookie(token);
    assert.equal(await h.auth.getTeamSession(), null);
    assert.equal(await h.auth.resumeTeamSession(token), false);
  }
  assert.equal(h.writes.length, 0);
});

test("credentials changed during login cannot issue a session", async () => {
  const h = harness();
  h.setTeam({ passwordHash: "replacement", sessionVersion: 1 });
  await assert.rejects(h.auth.setTeamSession(1, hash), /Credentials changed/);
  assert.equal(h.writes.length, 0);
});

// Verify that the real account-management actions actually bump the version in
// the SAME Team update as the credential change (not just the token validator).
function lifecycle(relative: string, seats: Array<Record<string, unknown>>) {
  const updates: Array<{ where: { id: number }; data: Record<string, unknown> }> = [];
  let cleared = false;
  const redirectSignal = new Error("redirect");
  const exports: Record<string, (...args: unknown[]) => Promise<unknown>> = {};
  const dependencies: Record<string, unknown> = {
    "@/lib/auth": {
      isAdmin: async () => true, getTeamSession: async () => 1,
      verifyPassword: () => true, hashPassword: () => "new-hash",
      clearTeamSession: async () => { cleared = true; },
    },
    "@/lib/prisma": { prisma: {
      team: {
        findUnique: async () => seats[0], findMany: async () => seats,
        update: async (args: typeof updates[number]) => { updates.push(args); return {}; },
      },
      joinRequest: {
        findUnique: async () => ({ id: 1, teamId: 1, status: "pending", passwordHash: hash, email: "gm@example.test" }),
        update: async () => ({}), updateMany: async () => ({}),
      },
      $transaction: async (ops: Promise<unknown>[]) => Promise.all(ops),
    } },
    "next/cache": { revalidatePath: () => undefined },
    "next/navigation": { redirect: () => { throw redirectSignal; } },
    "@/lib/email": { sendWelcomeEmail: async () => undefined },
  };
  const code = ts.transpileModule(readFileSync(resolve(import.meta.dirname, "..", relative), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText;
  runInNewContext(code, { exports, require: (name: string) => {
    // Other dashboard imports are unused by the GM reassignment path.
    return dependencies[name] ?? new Proxy({}, { get: () => () => { throw new Error(`Unexpected call into ${name}`); } });
  } });
  return { exports, updates, redirectSignal, wasCleared: () => cleared };
}

for (const action of ["removeGmAction", "approveJoinRequest"]) {
  test(`${action} revokes sessions atomically with the Team update`, async () => {
    const h = lifecycle("app/admin/join-requests/actions.ts", [{ id: 1, passwordHash: null }]);
    const form = new FormData(); form.set("id", "1"); form.set("teamId", "1");
    await h.exports[action](form);
    assert.equal(h.updates.length, 1);
    assert.equal((h.updates[0].data.sessionVersion as { increment: number }).increment, 1);
    assert.equal(h.updates[0].data.passwordHash, action === "removeGmAction" ? null : hash);
  });
}

test("GM reassignment revokes both seats instead of copying a session version", async () => {
  const h = lifecycle("app/admin/dashboard/actions.ts", [
    { id: 1, name: "A", passwordHash: hash, sessionVersion: 12 },
    { id: 2, name: "B", passwordHash: hash, sessionVersion: 2 },
  ]);
  await h.exports.reassignGmTeamAction(1, 2);
  assert.equal(h.updates.length, 2);
  for (const update of h.updates) assert.equal((update.data.sessionVersion as { increment: number }).increment, 1);
});

test("password change revokes sessions and clears the current cookie", async () => {
  const h = lifecycle("app/teams/[slug]/profile/actions.ts", [{ id: 1, passwordHash: hash }]);
  const form = new FormData();
  for (const key of ["slug", "firstName", "lastName", "nickname", "email", "currentPassword", "newPassword"]) form.set(key, "test-value");
  await assert.rejects(h.exports.updateProfile(form), (error) => error === h.redirectSignal);
  assert.equal(h.updates[0].data.passwordHash, "new-hash");
  assert.equal((h.updates[0].data.sessionVersion as { increment: number }).increment, 1);
  assert.equal(h.wasCleared(), true);
});
