// Broadcast wording for a fight (V3). One place so the saved play-by-play and the live feed read alike.
// Pure and client-safe.

export type FightMeta = {
  kind?: "draw" | "edge" | "decisive";
  winnerId?: number | null;
  style?: number;
  hurtNames?: string[];
};

const DECISIVE = [
  "lands a heavy right and sends {L} to the ice",
  "rocks {L} with a flurry of lefts and the linesmen step in",
  "wrestles {L} down and gets in a few clean shots",
  "overpowers {L} and there is no doubt about this one",
];
const EDGE = [
  "gets the better of {L} in the exchange",
  "lands the cleaner punches on {L}",
  "wins the tussle with {L} on points",
  "gets the best of {L} before the linesmen step in",
];
const DRAW = [
  "trade punches until the linesmen separate them — a draw",
  "grapple, swing and tie each other up; nobody gets the upper hand",
  "exchange a few shots and fall to the ice together — call it even",
  "bump, shove and drop the gloves — it ends level",
];

/** "Fight: X wins a heavy decision over Y… Both receive 5-minute majors. Y is hurt in the fight." */
export function fightText(m: FightMeta, aName: string, bName: string, aId?: number | null): string {
  const style = Math.abs(m.style ?? 0);
  const aWon = m.winnerId != null && m.winnerId === aId;
  const bWon = m.winnerId != null && !aWon;
  const [w, l] = aWon ? [aName, bName] : [bName, aName];
  let body: string;
  if (m.kind === "draw" || (!aWon && !bWon)) body = `${aName} and ${bName} ${DRAW[style % DRAW.length]}.`;
  else if (m.kind === "decisive") body = `${w} ${DECISIVE[style % DECISIVE.length].replace("{L}", l)}.`;
  else body = `${w} ${EDGE[style % EDGE.length].replace("{L}", l)}.`;
  const hurt = (m.hurtNames ?? []).length ? ` ${(m.hurtNames ?? []).join(" and ")} ${(m.hurtNames ?? []).length > 1 ? "are" : "is"} hurt in the fight.` : "";
  return `Fight: ${aName} versus ${bName}. ${body} Both receive 5-minute majors.${hurt}`;
}
