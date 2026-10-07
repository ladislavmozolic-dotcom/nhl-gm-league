// Server-side random seed for a game, drawn from the OS CSPRNG at the moment the game is
// simulated. It is deliberately NOT derived from teams, round, game id or sim count (the old
// fixtureSeed was), so nobody — including the commissioner or a developer — can know or
// pre-compute a game's outcome before it is played. Never import this from client code.
import { randomInt } from "node:crypto";

export function secureSeed(): number {
  return randomInt(-2_147_483_648, 2_147_483_647);
}
