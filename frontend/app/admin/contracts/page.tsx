import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { PageHeader, Card } from "@/components/ui";
import { money, seasonLabel, CURRENT_SEASON_START } from "@/lib/finance";
import { isAdmin } from "@/lib/auth";
import type { Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";

const SORT_KEYS = ["name", "team", "age", "capHit", "years"] as const;
type SortKey = (typeof SORT_KEYS)[number];
const isSortKey = (v: string | undefined): v is SortKey => !!v && (SORT_KEYS as readonly string[]).includes(v);

// Each column's natural first-click direction — cap hit/years lead with the
// biggest/longest first (matches the page's old fixed default), everything
// else starts alphabetical/youngest-first.
const DEFAULT_DIR: Record<SortKey, "asc" | "desc"> = { name: "asc", team: "asc", age: "asc", capHit: "desc", years: "desc" };
const LABEL: Record<SortKey, string> = { name: "Player", team: "Team", age: "Age", capHit: "Cap Hit", years: "Years" };

function orderByFor(sort: SortKey, dir: "asc" | "desc"): Prisma.PlayerOrderByWithRelationInput[] {
  const tiebreak: Prisma.PlayerOrderByWithRelationInput = { name: "asc" };
  switch (sort) {
    case "name": return [{ name: dir }];
    case "team": return [{ team: { name: dir } }, tiebreak];
    case "age": return [{ age: dir }, tiebreak];
    case "capHit": return [{ capHit: dir }, tiebreak];
    case "years": return [{ contractYears: dir }, tiebreak];
  }
}

export default async function AdminContractsPage({ searchParams }: { searchParams: Promise<{ q?: string; sort?: string; dir?: string }> }) {
  const sp = await searchParams;
  const q = sp.q?.trim() ?? "";
  const sort: SortKey = isSortKey(sp.sort) ? sp.sort : "capHit";
  const dir: "asc" | "desc" = sp.dir === "asc" || sp.dir === "desc" ? sp.dir : DEFAULT_DIR[sort];

  const [players, admin] = await Promise.all([
    prisma.player.findMany({
      where: {
        // A farmed player's teamId points DIRECTLY at his AHL affiliate (not the NHL
        // parent with a flag) — league:"NHL" alone silently hid every player currently
        // assigned to the farm. Both leagues here are always someone's real NHL org.
        team: { league: { in: ["NHL", "AHL"] } },
        ...(q ? { name: { contains: q, mode: "insensitive" } } : {}),
      },
      select: { id: true, name: true, slug: true, position: true, age: true, capHit: true, contractYears: true, contractExpiry: true, team: { select: { name: true, code: true } } },
      orderBy: orderByFor(sort, dir),
      take: q ? 200 : 60,
    }),
    isAdmin(),
  ]);

  // preserves q, swaps sort/dir — clicking an already-active column flips direction,
  // clicking a new one starts at that column's own natural default direction.
  const sortHref = (col: SortKey) => {
    const nextDir = sort === col ? (dir === "asc" ? "desc" : "asc") : DEFAULT_DIR[col];
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    params.set("sort", col);
    params.set("dir", nextDir);
    return `/admin/contracts?${params.toString()}`;
  };
  const ALIGN = { left: "text-left", right: "text-right", center: "text-center" } as const;
  const SortHeader = ({ col, align = "left" }: { col: SortKey; align?: keyof typeof ALIGN }) => (
    <th className={`px-4 py-3 font-medium ${ALIGN[align]}`}>
      <Link href={sortHref(col)} className="inline-flex items-center gap-1 hover:text-slate-200">
        {LABEL[col]}
        {sort === col && <span className="text-blue-400">{dir === "asc" ? "▲" : "▼"}</span>}
      </Link>
    </th>
  );

  return (
    <div className="space-y-6 py-2">
      <PageHeader
        title="Contract Management"
        subtitle="Set a player's salary (cap hit) and contract length. Manual override until Agent signing writes it automatically."
        right={<div className="flex items-center gap-4">
          <Link href="/admin/contracts/new" className="text-sm text-emerald-400 hover:text-emerald-300 font-semibold">+ Add Player</Link>
          <Link href="/admin" className="text-sm text-slate-400 hover:text-blue-400">← Admin</Link>
        </div>}
      />

      {!admin && (
        <div className="text-sm text-amber-300 bg-amber-950/30 border border-amber-800/50 rounded-lg px-4 py-2.5">
          Sign in as an <b>admin</b> GM to save changes — the editor opens but Save is blocked otherwise.
        </div>
      )}

      <form className="flex gap-2" action="/admin/contracts">
        <input name="q" defaultValue={q} placeholder="Search player by name…"
          className="flex-1 max-w-sm bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm" />
        <button className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-sm font-semibold">Search</button>
      </form>

      <Card bodyClassName="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-800 text-slate-500 text-xs uppercase tracking-wider bg-slate-800/30">
                <SortHeader col="name" />
                <SortHeader col="team" />
                <SortHeader col="age" align="center" />
                <SortHeader col="capHit" align="right" />
                <SortHeader col="years" align="center" />
                <th className="px-4 py-3 text-center font-medium">Expiry</th>
                <th className="px-4 py-3 text-right font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {players.map((player) => (
                <tr key={player.id} className="border-b border-slate-800/40 hover:bg-slate-800/30 transition-colors last:border-0">
                  <td className="px-4 py-3 font-medium">{player.name} <span className="text-slate-600 text-xs">{player.position}</span></td>
                  <td className="px-3 py-3 text-slate-400">{player.team.code || player.team.name}</td>
                  <td className="px-4 py-3 text-center text-slate-400">{player.age ?? "—"}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{player.capHit ? money(player.capHit) : "—"}</td>
                  <td className="px-4 py-3 text-center text-slate-400">{player.contractYears ?? "—"}</td>
                  {/* Expiry = last season under contract, derived from years remaining (the
                      stored contractExpiry is stale for imported deals). */}
                  <td className="px-4 py-3 text-center text-slate-400">{player.contractYears && player.contractYears > 0 ? seasonLabel(CURRENT_SEASON_START + player.contractYears - 1) : "—"}</td>
                  <td className="px-4 py-3 text-right">
                    <Link href={`/admin/contracts/${player.slug}`} className="text-blue-400 hover:text-blue-300">Edit</Link>
                  </td>
                </tr>
              ))}
              {players.length === 0 && <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-500">No players match “{q}”.</td></tr>}
            </tbody>
          </table>
        </div>
      </Card>
      {!q && <p className="text-xs text-slate-500 px-1">Showing the 60 biggest cap hits — search to find any player, click a column header to sort.</p>}
    </div>
  );
}
