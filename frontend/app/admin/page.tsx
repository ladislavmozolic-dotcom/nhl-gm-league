import Link from "next/link";
import { PageHeader } from "@/components/ui";

export default function AdminPage() {
  const cards = [
    { href: "/admin/dashboard", title: "⭐ Commissioner Dashboard", desc: "Today at a glance — games ready, missing lines, illegal lineups, pending trades — and one-click Simulate Day." },
    { href: "/admin/season", title: "Season Control", desc: "Generate the schedule, play the season, run the playoffs." },
    { href: "/admin/announcements", title: "Commissioner Announcements", desc: "Post a league-wide message — reaches every GM's inbox and the home page." },
    { href: "/admin/awards", title: "Award Voting", desc: "Open/close the GM award ballot, watch the running tally, resolve winners." },
    { href: "/draft/lottery", title: "Draft Lottery", desc: "Draw the NHL-style lottery (16 non-playoff clubs, 2 weighted picks) to set round 1." },
    { href: "/admin/simulation", title: "Simulation Engine", desc: "Tune goals, shots, penalties, fights, goalie fatigue, playoff format, points." },
    { href: "/admin/sim-guide", title: "How the Sim Works", desc: "How chemistry forms and how every rating works together — a reference guide." },
    { href: "/admin/calibration", title: "Calibration Lab", desc: "Grade the engine against NHL targets — rates, competitive balance, xG, EDGE, injuries." },
    { href: "/admin/finance", title: "Team Popularity", desc: "Set popularity — drives attendance and ticket revenue." },
    { href: "/admin/contracts", title: "Contracts", desc: "Edit player cap hits and contract terms." },
    { href: "/admin/positions", title: "Player Positions", desc: "Search a player and add/remove positions and shooting side." },
    { href: "/admin/ratings", title: "Player Ratings", desc: "Search a player and tune his ratings (OV, SC, PA…) — the sim reflects them directly." },
    { href: "/admin/conditions", title: "Trade Conditions", desc: "Track conditional trade terms; trigger settlement once conditions are met." },
    { href: "/admin/lines", title: "Line Submissions", desc: "See when each GM last submitted lines before the 20:30 simulation." },
    { href: "/admin/team-lines", title: "Team Lines & Tactics", desc: "Open any club's line editor — set players, PHY/DF/OF tactics and ice-time for every team." },
    { href: "/admin/rosters", title: "Roster Source", desc: "Start the season with ProfiNHL rosters or the real NHL rosters." },
    { href: "/admin/real-drafts", title: "Real Draft Import", desc: "Load real NHL drafts (2019+) into real-roster Draft History." },
  ];
  return (
    <div className="space-y-6 py-2">
      <PageHeader title="Admin Panel" subtitle="League operations — schedule, simulation, finance and roster tools." />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {cards.map((c) => (
          <Link key={c.href} href={c.href}
            className="block bg-slate-900/70 border border-slate-800 rounded-2xl shadow-lg shadow-black/20 p-5 hover:border-slate-600 transition-colors">
            <div className="font-bold mb-1">{c.title}</div>
            <div className="text-sm text-slate-400">{c.desc}</div>
          </Link>
        ))}
      </div>
    </div>
  );
}
