import { prisma } from "@/lib/prisma";
import { isAdmin } from "@/lib/auth";
import { redirect } from "next/navigation";
import { PageHeader, Card } from "@/components/ui";
import { approveJoinRequest, rejectJoinRequest } from "./actions";
import RemoveGmButton from "@/components/RemoveGmButton";

export const dynamic = "force-dynamic";

function fmt(d: Date) {
  return d.toISOString().slice(0, 16).replace("T", " ");
}

export default async function JoinRequestsPage() {
  if (!(await isAdmin())) redirect("/login");

  const [pending, decided, registered] = await Promise.all([
    prisma.joinRequest.findMany({
      where: { status: "pending" },
      include: { team: { select: { name: true, slug: true, logoUrl: true } } },
      orderBy: { createdAt: "asc" },
    }),
    prisma.joinRequest.findMany({
      where: { status: { not: "pending" } },
      include: { team: { select: { name: true } } },
      orderBy: { decidedAt: "desc" },
      take: 20,
    }),
    prisma.team.findMany({
      where: { league: "NHL", isAffiliate: false, passwordHash: { not: null } },
      select: { id: true, name: true, logoUrl: true, gm: true, gmNickname: true, gmFirstName: true, gmLastName: true, gmEmail: true, gmRole: true, lastLoginAt: true },
      orderBy: { name: "asc" },
    }),
  ]);
  const gmLabel = (t: (typeof registered)[number]) => t.gmNickname || [t.gmFirstName, t.gmLastName].filter(Boolean).join(" ").trim() || t.gm;

  return (
    <div className="space-y-6 py-2">
      <PageHeader title="Žiadosti o vstup" subtitle="GM registrácie čakajúce na schválenie. Schválením sa žiadateľ stane GM daného tímu." />

      <Card>
        <div className="text-sm font-semibold text-slate-200 mb-3">Čakajúce ({pending.length})</div>
        {pending.length === 0 ? (
          <p className="text-slate-500 text-sm py-4 text-center">Žiadne čakajúce žiadosti.</p>
        ) : (
          <div className="space-y-3">
            {pending.map((r) => (
              <div key={r.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-800 bg-slate-900/40 px-4 py-3">
                {r.team.logoUrl && <img src={r.team.logoUrl} alt="" className="w-9 h-9 object-contain" />}
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold text-slate-100">{r.team.name}</div>
                  <div className="text-xs text-slate-400">
                    <b className="text-slate-300">{r.nickname}</b> — {r.firstName} {r.lastName} · {r.email}
                  </div>
                  {r.note && <div className="text-xs text-slate-500 mt-0.5 italic">„{r.note}"</div>}
                  <div className="text-[10px] text-slate-600 mt-0.5">{fmt(r.createdAt)}</div>
                </div>
                <div className="flex items-center gap-2">
                  <form action={approveJoinRequest}>
                    <input type="hidden" name="id" value={r.id} />
                    <button className="px-3 py-1.5 rounded-lg bg-green-600 hover:bg-green-500 text-white text-xs font-semibold">Schváliť</button>
                  </form>
                  <form action={rejectJoinRequest}>
                    <input type="hidden" name="id" value={r.id} />
                    <button className="px-3 py-1.5 rounded-lg bg-slate-700 hover:bg-red-600 text-slate-200 text-xs font-semibold">Zamietnuť</button>
                  </form>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card>
        <div className="text-sm font-semibold text-slate-200 mb-1">Registrovaní GM ({registered.length})</div>
        <p className="text-xs text-slate-500 mb-3">Vymazaním sa tím vráti na 🤖 AI GM — okamžite viditeľné v Team / GM Directory — a bude znova voľný pre novú žiadosť.</p>
        {registered.length === 0 ? (
          <p className="text-slate-500 text-sm py-4 text-center">Žiadny tím zatiaľ nemá registrovaného GM.</p>
        ) : (
          <div className="space-y-2">
            {registered.map((t) => (
              <div key={t.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-800 bg-slate-900/40 px-4 py-2.5">
                {t.logoUrl && <img src={t.logoUrl} alt="" className="w-8 h-8 object-contain" />}
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold text-slate-100">{t.name}</div>
                  <div className="text-xs text-slate-400">
                    <b className="text-slate-300">{gmLabel(t)}</b>{t.gmEmail ? ` · ${t.gmEmail}` : ""}
                    {t.gmRole !== "gm" && <span className="ml-1.5 text-[10px] font-bold px-1.5 py-0.5 rounded border border-amber-600/50 text-amber-400 uppercase">{t.gmRole}</span>}
                  </div>
                  <div className="text-[10px] text-slate-600 mt-0.5">Last login: {t.lastLoginAt ? fmt(t.lastLoginAt) : "never"}</div>
                </div>
                <RemoveGmButton teamId={t.id} gmLabel={gmLabel(t)} teamName={t.name} />
              </div>
            ))}
          </div>
        )}
      </Card>

      {decided.length > 0 && (
        <Card>
          <div className="text-sm font-semibold text-slate-200 mb-3">Vybavené</div>
          <div className="space-y-1.5">
            {decided.map((r) => (
              <div key={r.id} className="flex items-center gap-2 text-xs text-slate-400">
                <span className={r.status === "approved" ? "text-green-400" : "text-red-400"}>
                  {r.status === "approved" ? "✅" : "✕"}
                </span>
                <b className="text-slate-300">{r.nickname}</b> → {r.team.name}
                <span className="text-slate-600 ml-auto">{r.decidedBy}{r.decidedAt ? ` · ${fmt(r.decidedAt)}` : ""}</span>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
