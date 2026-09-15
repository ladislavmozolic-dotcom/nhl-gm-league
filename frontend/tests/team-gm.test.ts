import assert from "node:assert/strict";
import { test } from "node:test";
import { teamManagerLabel } from "../lib/team-gm";

const gm = {
  gm: "Legacy name",
  gmNickname: "Laco",
  gmFirstName: "Ladislav",
  gmLastName: "Mozolic",
  passwordHash: "hash",
};

test("an affiliate displays the GM of its NHL parent", () => {
  assert.equal(teamManagerLabel({
    gm: "Farm placeholder",
    gmNickname: null,
    gmFirstName: null,
    gmLastName: null,
    passwordHash: null,
    parentTeam: { ...gm, gmNickname: null, gmFirstName: "Adam", gmLastName: "Papoušek" },
  }), "Adam Papoušek");
});

test("an affiliate follows the League directory when its parent has no registered GM", () => {
  assert.equal(teamManagerLabel({
    ...gm,
    passwordHash: null,
    parentTeam: { ...gm, passwordHash: null },
  }), "🤖 AI GM");
});

test("an NHL team displays its own GM", () => {
  assert.equal(teamManagerLabel(gm), "Ladislav Mozolic");
});

test("nickname is used when the registered GM has no full name", () => {
  assert.equal(teamManagerLabel({ ...gm, gmFirstName: null, gmLastName: null }), "Laco");
});

test("a team without a registered manager displays AI GM", () => {
  assert.equal(teamManagerLabel({ ...gm, passwordHash: null }), "🤖 AI GM");
});
