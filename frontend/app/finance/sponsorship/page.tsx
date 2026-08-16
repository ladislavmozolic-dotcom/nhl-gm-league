import { PageHeader, Card } from "@/components/ui";
import InfoTip from "@/components/InfoTip";
import { prisma } from "@/lib/prisma";
import { getTeamSession, canManageTeam } from "@/lib/auth";
import { loadSettings } from "@/lib/sim/settings";
import { leagueSponsors, teamSponsor } from "@/lib/sponsorship-server";
import SponsorPicker from "@/components/SponsorPicker";

export const dynamic = "force-dynamic";

const M = (n: number) => `$${(n / 1e6).toFixed(1)}M`;

export default async function SponsorshipPage() {
  const [settings, board] = await Promise.all([loadSettings(), leagueSponsors()]);

  const sessionId = await getTeamSession();
  const myTeam = sessionId ? await prisma.team.findUnique({ where: { id: sessionId }, select: { id: true, league: true, isAffiliate: true } }) : null;
  const mine = myTeam && myTeam.league === "NHL" && !myTeam.isAffiliate && (await canManageTeam(myTeam.id)) ? await teamSponsor(myTeam.id) : null;

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 space-y-5">
      <PageHeader title="Sponsorship" subtitle="One preseason call — safety vs upside" />
      {settings.financeMode !== "detailed" && (
        <Card><p className="text-sm text-amber-400/80">Part of the <b>Detailed Finance</b> system — switch it on in engine settings. Live preview below.</p></Card>
      )}

      {mine && (
        <Card title="Your main sponsor" accent="text-sky-300">
          <p className="text-sm text-slate-400 mb-3">Pick the deal that fits your club&apos;s ambitions.<InfoTip text="Offer size is set by your brand strength — Fan Interest and roster Star Power. A safe deal pays steady money; a long-term deal trades AAV for a big championship bonus; the one-year deal maximises cash now." /> {sponsor(mine.deal)}</p>
          <SponsorPicker sponsor={mine} />
        </Card>
      )}

      <Card bodyClassName="p-0">
        <div className="px-4 py-2 border-b border-slate-800 text-[11px] uppercase tracking-wider text-slate-500">League sponsorships</div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="text-left text-[11px] uppercase tracking-wider text-slate-500 border-b border-slate-800">
              <th className="px-4 py-2 w-8">#</th><th className="px-3 py-2">Club</th><th className="px-2 py-2 text-right">AAV</th><th className="px-2 py-2 text-right">Term</th><th className="px-3 py-2 hidden sm:table-cell">Status</th>
            </tr></thead>
            <tbody>
              {board.map((r, i) => {
                const d = r.deal;
                return (
                  <tr key={r.teamId} className="border-b border-slate-800/50 hover:bg-slate-800/30">
                    <td className="px-4 py-2 tabular-nums text-slate-500">{i + 1}</td>
                    <td className="px-3 py-2 font-semibold">{r.name}</td>
                    <td className="px-2 py-2 text-right tabular-nums">{d ? M(d.aav) : "—"}</td>
                    <td className="px-2 py-2 text-right tabular-nums">{d ? `${d.years}y` : "—"}</td>
                    <td className="px-3 py-2 text-[12px] hidden sm:table-cell">{d ? <span className="text-emerald-400">Signed</span> : <span className="text-slate-500">Open</span>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function sponsor(deal: { aav: number; years: number } | null): string {
  return deal ? `Current: $${(deal.aav / 1e6).toFixed(1)}M × ${deal.years}yr.` : "No sponsor signed yet.";
}
