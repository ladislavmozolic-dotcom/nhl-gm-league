import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader, Card, BackPill } from "@/components/ui";
import { getBank, bankBalance } from "@/lib/league-bank-server";
import { CURRENT_SEASON_START, money, seasonLabel } from "@/lib/finance";
import { payPicksWeek, payPicksSeason, saveBankSettings, bankTransfer, runEnforcementNow, adjustCapPenalty } from "./actions";

export const dynamic = "force-dynamic";

const inp = "bg-slate-800 border border-slate-700 rounded px-2 py-1 text-sm";
const btn = "bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold rounded px-3 py-1.5";
const KIND_LABEL: Record<string, string> = {
  FINE_NHL_ROSTER: "NHL roster fine", FINE_AHL_ROSTER: "AHL roster fine", FINE_CAP: "Over-cap fine", FINE_FLOOR: "Under-floor fine", FINE_PLAYER: "Fine",
  SUSPENSION_SALARY: "Suspension salary", BONUS: "Bonus", PAYOUT: "Payout", INCOME: "Income", ADJUSTMENT: "Adjustment", REFUND: "Refund",
};

export default async function LeagueBankPage() {
  if (!(await isAdmin())) redirect("/login");
  const [bank, balance, entries, teams, penalties, overage, underage] = await Promise.all([
    getBank(), bankBalance(),
    prisma.leagueBankEntry.findMany({ orderBy: { createdAt: "desc" }, take: 100 }),
    prisma.team.findMany({ where: { league: "NHL", isAffiliate: false }, select: { id: true, code: true, name: true }, orderBy: { name: "asc" } }),
    prisma.teamCapPenalty.findMany({ where: { sourceSeasonStart: CURRENT_SEASON_START } }),
    prisma.capOverageDay.groupBy({ by: ["teamId"], where: { seasonStart: CURRENT_SEASON_START, overBy: { gt: 0 } }, _count: { _all: true }, _sum: { overBy: true }, _max: { overBy: true } }),
    prisma.capOverageDay.groupBy({ by: ["teamId"], where: { seasonStart: CURRENT_SEASON_START, underFloorBy: { gt: 0 } }, _count: { _all: true }, _sum: { underFloorBy: true }, _max: { underFloorBy: true } }),
  ]);
  const penBy = new Map(penalties.map((p) => [p.teamId, p]));
  const ovBy = new Map(overage.map((o) => [o.teamId, o]));
  const unBy = new Map(underage.map((u) => [u.teamId, u]));
  const ceilingRows = teams.filter((t) => (penBy.get(t.id)?.basis ?? 0) > 0 || ovBy.has(t.id) || (penBy.get(t.id)?.manualAdj ?? 0) !== 0);
  const floorRows = teams.filter((t) => (penBy.get(t.id)?.floorBasis ?? 0) > 0 || unBy.has(t.id) || (penBy.get(t.id)?.floorManualAdj ?? 0) !== 0);
  const totalIn = entries.filter((e) => e.amount > 0).reduce((s, e) => s + e.amount, 0);

  return (
    <div className="space-y-6 py-2">
      <PageHeader title="🏦 League Bank" subtitle={`Opening ${money(bank.openingBalance)} · fines, forfeited suspension salary, bonuses & payouts`} right={<BackPill href="/admin">Admin</BackPill>} />
      <Card title="Balance" accent="text-emerald-400">
        <div className={`text-3xl font-bold tabular-nums ${balance < 0 ? "text-red-400" : "text-emerald-400"}`}>{money(balance)}</div>
        <p className="text-xs text-slate-500 mt-1">Last 100 entries brought in {money(totalIn)}. Last automatic check: {bank.lastEnforcedDay ?? "never"}.</p>
      </Card>

      <Card title="Rules & automatic fines" accent="text-amber-400">
        <form action={saveBankSettings} className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-2 text-sm">
          <label className="flex items-center gap-2"><input type="checkbox" name="enforcementEnabled" defaultChecked={bank.enforcementEnabled} /> Automatic daily fines ON</label>
          <label className="flex items-center gap-2">Fines start on (YYYY-MM-DD) <input name="enforcementStart" defaultValue={bank.enforcementStart ?? ""} placeholder="2026-10-05" className={`${inp} w-32`} /></label>
          <label className="flex items-center justify-between gap-2">NHL roster fine / day <input name="nhlRosterFine" defaultValue={bank.nhlRosterFine} className={`${inp} w-32`} /></label>
          <label className="flex items-center justify-between gap-2">AHL roster fine / day <input name="ahlRosterFine" defaultValue={bank.ahlRosterFine} className={`${inp} w-32`} /></label>
          <label className="flex items-center justify-between gap-2">Over-cap fine / day <input name="capFinePerDay" defaultValue={bank.capFinePerDay} className={`${inp} w-32`} /></label>
          <label className="flex items-center justify-between gap-2">Under-floor fine / day <input name="floorFinePerDay" defaultValue={bank.floorFinePerDay ?? bank.capFinePerDay} className={`${inp} w-32`} /></label>
          <label className="flex items-center justify-between gap-2">Next-season cap reduction × <input name="capPenaltyMultiplier" defaultValue={bank.capPenaltyMultiplier} className={`${inp} w-32`} /></label>
          <label className="flex items-center justify-between gap-2">Next-season floor increase × <input name="floorPenaltyMultiplier" defaultValue={bank.floorPenaltyMultiplier ?? bank.capPenaltyMultiplier} className={`${inp} w-32`} /></label>
          <label className="flex items-center justify-between gap-2">Max cap reduction per club / season <input name="capPenaltyMax" defaultValue={bank.capPenaltyMax} className={`${inp} w-32`} /></label>
          <label className="flex items-center justify-between gap-2">Max floor increase per club / season <input name="floorPenaltyMax" defaultValue={bank.floorPenaltyMax ?? bank.capPenaltyMax} className={`${inp} w-32`} /></label>
          <label className="flex items-center justify-between gap-2">Overage accumulates as
            <select name="capAccumulate" defaultValue={bank.capAccumulate} className={inp}><option value="sum">sum of every day over</option><option value="peak">worst single day only</option></select></label>
          <label className="flex items-center justify-between gap-2">Underage accumulates as
            <select name="floorAccumulate" defaultValue={bank.floorAccumulate ?? bank.capAccumulate} className={inp}><option value="sum">sum of every day under</option><option value="peak">worst single day only</option></select></label>
          <label className="flex items-center gap-2"><input type="checkbox" name="finesForAiClubs" defaultChecked={bank.finesForAiClubs} /> Also fine AI-run clubs (no human GM)</label>
          <label className="flex items-center justify-between gap-2">Picks: weekly winner prize <input name="picksWeeklyPrize" defaultValue={bank.picksWeeklyPrize} className={`${inp} w-32`} /></label>
          <label className="flex items-center gap-2"><input type="checkbox" name="autoPickPayouts" defaultChecked={bank.autoPickPayouts} /> Pay weekly winners automatically</label>
          <label className="flex items-center justify-between gap-2">Picks: season 1st / 2nd / 3rd
            <span className="flex gap-1"><input name="picksPrize1" defaultValue={bank.picksPrize1} className={`${inp} w-24`} /><input name="picksPrize2" defaultValue={bank.picksPrize2} className={`${inp} w-24`} /><input name="picksPrize3" defaultValue={bank.picksPrize3} className={`${inp} w-24`} /></span></label>
          <label className="flex items-center gap-2 md:col-span-2"><input type="checkbox" name="suspensionToBank" defaultChecked={bank.suspensionToBank} /> Forfeited suspension salary &amp; player fines go to the league bank</label>
          <div className="md:col-span-2"><button className={btn}>Save</button></div>
        </form>
        <form action={runEnforcementNow} className="mt-3"><button className="text-xs text-slate-400 hover:text-white underline">Run today&apos;s check now (ignores on/off &amp; start date; safe to repeat — one fine per club per day)</button></form>
        <p className="text-[11px] text-slate-500 mt-2">The check runs by itself once a day at 20:30 Europe/Bratislava (the evening sim time — clubs must be legal by then), only during the regular season (off-season and playoffs the cap may be exceeded by 10%). NHL roster = over 23 players or dressed ≠ 12F/6D/2G; AHL roster = dressed ≠ 12F/6D/2G or organisation over 55. Each club sees its own fines on its Finance page.</p>
      </Card>

      <Card title="Bonus · payout · manual fine" accent="text-blue-400">
        <form action={bankTransfer} className="flex flex-wrap gap-2 items-end text-sm">
          <select name="kind" className={inp}>
            <option value="PAYOUT">Payout to club (e.g. pick-em)</option><option value="BONUS">Bonus to club</option>
            <option value="FINE_MANUAL">Fine a club</option><option value="INCOME">Income (no club)</option><option value="ADJUSTMENT">Adjustment (no club)</option>
          </select>
          <select name="teamId" className={inp}><option value="">— club —</option>{teams.map((t) => <option key={t.id} value={t.id}>{t.code ?? t.name}</option>)}</select>
          <select name="sign" className={inp}><option value="in">+ into bank</option><option value="out">− out of bank</option></select>
          <input name="amount" placeholder="Amount $" className={`${inp} w-32`} />
          <input name="note" placeholder="Note" className={`${inp} w-64`} />
          <button className={btn}>Book it</button>
        </form>
        <p className="text-[11px] text-slate-500 mt-2">Payout / bonus: league bank → club&apos;s bank. Fine: club → league bank. The +/− selector only applies to Income / Adjustment.</p>
      </Card>

      <Card title="🎯 Tipovačka payouts" accent="text-violet-400">
        <p className="text-xs text-slate-500 mb-2">Weekly winners are paid automatically (week = Mon–Sun by game day; last paid: {bank.lastPickWeekPaid ?? "none"}). Repeating is safe — one payout per club per week.</p>
        <form action={payPicksWeek} className="flex gap-2 items-center text-sm mb-3"><input name="week" placeholder="Monday YYYY-MM-DD" className={`${inp} w-44`} /><button className={btn}>Pay that week&apos;s winner now</button></form>
        <form action={payPicksSeason} className="flex flex-wrap gap-2 items-center text-sm">
          <span className="text-xs text-slate-500">Season TOP 3 ({money(bank.picksPrize1)} / {money(bank.picksPrize2)} / {money(bank.picksPrize3)}):</span>
          {["p1", "p2", "p3"].map((n, i) => <select key={n} name={n} className={inp}><option value="">{i + 1}. place</option>{teams.map((t) => <option key={t.id} value={t.id}>{t.code ?? t.name}</option>)}</select>)}
          <button className={btn}>Pay season prizes</button>
        </form>
      </Card>

      <Card title={`Cap-overage accumulator (Over Cap) — ${seasonLabel(CURRENT_SEASON_START)} → cap reduction ${seasonLabel(CURRENT_SEASON_START + 1)}`} accent="text-red-400">
        {ceilingRows.length ? (
          <table className="w-full text-sm"><thead><tr className="text-xs text-slate-500 text-left"><th className="py-1">Club</th><th>Days over</th><th>Accumulated</th><th>Worst day</th><th>Cap reduction next season</th><th>Adjust</th></tr></thead>
            <tbody>{ceilingRows.map((t) => { const p = penBy.get(t.id); const o = ovBy.get(t.id); const amt = p && !p.waived ? Math.min(bank.capPenaltyMax, Math.max(0, Math.round(p.basis * bank.capPenaltyMultiplier) + p.manualAdj)) : 0;
              return (<tr key={t.id} className="border-t border-slate-800/70">
                <td className="py-1.5 font-semibold">{t.code ?? t.name}</td><td>{o?._count._all ?? 0}</td><td className="tabular-nums">{money(p?.basis ?? 0)}</td><td className="tabular-nums">{money(o?._max.overBy ?? 0)}</td>
                <td className={`tabular-nums font-semibold ${p?.waived ? "text-slate-500 line-through" : "text-red-400"}`}>−{money(amt)}{p?.waived ? " (waived)" : ""}</td>
                <td><form action={adjustCapPenalty} className="flex gap-1 items-center"><input type="hidden" name="teamId" value={t.id} /><input type="hidden" name="kind" value="ceiling" /><input name="manualAdj" defaultValue={p?.manualAdj ?? 0} className={`${inp} w-24`} title="± manual adjustment ($)" /><label className="text-xs flex items-center gap-1"><input type="checkbox" name="waived" defaultChecked={p?.waived} />waive</label><button className="text-xs text-blue-400 hover:underline">save</button></form></td>
              </tr>); })}</tbody></table>
        ) : <p className="text-sm text-slate-500">No club has been over the cap this season.</p>}
        <form action={adjustCapPenalty} className="flex gap-2 items-center mt-3 text-sm">
          <input type="hidden" name="kind" value="ceiling" />
          <span className="text-xs text-slate-500">Manual ceiling penalty for a club:</span>
          <select name="teamId" className={inp}><option value="">— club —</option>{teams.map((t) => <option key={t.id} value={t.id}>{t.code ?? t.name}</option>)}</select>
          <input name="manualAdj" placeholder="± $" className={`${inp} w-28`} /><button className={btn}>Set</button>
        </form>
      </Card>

      <Card title={`Cap-floor accumulator (Under Floor) — ${seasonLabel(CURRENT_SEASON_START)} → floor increase ${seasonLabel(CURRENT_SEASON_START + 1)}`} accent="text-amber-400">
        {floorRows.length ? (
          <table className="w-full text-sm"><thead><tr className="text-xs text-slate-500 text-left"><th className="py-1">Club</th><th>Days under</th><th>Accumulated</th><th>Worst day</th><th>Floor increase next season</th><th>Adjust</th></tr></thead>
            <tbody>{floorRows.map((t) => { const p = penBy.get(t.id); const u = unBy.get(t.id); const mult = bank.floorPenaltyMultiplier ?? bank.capPenaltyMultiplier; const max = bank.floorPenaltyMax ?? bank.capPenaltyMax; const amt = p && !p.floorWaived ? Math.min(max, Math.max(0, Math.round((p.floorBasis ?? 0) * mult) + (p.floorManualAdj ?? 0))) : 0;
              return (<tr key={t.id} className="border-t border-slate-800/70">
                <td className="py-1.5 font-semibold">{t.code ?? t.name}</td><td>{u?._count._all ?? 0}</td><td className="tabular-nums">{money(p?.floorBasis ?? 0)}</td><td className="tabular-nums">{money(u?._max.underFloorBy ?? 0)}</td>
                <td className={`tabular-nums font-semibold ${p?.floorWaived ? "text-slate-500 line-through" : "text-amber-400"}`}>+{money(amt)}{p?.floorWaived ? " (waived)" : ""}</td>
                <td><form action={adjustCapPenalty} className="flex gap-1 items-center"><input type="hidden" name="teamId" value={t.id} /><input type="hidden" name="kind" value="floor" /><input name="manualAdj" defaultValue={p?.floorManualAdj ?? 0} className={`${inp} w-24`} title="± manual adjustment ($)" /><label className="text-xs flex items-center gap-1"><input type="checkbox" name="waived" defaultChecked={p?.floorWaived} />waive</label><button className="text-xs text-blue-400 hover:underline">save</button></form></td>
              </tr>); })}</tbody></table>
        ) : <p className="text-sm text-slate-500">No club has been under the floor this season.</p>}
        <form action={adjustCapPenalty} className="flex gap-2 items-center mt-3 text-sm">
          <input type="hidden" name="kind" value="floor" />
          <span className="text-xs text-slate-500">Manual floor penalty for a club:</span>
          <select name="teamId" className={inp}><option value="">— club —</option>{teams.map((t) => <option key={t.id} value={t.id}>{t.code ?? t.name}</option>)}</select>
          <input name="manualAdj" placeholder="± $" className={`${inp} w-28`} /><button className={btn}>Set</button>
        </form>
      </Card>

      <Card title="Ledger (latest 100)" accent="text-slate-300">
        <table className="w-full text-xs"><tbody>{entries.map((e) => (
          <tr key={e.id} className="border-t border-slate-800/70">
            <td className="py-1 text-slate-500 whitespace-nowrap">{e.createdAt.toISOString().slice(0, 16).replace("T", " ")}</td>
            <td className="whitespace-nowrap">{KIND_LABEL[e.kind] ?? e.kind}</td><td className="whitespace-nowrap">{e.teamName ?? ""}</td>
            <td className="text-slate-400">{e.note}</td>
            <td className={`text-right tabular-nums whitespace-nowrap ${e.amount >= 0 ? "text-emerald-400" : "text-red-400"}`}>{e.amount >= 0 ? "+" : "−"}{money(Math.abs(e.amount))}</td>
          </tr>))}</tbody></table>
        {!entries.length && <p className="text-sm text-slate-500">No movements yet.</p>}
      </Card>
    </div>
  );
}
