"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { money } from "@/lib/finance";

export type LedgerEntry = {
  id: string;
  date: string;
  rawDate: string;
  kind: string;
  category: "FINE" | "REWARD" | "DISCIPLINE" | "REFUND" | "OTHER";
  amount: number; // League bank amount (+ into league bank, - out of league bank)
  teamId: number | null;
  teamName: string | null;
  teamCode: string | null;
  teamLogoUrl: string | null;
  teamSlug: string | null;
  note: string | null;
  playerName?: string | null;
  playerSlug?: string | null;
};

export type TeamFinancialSummary = {
  teamId: number;
  name: string;
  code: string | null;
  logoUrl: string | null;
  slug: string;
  totalFines: number;
  totalRewards: number;
  netImpact: number;
  fineCount: number;
  rewardCount: number;
};

const KIND_CONFIG: Record<
  string,
  { labelEn: string; labelSk: string; badgeCls: string; icon: string }
> = {
  FINE_NHL_ROSTER: {
    labelEn: "NHL Roster Fine",
    labelSk: "Pokuta za súpisku NHL",
    badgeCls: "bg-rose-500/15 text-rose-300 border-rose-500/30",
    icon: "📋",
  },
  FINE_AHL_ROSTER: {
    labelEn: "AHL Roster Fine",
    labelSk: "Pokuta za súpisku AHL",
    badgeCls: "bg-rose-500/15 text-rose-300 border-rose-500/30",
    icon: "📋",
  },
  FINE_CAP: {
    labelEn: "Salary Cap Violation",
    labelSk: "Prekročenie platového stropu",
    badgeCls: "bg-red-500/20 text-red-300 border-red-500/40",
    icon: "🧢",
  },
  FINE_FLOOR: {
    labelEn: "Cap Floor Violation",
    labelSk: "Podkročenie platového dna",
    badgeCls: "bg-amber-500/20 text-amber-300 border-amber-500/40",
    icon: "📉",
  },
  FINE_PLAYER: {
    labelEn: "Player Safety Fine",
    labelSk: "Disciplinárna pokuta hráča",
    badgeCls: "bg-orange-500/15 text-orange-300 border-orange-500/30",
    icon: "⚖️",
  },
  FINE_MANUAL: {
    labelEn: "Commissioner Fine",
    labelSk: "Disciplinárna pokuta od komisára",
    badgeCls: "bg-rose-500/15 text-rose-300 border-rose-500/30",
    icon: "🔨",
  },
  SUSPENSION_SALARY: {
    labelEn: "Forfeited Salary",
    labelSk: "Zhabaný plat (suspendácia)",
    badgeCls: "bg-purple-500/15 text-purple-300 border-purple-500/30",
    icon: "🚫",
  },
  PAYOUT: {
    labelEn: "Picks Game Prize",
    labelSk: "Výhra v Tipovačke (Picks)",
    badgeCls: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
    icon: "🎯",
  },
  BONUS: {
    labelEn: "Club Reward / Bonus",
    labelSk: "Finančná odmena / Bonus",
    badgeCls: "bg-cyan-500/15 text-cyan-300 border-cyan-500/30",
    icon: "🏆",
  },
  REFUND: {
    labelEn: "Fine Refund / Cancelled",
    labelSk: "Vrátená / Zrušená pokuta",
    badgeCls: "bg-slate-700/60 text-slate-300 border-slate-600",
    icon: "↩️",
  },
  INCOME: {
    labelEn: "League Revenue",
    labelSk: "Ligový príjem",
    badgeCls: "bg-blue-500/15 text-blue-300 border-blue-500/30",
    icon: "💵",
  },
  ADJUSTMENT: {
    labelEn: "Bank Adjustment",
    labelSk: "Banková úprava",
    badgeCls: "bg-slate-800 text-slate-400 border-slate-700",
    icon: "⚙️",
  },
};

