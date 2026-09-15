import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { test } from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";

// Run actual action bodies with isolated dependencies: no DB or network access.
const root = resolve(import.meta.dirname, "..");
const reachedEffect = new Error("Reached protected dependency");
function load(relative: string, admin: boolean) {
  const calls: string[] = [];
  const source = readFileSync(resolve(root, relative), "utf8");
  const code = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const effect: unknown = new Proxy(() => undefined, {
    get: () => effect,
    apply: () => { calls.push("effect"); throw reachedEffect; },
  });
  const exports: Record<string, (...args: unknown[]) => Promise<unknown>> = {};
  runInNewContext(code, {
    exports,
    require: (name: string) => {
      if (name === "server-only") return {};
      if (name === "@/lib/auth") return {
        isAdmin: async () => { calls.push("auth"); return admin; },
      };
      return effect;
    },
  });
  return { exports, calls, source };
}

for (const path of ["app/admin/season/actions.ts", "app/admin/rosters/actions.ts", "app/admin/profile/actions.ts"]) {
  for (const name of Object.keys(load(path, false).exports)) {
    test(`${path}: ${name} rejects non-admins before accessing dependencies`, async () => {
      const { exports, calls } = load(path, false);
      let denied = false;
      try {
        const result = await exports[name]();
        denied = (result as { ok?: boolean } | undefined)?.ok === false;
      } catch (error) {
        assert.match(String(error), /admin/i);
        denied = true;
      }
      assert.equal(denied, true);
      assert.deepEqual(calls, ["auth"]);
    });
  }
}

const allowed: Array<[string, string, unknown[]]> = [
  ["season", "archiveSeasonAction", []],
  ["season", "importNhlApiAction", []],
  ["season", "importCsvAction", [{ get: () => { throw reachedEffect; } }]],
  ["season", "generateScheduleAction", [82]],
  ["season", "playSeasonAction", []],
  ["season", "runPlayoffsAction", []],
  ["season", "resetSeasonAction", []],
  ["rosters", "applyRosterMode", ["real"]],
  ["rosters", "getRosterConfig", []],
  ["profile", "searchProfilePlayers", ["Test"]],
  ["profile", "savePlayerProfile", [1, {}]],
];
for (const [area, name, args] of allowed) {
  test(`${name} lets an admin reach its existing operation`, async () => {
    const { exports, calls } = load(`app/admin/${area}/actions.ts`, true);
    await assert.rejects(exports[name](...args), (error) => error === reachedEffect);
    assert.equal(calls[0], "auth");
  });
}

test("scheduled simulation stays internal and needs no user session", async () => {
  const actions = load("app/admin/season/actions.ts", false);
  for (const name of ["simulateLeagueDay", "advanceLeagueDayCore", "autoRenewFarmDeals"]) {
    assert.equal(actions.exports[name], undefined);
  }
  const internal = load("lib/season-day.ts", false);
  assert.match(internal.source, /import "server-only"/);
  assert.doesNotMatch(internal.source, /["']use server["']/);
  await assert.rejects(internal.exports.simulateLeagueDay(new Date()), (error) => error === reachedEffect);
  assert.deepEqual(internal.calls, ["effect"]);
  const cron = readFileSync(resolve(root, "lib/season-cron.ts"), "utf8");
  assert.match(cron, /import \{ simulateLeagueDay \} from "@\/lib\/season-day"/);
});
