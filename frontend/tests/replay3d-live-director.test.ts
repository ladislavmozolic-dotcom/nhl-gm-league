import test from "node:test";
import assert from "node:assert/strict";
import { LiveDirector, nameKey, type LiveTeam } from "../lib/replay3d/live-director";
import { RINK } from "../lib/replay3d/reconstruct";
import type { SimEvent } from "../lib/sim/events";

const team = (teamId: number, code: string, pre: string): LiveTeam => ({
  teamId, code,
  fLines: Array.from({ length: 4 }, (_, l) => Array.from({ length: 3 }, (_, i) => ({ name: `${pre}. F${l}${i}`, number: 10 + l * 3 + i, role: "F" as const }))),
  dPairs: Array.from({ length: 3 }, (_, l) => Array.from({ length: 2 }, (_, i) => ({ name: `${pre}. D${l}${i}`, number: 2 + l * 2 + i, role: "D" as const }))),
  goalie: { name: `${pre}. Goalie`, number: 31, role: "G" },
});

let seq = 0;
const ev = (e: Partial<SimEvent>): SimEvent => ({ seq: seq++, period: 1, seconds: 0, type: "SHOT", importance: "NOTABLE", ...e });

test("name keys match full and short spellings", () => {
  assert.equal(nameKey("Jesper Bratt (R)"), "j. bratt");
  assert.equal(nameKey("J. Bratt"), "j. bratt");
  assert.equal(nameKey("Jean-Gabriel Pageau"), "j. pageau");
});

test("live director turns a feed into valid clips with the right players", () => {
  const d = new LiveDirector(team(1, "HOM", "H"), team(2, "AWY", "A"), 99);
  const feed = [
    ev({ type: "ZONE_ENTRY", teamId: 1, seconds: 20, playerName: "H. F01" }),
    ev({ type: "SHOT", teamId: 1, seconds: 31, playerName: "Hank Scorer", sector: "SLOT", shotType: "WRIST" }),
    ev({ type: "SAVE", teamId: 2, seconds: 31, playerName: "A. Goalie", targetName: "Hank Scorer", sector: "SLOT", shotType: "WRIST" }),
    ev({ type: "HIT", teamId: 2, seconds: 50, playerName: "A. D00", targetName: "H. F00" }),
    ev({ type: "BLOCK", teamId: 2, seconds: 70, playerName: "A. D01", targetName: "H. D00" }),
    ev({ type: "PENALTY", teamId: 2, seconds: 90, playerName: "A. F10", meta: { penalty: "Tripping", minutes: 2, givesPP: true } }),
    ev({ type: "GOAL", teamId: 1, seconds: 120, playerName: "H. F21", strength: "PP", sector: "CIRCLE", shotType: "ONE_TIMER", importance: "HIGHLIGHT", meta: { assistNames: ["H. F20", "H. D10"] } }),
    ev({ type: "GOALIE_PULL", teamId: 2, period: 3, seconds: 1100 }),
    ev({ type: "GOAL", teamId: 1, period: 3, seconds: 1150, playerName: "H. F30", importance: "HIGHLIGHT", meta: { emptyNet: true, assistNames: [] } }),
  ];
  const kinds: string[] = [];
  let goals = 0;
  // events trickle in like the live poll does; the view drains the queue between them
  const items = feed.flatMap((e) => { d.ingest([e]); const out = []; while (d.pending) out.push(d.next()); return out; });
  for (const item of items) {
    kinds.push(item.kind);
    const c = item.clip;
    assert.ok(c.duration > 1 && c.frames.length > 10);
    for (const fr of c.frames) for (const a of fr.a) assert.ok(a && Number.isFinite(a.x) && Math.abs(a.x) <= RINK.halfLength && Math.abs(a.z) <= RINK.halfWidth);
    if (item.kind === "goal") {
      goals++;
      assert.ok(c.goalT != null);
      const scorer = c.actors.find((a) => a.id === item.focusId);
      assert.ok(scorer && scorer.side === "home", "scorer is on the home unit");
      if (goals === 1) {
        assert.equal(scorer!.name, "H. F21");
        assert.equal(c.actors.filter((a) => a.side === "away" && a.role !== "G").length, 4, "PK unit has four skaters");
      } else {
        assert.equal(c.actors.some((a) => a.side === "away" && a.role === "G"), false, "empty net");
      }
    }
    if (item.kind === "shot" && item.banner?.tone === "save") {
      assert.ok(c.actors.some((a) => a.name === "Hank Scorer"), "unknown shooter swapped onto the ice");
    }
  }
  assert.equal(goals, 2);
  assert.equal(kinds[0], "faceoff");
  assert.ok(kinds.includes("hit") && kinds.includes("stoppage"));
  assert.equal(d.pending, 0);
});

test("a shot split from its goal across two polls becomes one goal clip", () => {
  const d = new LiveDirector(team(1, "HOM", "H"), team(2, "AWY", "A"), 5);
  d.ingest([ev({ type: "SHOT", teamId: 1, period: 2, seconds: 400, playerName: "H. F11", sector: "SLOT" })]);
  const first = []; while (d.pending) first.push(d.next().kind);
  d.ingest([ev({ type: "GOAL", teamId: 1, period: 2, seconds: 400, playerName: "H. F11", sector: "SLOT", importance: "HIGHLIGHT", meta: { assistNames: [] } })]);
  const second = []; while (d.pending) second.push(d.next().kind);
  assert.deepEqual(first, []); // joined mid-game (no opening draw) and the lone SHOT waits for its outcome
  assert.deepEqual(second, ["goal", "faceoff"]);
});

test("joining mid-game stages only the last moments, not the whole history", () => {
  const d = new LiveDirector(team(1, "HOM", "H"), team(2, "AWY", "A"), 8);
  const history = Array.from({ length: 80 }, (_, i) => ev({ type: i % 2 ? "SAVE" : "SHOT", teamId: i % 2 ? 2 : 1, period: 1, seconds: 10 + Math.floor(i / 2) * 15, playerName: i % 2 ? "A. Goalie" : "H. F00", targetName: "H. F00", sector: "SLOT" }));
  d.ingest(history);
  assert.ok(d.pending > 0 && d.pending <= 3, `pending ${d.pending}`);
});
