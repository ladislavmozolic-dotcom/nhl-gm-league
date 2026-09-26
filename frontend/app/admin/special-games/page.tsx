import Link from "next/link";
import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/auth";
import { PageHeader, Card, BackPill } from "@/components/ui";
import { specialGames, type EventKind } from "@/lib/special-games";
import EventBadge from "@/components/EventBadge";
import { ApplyRealButton, SpecialGameForm } from "@/components/admin/SpecialGamesAdmin";

export const dynamic = "force-dynamic";

export default async function AdminSpecialGamesPage() {
  if (!(await isAdmin())) redirect("/login");
  const games = await specialGames();
  return (
    <div className="space-y-6 py-2">
      <PageHeader title="🏟️ Special games" subtitle="Outdoor games and the Global Series — real NHL calendar" right={<BackPill href="/admin">Admin</BackPill>} />
      <Card title="Real NHL events" accent="text-amber-400">
        <p className="text-sm text-slate-400 mb-3">Tags the 2026-27 Heritage Classic, Winter Classic, Stadium Series and the Global Series (Helsinki, Düsseldorf) onto the matching games of our schedule. The game is simulated as usual; the crowd is the venue&apos;s and both clubs earn event income (Admin ▸ Simulation settings ▸ Special games).</p>
        <ApplyRealButton />
      </Card>
      <Card title={`Tagged games (${games.length})`} accent="text-blue-400">
        {games.length === 0 ? <p className="text-sm text-slate-500">None yet.</p> : (
          <div className="space-y-4">
            {games.map((g) => (
              <div key={g.id} className="border-b border-slate-800/70 pb-3">
                <div className="text-sm mb-2">
                  <EventBadge kind={g.eventKind} title={g.eventTitle} venue={g.eventVenue} size={32} className="mr-2 align-middle" />
                  <b>{g.eventTitle}</b> · <Link href={`/games/${g.id}`} className="text-blue-400 hover:underline">{g.awayTeam.code} @ {g.homeTeam.code}</Link>
                  <span className="text-slate-500"> · {g.gameDate?.toISOString().slice(0, 10)} · #{g.id}{g.status === "FINAL" ? ` · ${g.awayGoals}–${g.homeGoals} · ${g.attendance?.toLocaleString()} fans` : ""}</span>
                </div>
                <SpecialGameForm initial={{ gameId: g.id, kind: g.eventKind as EventKind, title: g.eventTitle ?? "", venue: g.eventVenue ?? "", capacity: g.eventCapacity }} />
              </div>
            ))}
          </div>
        )}
      </Card>
      <Card title="Tag another game" accent="text-slate-400"><SpecialGameForm /></Card>
    </div>
  );
}
