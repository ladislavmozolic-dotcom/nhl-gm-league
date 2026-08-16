"use server";

import { prisma } from "./prisma";
import { canManageTeam } from "./auth";
import { leagueFanInterest } from "./fan-interest-server";
import { teamStarPeaks } from "./star-power-server";
import { sponsorOffers, sponsorMax, type SponsorOffer } from "./sponsorship";

export type TeamSponsor = {
  teamId: number; code: string | null; name: string;
  brandStrength: number; offers: SponsorOffer[]; deal: SponsorOffer | null;
};

/** Brand strength 0..1 from Fan Interest (60%) and the club's marquee Star Power (40%). */
async function brandStrengths(): Promise<Map<number, number>> {
  const [fans, peaks] = await Promise.all([leagueFanInterest(), teamStarPeaks()]);
  const out = new Map<number, number>();
  for (const f of fans) {
    const star = peaks.get(f.teamId)?.score ?? 0;
    out.set(f.teamId, clamp(f.interest / 100 * 0.6 + star / 100 * 0.4, 0, 1));
  }
  return out;
}

const asDeal = (j: unknown): SponsorOffer | null => {
  if (!j || typeof j !== "object") return null;
  const o = j as SponsorOffer;
  return typeof o.aav === "number" && typeof o.years === "number" ? o : null;
};

/** Offers + current deal for every NHL club. */
export async function leagueSponsors(): Promise<TeamSponsor[]> {
  const strengths = await brandStrengths();
  const teams = await prisma.team.findMany({ where: { league: "NHL", isAffiliate: false }, select: { id: true, code: true, name: true, sponsorDeal: true } });
  return teams.map((t) => {
    const bs = strengths.get(t.id) ?? 0.3;
    return { teamId: t.id, code: t.code, name: t.name, brandStrength: bs, offers: sponsorOffers(bs), deal: asDeal(t.sponsorDeal) };
  }).sort((a, b) => sponsorMax(b.deal ?? b.offers[0]) - sponsorMax(a.deal ?? a.offers[0]));
}

/** Offers + current deal for one club. */
export async function teamSponsor(teamId: number): Promise<TeamSponsor | null> {
  const all = await leagueSponsors();
  return all.find((r) => r.teamId === teamId) ?? null;
}

/** GM accepts one of the three offers (by index). */
export async function chooseSponsorAction(teamId: number, offerIndex: number): Promise<{ ok: boolean; error?: string }> {
  if (!(await canManageTeam(teamId))) return { ok: false, error: "You don't manage this team." };
  const s = await teamSponsor(teamId);
  if (!s) return { ok: false, error: "Team not found." };
  const offer = s.offers[offerIndex];
  if (!offer) return { ok: false, error: "No such offer." };
  await prisma.team.update({ where: { id: teamId }, data: { sponsorDeal: offer as object } });
  return { ok: true };
}

function clamp(x: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, x));
}
