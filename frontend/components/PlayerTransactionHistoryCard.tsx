import { Card } from "@/components/ui";
import type { PlayerEventEntry } from "@/lib/trade-history-server";

const ICON: Record<PlayerEventEntry["kind"], string> = {
  TRADE_BLOCK: "🧱",
  WAIVER: "📝",
  SIGNING: "✍️",
};

export default function PlayerTransactionHistoryCard({ history }: { history: PlayerEventEntry[] }) {
  if (!history.length) {
    return (
      <Card title="Transaction History">
        <p className="text-sm text-slate-500">No trade-block, waiver, or signing activity yet.</p>
      </Card>
    );
  }
  return (
    <Card title="Transaction History">
      <div className="space-y-2">
        {history.map((e) => (
          <div key={e.id} className="flex items-start justify-between gap-3 rounded-lg border border-slate-800 bg-slate-950/40 px-3 py-2">
            <div className="flex items-start gap-2">
              <span className="text-sm shrink-0">{ICON[e.kind]}</span>
              <span className="text-sm text-slate-200">{e.message}</span>
            </div>
            <span className="text-xs text-slate-500 whitespace-nowrap shrink-0">{e.date.toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" })}</span>
          </div>
        ))}
      </div>
    </Card>
  );
}
