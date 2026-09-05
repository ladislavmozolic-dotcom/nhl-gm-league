import Link from "next/link";
import { Card } from "@/components/ui";
import type { TradeHistoryEntry, TradeHistoryAssetItem, TradeHistoryTeam } from "@/lib/trade-history-server";

function TeamChip({ team }: { team: TradeHistoryTeam | null }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-200">
      {team?.logoUrl && <img src={team.logoUrl} alt="" className="w-5 h-5 object-contain" />}
      {team?.name ?? "Unknown"}
    </span>
  );
}

function AssetList({ items, highlight }: { items: TradeHistoryAssetItem[]; highlight: string }) {
  if (!items.length) return <span className="text-slate-600 text-xs">nothing</span>;
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((it, i) => {
        const isMe = it.text === highlight || it.text.startsWith(`${highlight} (`);
        return (
          <span key={i} className={`text-xs px-2 py-1 rounded inline-flex items-center gap-1.5 ${isMe ? "bg-blue-500/20 text-blue-200 ring-1 ring-blue-500/40 font-semibold" : "bg-slate-800 text-slate-100"}`}>
            {it.logoUrl && <img src={it.logoUrl} alt="" className="w-3.5 h-3.5 object-contain shrink-0" />}
            {it.text}
          </span>
        );
      })}
    </div>
  );
}

export default function PlayerTradeHistoryCard({ playerName, history }: { playerName: string; history: TradeHistoryEntry[] }) {
  if (!history.length) {
    return (
      <Card title="Trade History">
        <p className="text-sm text-slate-500">Never traded.</p>
      </Card>
    );
  }
  return (
    <Card title="Trade History">
      <div className="space-y-4">
        {history.map((h) => (
          <div key={h.tradeId} className="rounded-lg border border-slate-800 bg-slate-950/40 p-3">
            <div className="flex items-center justify-between gap-2 flex-wrap mb-2">
              <div className="flex items-center gap-2">
                <TeamChip team={h.fromTeam} />
                <span className="text-slate-600">→</span>
                <TeamChip team={h.toTeam} />
              </div>
              <div className="flex items-center gap-2">
                {h.status === "REVERTED" && (
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-700 text-slate-400" title="This trade was later reversed by an admin.">Later reverted</span>
                )}
                <span className="text-xs text-slate-500">{h.date.toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" })}</span>
                <Link href={`/trades/${h.tradeId}`} className="text-xs text-blue-400 hover:text-blue-300">#{h.tradeId}</Link>
              </div>
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <p className="text-[10px] uppercase tracking-wide text-slate-600 mb-1">{h.toTeam?.name ?? "Team"} received</p>
                <AssetList items={h.fromLabels} highlight={playerName} />
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wide text-slate-600 mb-1">{h.fromTeam?.name ?? "Team"} received</p>
                <AssetList items={h.toLabels} highlight={playerName} />
              </div>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