export default function FinesRewardsView({
  entries,
  bankBalanceAmount,
  openingBalance,
  teamSummaries,
  isAdmin = false,
  lang = "en",
}: {
  entries: LedgerEntry[];
  bankBalanceAmount: number;
  openingBalance: number;
  teamSummaries: TeamFinancialSummary[];
  isAdmin?: boolean;
  lang?: string;
}) {
  const isSk = lang === "cs";

  const [filterCat, setFilterCat] = useState<"ALL" | "FINE" | "REWARD" | "DISCIPLINE" | "REFUND">("ALL");
  const [selectedTeam, setSelectedTeam] = useState<string>("ALL");
  const [q, setQ] = useState("");
  const [viewTab, setViewTab] = useState<"LEDGER" | "TEAMS">("LEDGER");

  // Metrics
  const metrics = useMemo(() => {
    let totalFines = 0;
    let totalRewards = 0;
    let totalRefunds = 0;

    for (const e of entries) {
      if (e.category === "FINE" || e.category === "DISCIPLINE") {
        totalFines += e.amount;
      } else if (e.category === "REWARD") {
        totalRewards += Math.abs(e.amount);
      } else if (e.category === "REFUND") {
        totalRefunds += Math.abs(e.amount);
      }
    }

    const hardestTeam = [...teamSummaries].sort((a, b) => b.totalFines - a.totalFines)[0] || null;

    return { totalFines, totalRewards, totalRefunds, hardestTeam };
  }, [entries, teamSummaries]);

  // Filtering
  const filteredEntries = useMemo(() => {
    const query = q.trim().toLowerCase();
    return entries.filter((e) => {
      if (filterCat !== "ALL") {
        if (filterCat === "FINE" && e.category !== "FINE" && e.category !== "DISCIPLINE") return false;
        if (filterCat === "REWARD" && e.category !== "REWARD") return false;
        if (filterCat === "DISCIPLINE" && e.category !== "DISCIPLINE") return false;
        if (filterCat === "REFUND" && e.category !== "REFUND") return false;
      }
      if (selectedTeam !== "ALL" && String(e.teamId) !== selectedTeam) return false;
      if (query) {
        const matchTeam = e.teamName?.toLowerCase().includes(query) || (e.teamCode?.toLowerCase().includes(query) ?? false);
        const matchNote = e.note?.toLowerCase().includes(query) ?? false;
        const matchPlayer = e.playerName?.toLowerCase().includes(query) ?? false;
        if (!matchTeam && !matchNote && !matchPlayer) return false;
      }
      return true;
    });
  }, [entries, filterCat, selectedTeam, q]);

  // Unique teams from entries for filter dropdown
  const filterTeamsList = useMemo(() => {
    const map = new Map<number, { id: number; name: string; code: string | null }>();
    for (const t of teamSummaries) {
      map.set(t.teamId, { id: t.teamId, name: t.name, code: t.code });
    }
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [teamSummaries]);

  return (
    <div className="space-y-6">
      {/* Top HUD KPI Deck */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {/* League Bank Balance */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3.5 backdrop-blur shadow-sm">
          <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
            {isSk ? "Zostatok ligovej banky" : "League Bank Balance"}
          </div>
          <div className="text-2xl font-black text-emerald-400 mt-1 font-mono">
            {money(bankBalanceAmount)}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            {isSk ? "Základný kapitál:" : "Starting pool:"} {money(openingBalance)}
          </div>
        </div>

        {/* Total Fines Collected */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3.5 backdrop-blur shadow-sm">
          <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
            {isSk ? "Vyzbierané pokuty celkom" : "Total Fines Levied"}
          </div>
          <div className="text-2xl font-black text-rose-400 mt-1 font-mono">
            {money(metrics.totalFines)}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            {isSk ? "Súpisky, platový strop, disciplinárka" : "Roster, Cap & Safety fines"}
          </div>
        </div>

        {/* Total Rewards Distributed */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3.5 backdrop-blur shadow-sm">
          <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
            {isSk ? "Vyplatené odmeny celkom" : "Total Rewards Paid"}
          </div>
          <div className="text-2xl font-black text-cyan-400 mt-1 font-mono">
            {money(metrics.totalRewards)}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            {isSk ? "Tipovačka, bonusy, ceny sezóny" : "Picks prizes & league bonuses"}
          </div>
        </div>

        {/* Most Penalized Club */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3.5 backdrop-blur shadow-sm">
          <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
            {isSk ? "Najviac pokutovaný klub" : "Most Penalized Club"}
          </div>
          {metrics.hardestTeam && metrics.hardestTeam.totalFines > 0 ? (
            <div className="flex items-center gap-2 mt-1">
              {metrics.hardestTeam.logoUrl && (
                <img src={metrics.hardestTeam.logoUrl} alt="" className="w-7 h-7 object-contain" />
              )}
              <div className="min-w-0 flex-1">
                <span className="text-sm font-bold text-white truncate block">
                  {metrics.hardestTeam.code ?? metrics.hardestTeam.name}
                </span>
                <span className="text-xs font-mono font-bold text-rose-400">
                  {money(metrics.hardestTeam.totalFines)}
                </span>
              </div>
            </div>
          ) : (
            <div className="text-lg font-bold text-slate-500 mt-1">—</div>
          )}
          <div className="text-[11px] text-slate-500 mt-1">
            {isSk ? "Suma zaplatených sankcií" : "Cumulative penalty sum"}
          </div>
        </div>
      </div>

      {/* Main Mode Toggle: Ledger vs Team Summary */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setViewTab("LEDGER")}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              viewTab === "LEDGER"
                ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm"
                : "bg-slate-900/70 text-slate-400 border border-slate-800 hover:border-slate-700 hover:text-slate-200"
            }`}
          >
            <span>📜</span>
            <span>{isSk ? "Denný záznam transakcií" : "Transaction Ledger"}</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-800 text-slate-300 font-mono">
              {entries.length}
            </span>
          </button>

          <button
            onClick={() => setViewTab("TEAMS")}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              viewTab === "TEAMS"
                ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm"
                : "bg-slate-900/70 text-slate-400 border border-slate-800 hover:border-slate-700 hover:text-slate-200"
            }`}
          >
            <span>🏛️</span>
            <span>{isSk ? "Klubová bilancia pokút a odmien" : "Club Summary Table"}</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-800 text-slate-300 font-mono">
              {teamSummaries.length}
            </span>
          </button>
        </div>

        {isAdmin && (
          <Link
            href="/admin/league-bank"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-sm transition-colors"
          >
            <span>⚙️</span>
            <span>{isSk ? "Správa ligovej banky (Admin)" : "Manage League Bank (Admin)"}</span>
          </Link>
        )}
      </div>

      {viewTab === "LEDGER" ? (
        <div className="space-y-4">
          {/* Filter Bar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-slate-900/60 p-3 rounded-xl border border-slate-800 backdrop-blur">
            <div className="relative flex-1 max-w-md">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-xs">🔍</span>
              <input
                type="text"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder={isSk ? "Hľadať v popise, klube alebo mene hráča..." : "Search in note, club or player name..."}
                className="w-full bg-slate-800/80 border border-slate-700/80 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500"
              />
              {q && (
                <button
                  onClick={() => setQ("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 text-xs"
                >
                  ✕
                </button>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* Category Filter Pills */}
              <div className="inline-flex rounded-lg bg-slate-800/80 p-0.5 border border-slate-700/60 text-xs">
                <button
                  onClick={() => setFilterCat("ALL")}
                  className={`px-2.5 py-1 rounded-md font-semibold transition-all ${
                    filterCat === "ALL" ? "bg-cyan-600 text-white shadow-sm" : "text-slate-400 hover:text-white"
                  }`}
                >
                  {isSk ? "Všetko" : "All"}
                </button>
                <button
                  onClick={() => setFilterCat("FINE")}
                  className={`px-2.5 py-1 rounded-md font-semibold transition-all ${
                    filterCat === "FINE" ? "bg-rose-600 text-white shadow-sm" : "text-slate-400 hover:text-white"
                  }`}
                >
                  💸 {isSk ? "Pokuty" : "Fines"}
                </button>
                <button
                  onClick={() => setFilterCat("REWARD")}
                  className={`px-2.5 py-1 rounded-md font-semibold transition-all ${
                    filterCat === "REWARD" ? "bg-emerald-600 text-white shadow-sm" : "text-slate-400 hover:text-white"
                  }`}
                >
                  🏆 {isSk ? "Odmeny" : "Rewards"}
                </button>
                <button
                  onClick={() => setFilterCat("REFUND")}
                  className={`px-2.5 py-1 rounded-md font-semibold transition-all ${
                    filterCat === "REFUND" ? "bg-slate-700 text-white shadow-sm" : "text-slate-400 hover:text-white"
                  }`}
                >
                  ↩️ {isSk ? "Vratky" : "Refunds"}
                </button>
              </div>

              {/* Team Selector */}
              <select
                value={selectedTeam}
                onChange={(e) => setSelectedTeam(e.target.value)}
                className="bg-slate-800/80 border border-slate-700/80 rounded-lg px-2.5 py-1 text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
              >
                <option value="ALL">{isSk ? "Všetky tímy" : "All Clubs"}</option>
                {filterTeamsList.map((t) => (
                  <option key={t.id} value={String(t.id)}>
                    {t.code ?? t.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Ledger Table */}
          <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-900/80 shadow-md">
            <table className="w-full text-sm min-w-[760px]">
              <thead>
                <tr className="text-xs font-semibold text-slate-400 uppercase tracking-wider bg-slate-800/40 border-b border-slate-800">
                  <th className="text-left px-4 py-3">{isSk ? "Dátum" : "Date"}</th>
                  <th className="text-left px-3 py-3">{isSk ? "Typ operácie" : "Operation"}</th>
                  <th className="text-left px-3 py-3">{isSk ? "Klub / Príjemca" : "Club / Recipient"}</th>
                  <th className="text-left px-4 py-3">{isSk ? "Dôvod / Popis" : "Reason / Note"}</th>
                  <th className="text-right px-4 py-3">{isSk ? "Finančný dopad" : "Amount"}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredEntries.map((e) => {
                  const conf = KIND_CONFIG[e.kind] || {
                    labelEn: e.kind,
                    labelSk: e.kind,
                    badgeCls: "bg-slate-800 text-slate-400 border-slate-700",
                    icon: "💵",
                  };

                  // Impact from club perspective:
                  // If amount > 0: club paid a fine (- money from club)
                  // If amount < 0: club received a payout (+ money to club)
                  const isFine = e.amount > 0;
                  const isRefund = e.kind === "REFUND";

                  return (
                    <tr key={e.id} className="hover:bg-slate-800/40 transition-colors">
                      {/* Date */}
                      <td className="px-4 py-3 text-slate-400 text-xs tabular-nums whitespace-nowrap">
                        {e.date}
                      </td>

                      {/* Operation Type */}
                      <td className="px-3 py-3 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold border ${conf.badgeCls}`}
                        >
                          <span>{conf.icon}</span>
                          <span>{isSk ? conf.labelSk : conf.labelEn}</span>
                        </span>
                      </td>

                      {/* Club */}
                      <td className="px-3 py-3 whitespace-nowrap">
                        {e.teamSlug ? (
                          <Link
                            href={`/teams/${e.teamSlug}`}
                            className="inline-flex items-center gap-2 text-slate-200 hover:text-cyan-400 transition-colors"
                          >
                            {e.teamLogoUrl && (
                              <img src={e.teamLogoUrl} alt="" className="w-5 h-5 object-contain shrink-0" />
                            )}
                            <span className="font-bold text-xs tracking-wider">{e.teamCode ?? e.teamName}</span>
                          </Link>
                        ) : e.teamName ? (
                          <span className="font-semibold text-xs text-slate-300">{e.teamName}</span>
                        ) : (
                          <span className="text-slate-600 text-xs">—</span>
                        )}
                      </td>

                      {/* Note / Reason */}
                      <td className="px-4 py-3">
                        <div className="text-xs text-slate-300 font-medium">
                          {e.note ?? "—"}
                        </div>
                        {e.playerName && (
                          <div className="text-[11px] text-cyan-400 mt-0.5">
                            {isSk ? "Hráč:" : "Player:"} {e.playerName}
                          </div>
                        )}
                      </td>

                      {/* Amount */}
                      <td className="px-4 py-3 text-right tabular-nums whitespace-nowrap font-mono">
                        {isRefund ? (
                          <span className="inline-block px-2.5 py-1 rounded-md text-xs font-bold bg-slate-800 text-slate-300 border border-slate-700">
                            +{money(Math.abs(e.amount))}
                          </span>
                        ) : isFine ? (
                          <span className="inline-block px-2.5 py-1 rounded-md text-xs font-bold bg-rose-500/10 text-rose-400 border border-rose-500/20">
                            −{money(e.amount)}
                          </span>
                        ) : (
                          <span className="inline-block px-2.5 py-1 rounded-md text-xs font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            +{money(Math.abs(e.amount))}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}

                {filteredEntries.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-10 text-center text-slate-500">
                      {isSk
                        ? "Žiadne finančné operácie nevyhovujú zvoleným filtrom."
                        : "No financial entries match your filters."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>

            <div className="px-4 py-3 bg-slate-900/90 border-t border-slate-800 flex items-center justify-between text-xs text-slate-500">
              <span>
                {isSk ? "Zobrazených:" : "Showing:"} {filteredEntries.length} / {entries.length} {isSk ? "záznamov" : "entries"}
              </span>
              <span>
                {isSk
                  ? "Pokuty plynú do ligovej banky, odmeny za Tipovačku a bonusy sú vyplácané klubom."
                  : "Fines flow into the league bank; picks rewards and bonuses are credited to clubs."}
              </span>
            </div>
          </div>
        </div>
      ) : (
        /* Team Breakdown Table */
        <div className="space-y-4">
          <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-900/80 shadow-md">
            <table className="w-full text-sm min-w-[700px]">
              <thead>
                <tr className="text-xs font-semibold text-slate-400 uppercase tracking-wider bg-slate-800/40 border-b border-slate-800">
                  <th className="text-left px-4 py-3">{isSk ? "Klub" : "Club"}</th>
                  <th className="text-right px-4 py-3">{isSk ? "Zaplatené pokuty" : "Fines Paid"}</th>
                  <th className="text-center px-3 py-3">{isSk ? "Počet pokút" : "Fines Count"}</th>
                  <th className="text-right px-4 py-3">{isSk ? "Získané odmeny" : "Rewards Earned"}</th>
                  <th className="text-center px-3 py-3">{isSk ? "Počet odmien" : "Rewards Count"}</th>
                  <th className="text-right px-4 py-3">{isSk ? "Čistá bilancia" : "Net Balance"}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {teamSummaries.map((t) => {
                  const hasPenalties = t.totalFines > 0;
                  const hasRewards = t.totalRewards > 0;

                  return (
                    <tr key={t.teamId} className="hover:bg-slate-800/40 transition-colors">
                      <td className="px-4 py-3">
                        <Link
                          href={`/teams/${t.slug}`}
                          className="inline-flex items-center gap-2 text-slate-200 hover:text-cyan-400 transition-colors"
                        >
                          {t.logoUrl && <img src={t.logoUrl} alt="" className="w-5 h-5 object-contain" />}
                          <span className="font-bold text-xs tracking-wider">{t.name}</span>
                          <span className="text-[10px] text-slate-500 font-mono">({t.code})</span>
                        </Link>
                      </td>

                      {/* Total Fines */}
                      <td className="px-4 py-3 text-right tabular-nums font-mono">
                        {hasPenalties ? (
                          <span className="text-rose-400 font-bold">−{money(t.totalFines)}</span>
                        ) : (
                          <span className="text-slate-600">—</span>
                        )}
                      </td>

                      {/* Fines Count */}
                      <td className="px-3 py-3 text-center tabular-nums text-xs">
                        {t.fineCount > 0 ? (
                          <span className="inline-block px-1.5 py-0.5 rounded bg-rose-500/10 text-rose-300 font-semibold border border-rose-500/20">
                            {t.fineCount}
                          </span>
                        ) : (
                          <span className="text-slate-600">0</span>
                        )}
                      </td>

                      {/* Total Rewards */}
                      <td className="px-4 py-3 text-right tabular-nums font-mono">
                        {hasRewards ? (
                          <span className="text-emerald-400 font-bold">+{money(t.totalRewards)}</span>
                        ) : (
                          <span className="text-slate-600">—</span>
                        )}
                      </td>

                      {/* Rewards Count */}
                      <td className="px-3 py-3 text-center tabular-nums text-xs">
                        {t.rewardCount > 0 ? (
                          <span className="inline-block px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-300 font-semibold border border-emerald-500/20">
                            {t.rewardCount}
                          </span>
                        ) : (
                          <span className="text-slate-600">0</span>
                        )}
                      </td>

                      {/* Net Impact */}
                      <td className="px-4 py-3 text-right tabular-nums font-mono font-bold">
                        {t.netImpact > 0 ? (
                          <span className="text-emerald-400">+{money(t.netImpact)}</span>
                        ) : t.netImpact < 0 ? (
                          <span className="text-rose-400">−{money(Math.abs(t.netImpact))}</span>
                        ) : (
                          <span className="text-slate-500">$0</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
