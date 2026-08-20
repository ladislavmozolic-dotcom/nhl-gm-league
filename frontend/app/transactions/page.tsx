import { prisma } from "@/lib/prisma";
import { PageHeader, Card } from "@/components/ui";

export const dynamic = "force-dynamic";

// The league feed shows only COMPLETED moves — signings, executed trades, waiver
// claims, call-ups, buyouts. In-progress noise (proposed/awaiting trades, FA
// negotiation, trade requests, cap/promise warnings) is kept out.
export const TX_NOISE = ["FA_NEGOTIATION", "TRADE_REQUEST", "PROMISE_WARNING", "CAP_WARNING", "TRADE_BLOCK"];
export const TX_WHERE = { type: { notIn: TX_NOISE }, NOT: { message: { contains: "proposed a trade" } } };

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
    const hits: { id: number; code: string | null; logoUrl: string | null }[] = [];
    for (const t of withLogo) {
      const byName = !!t.name && msg.includes(t.name);
      const byCode = !!t.codeRe && t.codeRe.test(msg);
      if (byName || byCode) hits.push(t);
    }
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
            const logos = logosFor(tx.message);
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
                  <p className="font-medium">{tx.message}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{tx.type}</p>
                </div>
                <p className="text-xs text-slate-500 flex-shrink-0">
                  {tx.createdAt.toLocaleDateString("sk-SK", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
