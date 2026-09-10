import Link from "next/link";
import { prisma } from "@/lib/prisma";

// Fallback for the top-of-page ScoreTracker row on days with nothing to score
// (pre-season, the off-season) — a scrolling feed of recent league moves
// instead of a blank strip: waiver activity, trade-block adds, signings, trades.
const TYPE_ICON: Record<string, string> = { WAIVER: "📋", TRADE_BLOCK: "🔁", SIGNING: "✍️", TRADE: "🔄" };
const TYPE_HREF: Record<string, string> = { WAIVER: "/waivers", TRADE_BLOCK: "/trade-block", SIGNING: "/signings", TRADE: "/transactions" };

export default async function NewsTicker() {
  const items = await prisma.transaction.findMany({
    where: {
      type: { in: ["WAIVER", "TRADE_BLOCK", "SIGNING", "TRADE"] },
      NOT: { OR: [
        { message: { contains: "proposed a trade" } },
        { message: { contains: "Awaiting response" } },
        { message: { contains: "was declined" } },
        { message: { contains: "was cancelled" } },
      ] },
    },
    orderBy: { createdAt: "desc" },
    take: 20,
    select: { id: true, type: true, message: true },
  });
  if (items.length === 0) return null;

  const dur = Math.max(20, items.length * 4);

  return (
    <div className="bg-[#0a1628] border-b border-slate-800 overflow-hidden">
      <style>{`@keyframes ntMarquee{from{transform:translateX(0)}to{transform:translateX(-50%)}}@keyframes ntBlink{0%,60%{opacity:1}80%,100%{opacity:.25}}`}</style>
      <div className="max-w-[1400px] mx-auto flex items-stretch">
        <div className="shrink-0 bg-blue-600 text-white text-[11px] font-bold px-3 flex items-center gap-1.5 uppercase tracking-wide">
          <span className="w-1.5 h-1.5 rounded-full bg-red-400" style={{ animation: "ntBlink 1.1s infinite" }} />
          News
        </div>
        <div className="overflow-hidden relative flex-1 h-9 flex items-center">
          <div className="flex w-max whitespace-nowrap" style={{ animation: `ntMarquee ${dur}s linear infinite` }}>
            {[0, 1].map((seg) => (
              <div key={seg} className="flex">
                {items.map((tx, i) => (
                  <Link
                    key={`${seg}-${tx.id}-${i}`}
                    href={TYPE_HREF[tx.type] ?? "/transactions"}
                    className="inline-flex items-center gap-2 px-5 border-r border-slate-800/70 text-sm text-slate-300 hover:text-white transition-colors"
                  >
                    <span>{TYPE_ICON[tx.type] ?? "•"}</span>
                    <span>{tx.message}</span>
                  </Link>
                ))}
                <span className="inline-flex items-center px-6 text-blue-400 font-black text-lg tracking-[0.35em] select-none">////</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
