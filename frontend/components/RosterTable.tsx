import Link from "next/link";
import { cleanName, captaincyFromName } from "@/lib/playerName";

export type RosterPlayer = Record<string, number | string | null> & {
  id: number; name: string; position: string | null; slug?: string | null; age: number | null; overall: number | null; contractText: string | null; condition: number | null;
};

const SKATER_ATTRS = ["ck", "fg", "di", "sk", "st", "en", "du", "ph", "fo", "pa", "sc", "df", "ps", "ex", "ld", "mo"];
const GOALIE_ATTRS = ["sk", "du", "en", "sz", "ag", "rb", "sc", "hs", "rt", "ph", "ps", "ex", "ld", "mo"];

export default function RosterTable({ title, players, goalie = false }: { title: string; players: RosterPlayer[]; goalie?: boolean }) {
  const attrs = goalie ? GOALIE_ATTRS : SKATER_ATTRS;
  const head = [goalie ? "Goalie" : "Player", "Pos", "CON", ...attrs.map((a) => a.toUpperCase()), "OV", "Age", "Contract"];
  return (
    <div className="mb-6">
      <div className="bg-slate-800/60 border border-slate-700 rounded-t-lg px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-slate-300">{title}</div>
      <div className="bg-slate-900/40 border-x border-b border-slate-800 rounded-b-lg overflow-x-auto">
        <table className="w-full text-xs" style={{ minWidth: 980 }}>
          <thead>
            <tr className="text-[10px] text-slate-500 border-b border-slate-800 bg-slate-800/30">
              {head.map((h, i) => (
                <th key={i} className={`px-2 py-1.5 whitespace-nowrap ${i === 0 ? "text-left sticky left-0 bg-slate-800/40 min-w-[150px]" : i === head.length - 1 ? "text-right" : "text-center"}`}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {players.length === 0 && <tr><td colSpan={head.length} className="px-3 py-3 text-slate-600">no players</td></tr>}
            {players.map((p) => {
              const cap = captaincyFromName(p.name);
              return (
                <tr key={p.id} className="border-b border-slate-800/60 hover:bg-slate-800/30">
                  <td className="px-2 py-1.5 text-left sticky left-0 bg-slate-900/60 backdrop-blur whitespace-nowrap">
                    {p.slug ? <Link href={`/players/${p.slug}`} className="hover:text-blue-400 font-medium">{cleanName(p.name)}</Link> : <span className="font-medium">{cleanName(p.name)}</span>}
                    {cap && <span className={`ml-1 text-[9px] font-bold ${cap === "C" ? "text-amber-400" : "text-slate-400"}`}>({cap})</span>}
                  </td>
                  <td className="px-2 py-1.5 text-center text-slate-400">{p.position ?? "—"}</td>
                  <td className="px-2 py-1.5 text-center text-slate-400 tabular-nums">{p.condition != null ? Number(p.condition).toFixed(0) : "—"}</td>
                  {attrs.map((a) => <td key={a} className="px-2 py-1.5 text-center tabular-nums text-slate-300">{(p[a] as number | null) ?? "—"}</td>)}
                  <td className={`px-2 py-1.5 text-center tabular-nums font-bold ${(p.overall ?? 0) >= 80 ? "text-green-400" : (p.overall ?? 0) >= 70 ? "text-blue-400" : (p.overall ?? 0) >= 60 ? "text-yellow-400" : "text-slate-300"}`}>{p.overall ?? "—"}</td>
                  <td className="px-2 py-1.5 text-center text-slate-400 tabular-nums">{p.age ?? "—"}</td>
                  <td className="px-2 py-1.5 text-right text-slate-400 whitespace-nowrap">{p.contractText ?? "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
