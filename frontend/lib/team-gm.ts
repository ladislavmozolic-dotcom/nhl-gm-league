type TeamGm = {
  gm: string;
  gmNickname: string | null;
  gmFirstName: string | null;
  gmLastName: string | null;
  passwordHash: string | null;
};

type TeamWithParentGm = TeamGm & {
  parentTeam?: TeamGm | null;
};

export function teamManagerLabel(team: TeamWithParentGm): string {
  // Affiliate teams are managed through their NHL parent and intentionally do
  // not have a separate password. Resolve the parent first, then use the same
  // registered-GM fields and rule as the League directory.
  const manager = team.parentTeam ?? team;
  if (!manager.passwordHash) return "🤖 AI GM";

  return [manager.gmFirstName, manager.gmLastName].filter(Boolean).join(" ").trim()
    || manager.gmNickname
    || manager.gm
    || "GM";
}
