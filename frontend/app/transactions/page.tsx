import { prisma } from "@/lib/prisma";
import { PageHeader, Card } from "@/components/ui";
import LocalDateTime from "@/components/LocalDateTime";

export const dynamic = "force-dynamic";

// The league feed shows only COMPLETED moves — signings, executed trades, waiver
// claims, call-ups, buyouts. In-progress noise (proposed/awaiting trades, FA
// negotiation, trade requests, cap/promise warnings) is kept out.
export const TX_NOISE = ["FA_NEGOTIATION", "TRADE_REQUEST", "PROMISE_WARNING", "CAP_WARNING", "TRADE_BLOCK"];
export const TX_WHERE = {
  type: { notIn: TX_NOISE },
  // drop in-progress / negative trade chatter — proposals, awaiting, declines & cancels
  // live only in the involved clubs' Trade Tracker, with full detail.
  NOT: { OR: [
    { message: { contains: "proposed a trade" } },
    { message: { contains: "Awaiting response" } },
    { message: { contains: "was declined" } },
    { message: { contains: "was cancelled" } },
  ] },
};

export function cleanTxMessage(msg: string): string {
  return msg
    .replace(/\bfor assets\./gi, "for future considerations.")
    .replace(/\btraded assets to\b/gi, "traded future considerations to");
}

export default async function TransactionsPage() {
  const [transactions, teams] = await Promise.all([
    prisma.transaction.findMany({ where: TX_WHERE, take: 50, orderBy: { createdAt: "desc" } }),
    prisma.team.findMany({ select: { id: true, name: true, code: true, logoUrl: true } }),
  ]);

  // messages embed team names / codes as free text — match them so we can show logos.
  // codes can contain regex metachars (e.g. "T.B", "N.J"), so escape before matching.
  const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const PSEUDO = new Set(["UFA", "RFA", "FA"]); // free-agent pools, not real clubs
  const withLogo = teams
    .filter((t) => t.logoUrl && !(t.code && PSEUDO.has(t.code)))
    .map((t) => ({ ...t, codeRe: t.code ? new RegExp(`\\b${esc(t.code)}\\b`) : null }));
  const logosFor = (msg: string) => {
    // Strip parenthetical asides before scanning — a trade message can carry a
    // draft pick's ORIGINAL-team annotation ("1st round pick 2028 (NYR)"), which
    // names a club with no actual part in the deal. Left in, it could be picked
    // up as one of the trade's own teams. Rank by where each match first
    // appears in the text, not by team-table order, so the two (or three) clubs
    // actually named in the sentence win over an unrelated later/earlier mention.
    const scanMsg = msg.replace(/\([^)]*\)/g, " ");
    const hits = withLogo
      .map((t) => {
        const byCode = t.codeRe ? scanMsg.search(t.codeRe) : -1;
        const byName = scanMsg.indexOf(t.name);
        const idx = byCode >= 0 && (byName < 0 || byCode < byName) ? byCode : byName;
        return { t, idx };
      })
      .filter((m) => m.idx >= 0)
      .sort((a, b) => a.idx - b.idx)
      .map((m) => m.t);
    return hits.slice(0, 3);
  };

  return (
    <div className="space-y-6 py-2">
      <PageHeader title="Transactions" subtitle="Recent league activity and moves" />

      {transactions.length === 0 ? (
        <Card>
          <div className="p-8 text-center">
            <p className="text-slate-500 text-lg">No transactions yet</p>
            <p className="text-slate-600 text-sm mt-2">Transactions will appear here once the season starts</p>
          </div>
        </Card>
      ) : (
        <div className="space-y-3">
          {transactions.map((tx) => {
            const cleanMsg = cleanTxMessage(tx.message);
            const logos = logosFor(cleanMsg);
            return (
              <div
                key={tx.id}
                className="flex items-center gap-4 p-4 bg-slate-900/70 border border-slate-800 rounded-2xl shadow-lg shadow-black/20 hover:border-slate-600 transition-colors"
              >
                <div
                  className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${
                    tx.type === "TRADE"
                      ? "bg-green-500"
                      : tx.type === "SIGNING"
                      ? "bg-blue-500"
                      : tx.type === "WAIVER"
                      ? "bg-yellow-500"
                      : "bg-slate-500"
                  }`}
                />
                {logos.length > 0 && (
                  <div className="flex items-center -space-x-1.5 flex-shrink-0">
                    {logos.map((t) => (
                      <img key={t.id} src={t.logoUrl!} alt={t.code ?? ""} title={t.code ?? ""} className="w-8 h-8 object-contain rounded-full bg-slate-800/60 ring-1 ring-slate-700" />
                    ))}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-medium">{cleanMsg}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{tx.type}</p>
                </div>
                <p className="text-xs text-slate-500 flex-shrink-0">
                  <LocalDateTime value={tx.createdAt} />
                </p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
