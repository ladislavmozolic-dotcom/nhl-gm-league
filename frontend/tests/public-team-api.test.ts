import assert from "node:assert/strict";
import { test, type TestContext } from "node:test";
import { prisma } from "../lib/prisma";
import { GET as listTeams } from "../app/api/teams/route";
import { GET as getTeam } from "../app/api/teams/[id]/route";

const publicTeam = {
  id: 1, name: "Test Team", slug: "test-team", code: "TST",
  logoUrl: null, conference: "Eastern", division: "Atlantic",
};
const storedTeam: Record<string, unknown> = {
  ...publicTeam,
  passwordHash: "private-hash", gmEmail: "private@example.test",
  gmFirstName: "Private", gmLastName: "Name", isAdmin: true,
  bankAccount: 1234, futurePrivateField: "must-stay-private",
};

// Model Prisma's field projection without connecting to any database. Removing
// select or adding a private field makes the response assertions fail.
function project(select?: Record<string, unknown>) {
  return select
    ? Object.fromEntries(Object.entries(storedTeam).filter(([key]) => select[key] === true))
    : storedTeam;
}

// Prisma delegates are proxies, so node:test's descriptor-based mock.method
// cannot patch them. Replace the method through the proxy and restore per test.
function stub(t: TestContext, method: "findMany" | "findUnique", implementation: unknown) {
  const delegate = prisma.team;
  const original = delegate[method];
  t.after(() => { Reflect.set(delegate, method, original); });
  Reflect.set(delegate, method, implementation);
  assert.equal(delegate[method], implementation);
}

test("anonymous team list exposes only navigation fields and preserves ordering", async (t) => {
  stub(t, "findMany", async (args: { select?: Record<string, unknown>; orderBy: unknown }) => {
    assert.deepEqual(args.orderBy, { name: "asc" });
    return [project(args.select)];
  });
  const response = await listTeams();
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), [publicTeam]);
});

test("anonymous team detail exposes only navigation fields", async (t) => {
  stub(t, "findUnique", async (args: { select?: Record<string, unknown>; where: unknown }) => {
    assert.deepEqual(args.where, { id: 1 });
    return project(args.select);
  });
  const response = await getTeam(new Request("http://localhost/api/teams/1"), { params: Promise.resolve({ id: "1" }) });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), publicTeam);
});

test("missing team preserves the existing null response", async (t) => {
  stub(t, "findUnique", async () => null);
  const response = await getTeam(new Request("http://localhost/api/teams/999"), { params: Promise.resolve({ id: "999" }) });
  assert.equal(response.status, 200);
  assert.equal(await response.json(), null);
});
