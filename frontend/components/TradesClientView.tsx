"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import PlayerAvatar from "@/components/playerAvatar";
import TradeActions from "@/components/TradeActions";
import TradeGroupActions from "@/components/TradeGroupActions";
import CommishTradeActions from "@/components/CommishTradeActions";

export type EnrichedTradeAsset = {
  assetType: "PLAYER" | "PROSPECT" | "PICK" | "CASH" | "OTHER";
  text: string;
  name?: string;
  photoUrl?: string | null;
  position?: string | null;
  capHit?: number | null;
  retentionPct?: number | null;
  href?: string | null;
  external?: boolean;
  origTeamCode?: string | null;
  origTeamLogo?: string | null;
  pickYear?: number | null;
  pickRound?: number | null;
  cashAmount?: number | null;
};

export type EnrichedTeam = {
  id: number;
  name: string;
  code: string | null;
  logoUrl: string | null;
  rookieGm?: boolean;
  gm?: string | null;
  gmNickname?: string | null;
  slug?: string | null;
};

export type EnrichedTrade = {
  id: number;
  status: string;
  condition: string | null;
  createdAtStr: string;
  respondedAtStr: string | null;
  declinedBy?: string | null;
  fromTeamId: number;
  toTeamId: number;
  fromTeam?: EnrichedTeam | null;
  toTeam?: EnrichedTeam | null;
  fromLabels: EnrichedTradeAsset[];
  toLabels: EnrichedTradeAsset[];
  action: "receiver" | "proposer" | null;
};

export type EnrichedGroup = {
  id: number;
  status: string;
  createdAtStr: string;
  legs: {
    id: number;
    fromTeam?: EnrichedTeam | null;
    toTeam?: EnrichedTeam | null;
    assetLabels: EnrichedTradeAsset[];
  }[];
  responses: {
    teamId: number;
    status: string;
    team?: { name: string; code: string | null; logoUrl?: string | null } | null;
  }[];
  canRespond: boolean;
  isCommishReview?: boolean;
};

interface TradesClientViewProps {
  trades: EnrichedTrade[];
  groups: EnrichedGroup[];
  sessionTeamId?: number | null;
  isAdmin?: boolean;
  isCommission?: boolean;
  commishQueueCount?: number;
}

const STATUS_CONFIG: Record<string, { label: string; badgeClass: string; icon: string }> = {
  PENDING: { label: "Čaká na potvrdenie", badgeClass: "bg-amber-500/15 text-amber-300 border-amber-500/30", icon: "⏳" },
  ACCEPTED: { label: "Dokončená", badgeClass: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30", icon: "✓" },
  COMPLETED: { label: "Dokončená", badgeClass: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30", icon: "✓" },
  AWAITING_COMMISH: { label: "V schvaľovaní (Komisia)", badgeClass: "bg-purple-500/15 text-purple-300 border-purple-500/30", icon: "⚖️" },
  MODIFY: { label: "Vrátená na úpravu", badgeClass: "bg-sky-500/15 text-sky-300 border-sky-500/30", icon: "✏️" },
  MODIFIED: { label: "Upravená (Prebieha revízia)", badgeClass: "bg-fuchsia-500/15 text-fuchsia-300 border-fuchsia-500/30", icon: "✏️" },
  DECLINED: { label: "Odmietnutá", badgeClass: "bg-rose-500/15 text-rose-400 border-rose-500/30", icon: "✕" },
  CANCELLED: { label: "Zrušená", badgeClass: "bg-slate-700/40 text-slate-400 border-slate-700/50", icon: "—" },
};

function formatCap(cap?: number | null) {
  if (!cap) return null;
  if (cap >= 1_000_000) {
    return `$${(cap / 1_000_000).toFixed(2).replace(/\.00$/, "")}M`;
  }
  return `$${Math.round(cap / 1000)}k`;
}

export default function TradesClientView({
  trades,
  groups,
  sessionTeamId,
  isAdmin = false,
  isCommission = false,
  commishQueueCount = 0,
}: TradesClientViewProps) {
  const [activeTab, setActiveTab] = useState<"ALL" | "MY" | "COMMISH" | "GROUPS">("ALL");
  const [search, setSearch] = useState("");
  const [teamFilter, setTeamFilter] = useState<string>("ALL");

  // Collect unique teams for dropdown filter
  const allTeams = useMemo(() => {
    const map = new Map<number, EnrichedTeam>();
    trades.forEach((t) => {
      if (t.fromTeam) map.set(t.fromTeam.id, t.fromTeam);
      if (t.toTeam) map.set(t.toTeam.id, t.toTeam);
    });
    groups.forEach((g) => {
      g.legs.forEach((l) => {
        if (l.fromTeam) map.set(l.fromTeam.id, l.fromTeam);
        if (l.toTeam) map.set(l.toTeam.id, l.toTeam);
      });
    });
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [trades, groups]);

  // Counts for tabs
  const myTradesCount = useMemo(() => {
    if (!sessionTeamId) return 0;
    return trades.filter((t) => t.fromTeamId === sessionTeamId || t.toTeamId === sessionTeamId).length;
  }, [trades, sessionTeamId]);

  const commishTradesCount = useMemo(() => {
    const cTrades = trades.filter((t) => ["AWAITING_COMMISH", "MODIFY", "MODIFIED"].includes(t.status));
    const cGroups = groups.filter((g) => g.status === "AWAITING_COMMISH");
    return cTrades.length + cGroups.length;
  }, [trades, groups]);

  // Filtered 2-team trades
  const filteredTrades = useMemo(() => {
    return trades.filter((t) => {
      // Tab filter
      if (activeTab === "MY") {
        if (!sessionTeamId) return false;
        if (t.fromTeamId !== sessionTeamId && t.toTeamId !== sessionTeamId) return false;
      } else if (activeTab === "COMMISH") {
        if (!["AWAITING_COMMISH", "MODIFY", "MODIFIED"].includes(t.status)) return false;
      } else if (activeTab === "GROUPS") {
        return false;
      }

      // Team filter
      if (teamFilter !== "ALL") {
        const teamIdNum = Number(teamFilter);
        if (t.fromTeamId !== teamIdNum && t.toTeamId !== teamIdNum) return false;
      }

      // Search query
      if (search.trim()) {
        const q = search.toLowerCase();
        const fromName = t.fromTeam?.name?.toLowerCase() ?? "";
        const fromCode = t.fromTeam?.code?.toLowerCase() ?? "";
        const toName = t.toTeam?.name?.toLowerCase() ?? "";
        const toCode = t.toTeam?.code?.toLowerCase() ?? "";
        const matchTeams = fromName.includes(q) || fromCode.includes(q) || toName.includes(q) || toCode.includes(q);

        const matchAssets = [...t.fromLabels, ...t.toLabels].some((a) =>
          a.text.toLowerCase().includes(q) ||
          (a.name && a.name.toLowerCase().includes(q)) ||
          (a.origTeamCode && a.origTeamCode.toLowerCase().includes(q))
        );

        if (!matchTeams && !matchAssets) return false;
      }

      return true;
    });
  }, [trades, activeTab, teamFilter, search, sessionTeamId]);

  // Filtered 3-team groups
  const filteredGroups = useMemo(() => {
    if (activeTab === "MY" || activeTab === "COMMISH" || activeTab === "ALL" || activeTab === "GROUPS") {
      return groups.filter((g) => {
        if (activeTab === "COMMISH" && g.status !== "AWAITING_COMMISH") return false;
        if (activeTab === "MY" && sessionTeamId) {
          const involved = g.legs.some((l) => l.fromTeam?.id === sessionTeamId || l.toTeam?.id === sessionTeamId);
          if (!involved) return false;
        }

        if (teamFilter !== "ALL") {
          const teamIdNum = Number(teamFilter);
          const involved = g.legs.some((l) => l.fromTeam?.id === teamIdNum || l.toTeam?.id === teamIdNum);
          if (!involved) return false;
        }

        if (search.trim()) {
          const q = search.toLowerCase();
          const matchLegs = g.legs.some((l) =>
            (l.fromTeam?.name?.toLowerCase() ?? "").includes(q) ||
            (l.toTeam?.name?.toLowerCase() ?? "").includes(q) ||
            l.assetLabels.some((a) => a.text.toLowerCase().includes(q) || (a.name && a.name.toLowerCase().includes(q)))
          );
          if (!matchLegs) return false;
        }

        return true;
      });
    }
    return [];
  }, [groups, activeTab, teamFilter, search, sessionTeamId]);

  // Group trades for clean sections
  const inReviewTrades = useMemo(() => {
    return filteredTrades.filter((t) => ["AWAITING_COMMISH", "MODIFY", "MODIFIED"].includes(t.status));
  }, [filteredTrades]);

  const inReviewGroups = useMemo(() => {
    return filteredGroups.filter((g) => g.status === "AWAITING_COMMISH");
  }, [filteredGroups]);

  const pendingTrades = useMemo(() => {
    return filteredTrades.filter((t) => t.status === "PENDING");
  }, [filteredTrades]);

  const regularTrades = useMemo(() => {
    return filteredTrades.filter((t) => !["AWAITING_COMMISH", "MODIFY", "MODIFIED", "PENDING"].includes(t.status));
  }, [filteredTrades]);

  const regularGroups = useMemo(() => {
    return filteredGroups.filter((g) => g.status !== "AWAITING_COMMISH");
  }, [filteredGroups]);

  return (
    <div className="space-y-6">
      {/* 1. COMMISSION REVIEW CALLOUT (Always visible to commissioners!) */}
      {isCommission && (
        <div className="bg-gradient-to-r from-amber-950/40 via-[#0e172a] to-amber-950/30 border border-amber-500/40 rounded-2xl p-4 shadow-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-lg shrink-0">
              🕵️
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-sm font-black text-amber-300 uppercase tracking-wide">
                  Komisia pre dohľad nad výmenami (Trade Commission)
                </h3>
                {commishQueueCount > 0 ? (
                  <span className="px-2 py-0.5 rounded-full bg-amber-500/25 text-amber-200 border border-amber-500/40 text-[10px] font-bold animate-pulse">
                    {commishQueueCount} čaká na posúdenie
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700 text-[10px] font-semibold">
                    0 čakajúcich výmen
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Posudzovanie a schvaľovanie výmen nováčikov (Rookie GM oversight) a dohľad nad ligovým balansom.
              </p>
            </div>
          </div>
          <Link
            href="/trades/commish"
            className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs transition-colors shrink-0 shadow-lg shadow-amber-500/20"
          >
            {commishQueueCount > 0 ? `Posúdiť výmeny (${commishQueueCount}) →` : "Otvoriť komisiu →"}
          </Link>
        </div>
      )}

      {/* 2. CONTROLS STRIP (Tabs, Team Filter, Search & Propose Buttons) */}
      <div className="bg-[#0b1120] border border-slate-800 rounded-2xl p-3.5 sm:p-4 shadow-xl space-y-3.5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3.5">
          {/* Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 lg:pb-0 scrollbar-thin">
            <button
              onClick={() => setActiveTab("ALL")}
              className={`px-3.5 py-1.5 rounded-xl font-bold text-xs whitespace-nowrap transition-all ${
                activeTab === "ALL"
                  ? "bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/25"
                  : "bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800"
              }`}
            >
              Všetky výmeny <span className="ml-1 opacity-80 font-mono">({trades.length + groups.length})</span>
            </button>

            {sessionTeamId != null && (
              <button
                onClick={() => setActiveTab("MY")}
                className={`px-3.5 py-1.5 rounded-xl font-bold text-xs whitespace-nowrap transition-all flex items-center gap-1.5 ${
                  activeTab === "MY"
                    ? "bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/25"
                    : "bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800"
                }`}
              >
                <span>Moje výmeny</span>
                {myTradesCount > 0 && (
                  <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                    activeTab === "MY" ? "bg-slate-950/30 text-slate-950" : "bg-cyan-500/20 text-cyan-300"
                  }`}>
                    {myTradesCount}
                  </span>
                )}
              </button>
            )}

            <button
              onClick={() => setActiveTab("COMMISH")}
              className={`px-3.5 py-1.5 rounded-xl font-bold text-xs whitespace-nowrap transition-all flex items-center gap-1.5 ${
                activeTab === "COMMISH"
                  ? "bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/25"
                  : "bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800"
              }`}
            >
              <span>V schvaľovaní</span>
              {commishTradesCount > 0 && (
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                  activeTab === "COMMISH" ? "bg-slate-950/30 text-slate-950" : "bg-purple-500/20 text-purple-300"
                }`}>
                  {commishTradesCount}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab("GROUPS")}
              className={`px-3.5 py-1.5 rounded-xl font-bold text-xs whitespace-nowrap transition-all ${
                activeTab === "GROUPS"
                  ? "bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/25"
                  : "bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800"
              }`}
            >
              3-Tímové <span className="ml-1 opacity-80 font-mono">({groups.length})</span>
            </button>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2 shrink-0">
            {sessionTeamId != null && (
              <>
                <Link
                  href="/trades/build"
                  className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white font-bold text-xs shadow-lg shadow-cyan-900/30 flex items-center gap-1.5 transition-all"
                >
                  <span>+</span> Navrhnúť výmenu
                </Link>
                <Link
                  href="/trades/build3"
                  className="px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 font-bold text-xs border border-slate-800 transition-colors"
                >
                  + 3-Tímová
                </Link>
              </>
            )}
          </div>
        </div>

        {/* Filter row: Search input + Team selector */}
        <div className="flex flex-col sm:flex-row items-center gap-2.5 pt-2 border-t border-slate-800/80">
          <div className="relative flex-1 w-full">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filtrovať podľa hráča, tímu, picku..."
              className="w-full bg-slate-900/90 border border-slate-800 rounded-xl px-3 py-1.5 pl-8 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500/60 transition-colors"
            />
            <span className="absolute left-2.5 top-2 text-xs text-slate-500">🔍</span>
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-2.5 top-2 text-xs text-slate-400 hover:text-white"
              >
                ✕
              </button>
            )}
          </div>

          <div className="w-full sm:w-auto shrink-0 flex items-center gap-2">
            <span className="text-xs text-slate-400 shrink-0 font-medium">Tím:</span>
            <select
              value={teamFilter}
              onChange={(e) => setTeamFilter(e.target.value)}
              className="w-full sm:w-48 bg-slate-900 border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-cyan-500/60 cursor-pointer"
            >
              <option value="ALL">Všetky tímy</option>
              {allTeams.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} ({t.code})
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* 3. LIST OF TRADES */}
      <div className="space-y-6">
        {/* SECTION A: WITH THE COMMISSION (always pinned when items are in review) */}
        {(inReviewTrades.length > 0 || inReviewGroups.length > 0) && (activeTab === "ALL" || activeTab === "COMMISH") && (
          <div className="space-y-4 p-4 sm:p-5 rounded-2xl bg-purple-950/20 border border-purple-500/30 shadow-xl">
            <div className="flex items-center justify-between pb-2 border-b border-purple-500/25">
              <h2 className="text-sm font-black uppercase tracking-wider text-purple-300 flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-purple-400 animate-pulse" />
                <span>Na posúdenie komisiou (With the Commission)</span>
                <span className="px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-200 border border-purple-500/40 text-[10px] font-mono">
                  {inReviewTrades.length + inReviewGroups.length}
                </span>
              </h2>
              {isCommission && (
                <Link
                  href="/trades/commish"
                  className="text-xs text-purple-300 hover:text-purple-100 font-bold underline-offset-2 hover:underline"
                >
                  Otvoriť komisiu →
                </Link>
              )}
            </div>

            <div className="space-y-4">
              {inReviewTrades.map((t) => (
                <TradeCardComponent
                  key={`commish-${t.id}`}
                  trade={t}
                  admin={isAdmin}
                  isCommission={isCommission}
                  sessionTeamId={sessionTeamId}
                />
              ))}

              {inReviewGroups.map((g) => (
                <TradeGroupCardComponent
                  key={`commish-g-${g.id}`}
                  group={g}
                  isCommission={isCommission}
                />
              ))}
            </div>
          </div>
        )}

        {/* SECTION B: PENDING PROPOSALS (for recipient or proposer) */}
        {pendingTrades.length > 0 && activeTab === "ALL" && (
          <div className="space-y-4">
            <h2 className="text-sm font-black uppercase tracking-wider text-amber-400 flex items-center gap-2 pt-2">
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
              Čakajúce návrhy výmen ({pendingTrades.length})
            </h2>
            <div className="space-y-4">
              {pendingTrades.map((t) => (
                <TradeCardComponent
                  key={`pending-${t.id}`}
                  trade={t}
                  admin={isAdmin}
                  isCommission={isCommission}
                  sessionTeamId={sessionTeamId}
                />
              ))}
            </div>
          </div>
        )}

        {/* SECTION C: 3-TEAM TRADES */}
        {(activeTab === "GROUPS" || (activeTab === "ALL" && regularGroups.length > 0)) && (
          <div className="space-y-4">
            {activeTab === "ALL" && regularGroups.length > 0 && (
              <h2 className="text-sm font-black uppercase tracking-wider text-sky-400 flex items-center gap-2 pt-2">
                <span>🔄</span> 3-Tímové výmeny ({regularGroups.length})
              </h2>
            )}
            <div className="space-y-4">
              {regularGroups.map((g) => (
                <TradeGroupCardComponent
                  key={`group-${g.id}`}
                  group={g}
                  isCommission={isCommission}
                />
              ))}
            </div>
          </div>
        )}

        {/* SECTION D: REGULAR / COMPLETED TRADES */}
        {activeTab !== "GROUPS" && (activeTab !== "COMMISH" || inReviewTrades.length === 0) && (
          <div className="space-y-4">
            {activeTab === "ALL" && regularTrades.length > 0 && (
              <h2 className="text-sm font-black uppercase tracking-wider text-slate-300 flex items-center gap-2 pt-2">
                <span>🔁</span> História výmen ({regularTrades.length})
              </h2>
            )}

            <div className="space-y-4">
              {regularTrades.map((t) => (
                <TradeCardComponent
                  key={`trade-${t.id}`}
                  trade={t}
                  admin={isAdmin}
                  isCommission={isCommission}
                  sessionTeamId={sessionTeamId}
                />
              ))}
            </div>
          </div>
        )}

        {/* Empty state */}
        {filteredTrades.length === 0 && filteredGroups.length === 0 && (
          <div className="bg-[#0b1120] border border-slate-800 rounded-2xl p-12 text-center shadow-xl space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-slate-800/80 border border-slate-700 mx-auto flex items-center justify-center text-xl text-slate-400">
              🏒
            </div>
            <h3 className="text-base font-bold text-slate-200">Nenašli sa žiadne výmeny</h3>
            <p className="text-xs text-slate-400 max-w-md mx-auto">
              Pre zadané kritériá alebo vyhľadávanie nie sú k dispozícii žiadne záznamy o výmenách.
            </p>
            {(search || teamFilter !== "ALL" || activeTab !== "ALL") && (
              <button
                onClick={() => {
                  setSearch("");
                  setTeamFilter("ALL");
                  setActiveTab("ALL");
                }}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-cyan-400 transition-colors"
              >
                Resetovať filtre
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// =========================================================================
// 2-TEAM TRADE CARD COMPONENT
// =========================================================================
function TradeCardComponent({
  trade,
  admin,
  isCommission,
  sessionTeamId,
}: {
  trade: EnrichedTrade;
  admin?: boolean;
  isCommission?: boolean;
  sessionTeamId?: number | null;
}) {
  const isDone = trade.status === "ACCEPTED" || trade.status === "COMPLETED";
  const statusCfg = STATUS_CONFIG[trade.status] ?? {
    label: trade.status,
    badgeClass: "bg-slate-700/40 text-slate-300 border-slate-700/50",
    icon: "•",
  };

  const isInReview = ["AWAITING_COMMISH", "MODIFY", "MODIFIED"].includes(trade.status);
  const isConflicted = sessionTeamId != null && (sessionTeamId === trade.fromTeamId || sessionTeamId === trade.toTeamId);

  return (
    <div className="bg-[#0b1120] border border-slate-800/90 hover:border-slate-700/80 rounded-2xl shadow-xl overflow-hidden transition-all duration-300">
      {/* 1. Header: Matchup Duel & Status Badge */}
      <div className="bg-gradient-to-r from-slate-900/95 via-slate-900/80 to-slate-900/95 px-4 sm:px-5 py-3 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3">
        {/* Teams Duel */}
        <div className="flex items-center gap-2.5 sm:gap-4 min-w-0">
          {/* Team From */}
          <div className="flex items-center gap-2.5 min-w-0">
            {trade.fromTeam?.logoUrl ? (
              <span className="inline-flex items-center justify-center rounded-xl bg-slate-950 border border-slate-800 p-1 shrink-0 shadow-inner" style={{ width: 36, height: 36 }}>
                <img src={trade.fromTeam.logoUrl} alt="" className="object-contain" style={{ width: 26, height: 26 }} />
              </span>
            ) : (
              <div className="w-9 h-9 rounded-xl bg-slate-800 flex items-center justify-center text-xs font-bold text-slate-300 shrink-0">
                {trade.fromTeam?.code ?? "?"}
              </div>
            )}
            <div className="min-w-0">
              <div className="text-xs sm:text-sm font-bold text-white flex items-center gap-1.5 truncate">
                <Link href={trade.fromTeam?.slug ? `/teams/${trade.fromTeam.slug}` : "/teams"} className="hover:text-cyan-300 transition-colors">
                  {trade.fromTeam?.name ?? "Tím"}
                </Link>
                {trade.fromTeam?.rookieGm && (
                  <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30" title="Rookie GM">
                    R
                  </span>
                )}
              </div>
              <div className="text-[10px] text-slate-400 font-mono truncate">
                {trade.fromTeam?.gmNickname ? `GM ${trade.fromTeam.gmNickname}` : (trade.fromTeam?.gm ? `GM ${trade.fromTeam.gm}` : trade.fromTeam?.code)}
              </div>
            </div>
          </div>

          {/* Trade Direction Icon */}
          <div className="flex items-center justify-center w-7 h-7 rounded-full bg-slate-800/90 border border-slate-700 text-cyan-400 text-xs font-black shrink-0 shadow-sm">
            ⇄
          </div>

          {/* Team To */}
          <div className="flex items-center gap-2.5 min-w-0">
            {trade.toTeam?.logoUrl ? (
              <span className="inline-flex items-center justify-center rounded-xl bg-slate-950 border border-slate-800 p-1 shrink-0 shadow-inner" style={{ width: 36, height: 36 }}>
                <img src={trade.toTeam.logoUrl} alt="" className="object-contain" style={{ width: 26, height: 26 }} />
              </span>
            ) : (
              <div className="w-9 h-9 rounded-xl bg-slate-800 flex items-center justify-center text-xs font-bold text-slate-300 shrink-0">
                {trade.toTeam?.code ?? "?"}
              </div>
            )}
            <div className="min-w-0">
              <div className="text-xs sm:text-sm font-bold text-white flex items-center gap-1.5 truncate">
                <Link href={trade.toTeam?.slug ? `/teams/${trade.toTeam.slug}` : "/teams"} className="hover:text-cyan-300 transition-colors">
                  {trade.toTeam?.name ?? "Tím"}
                </Link>
                {trade.toTeam?.rookieGm && (
                  <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30" title="Rookie GM">
                    R
                  </span>
                )}
              </div>
              <div className="text-[10px] text-slate-400 font-mono truncate">
                {trade.toTeam?.gmNickname ? `GM ${trade.toTeam.gmNickname}` : (trade.toTeam?.gm ? `GM ${trade.toTeam.gm}` : trade.toTeam?.code)}
              </div>
            </div>
          </div>
        </div>

        {/* Status Badge & Timestamp */}
        <div className="flex items-center gap-2.5 ml-auto shrink-0">
          <span
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-black uppercase tracking-wider border shadow-sm ${statusCfg.badgeClass}`}
            title={trade.status === "DECLINED" && trade.declinedBy ? `Odmietol: ${trade.declinedBy}` : undefined}
          >
            <span>{statusCfg.icon}</span>
            <span>{statusCfg.label}</span>
          </span>
          <span className="text-[11px] text-slate-500 font-mono hidden sm:inline">
            {isDone ? trade.respondedAtStr : trade.createdAtStr}
          </span>
        </div>
      </div>

      {/* 2. Dual-Column Assets Display */}
      <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-slate-800/80 p-4 sm:p-5 gap-4 md:gap-0">
        {/* Left Column */}
        <div className="md:pr-4 space-y-2.5">
          <div className="flex items-center justify-between pb-1.5 border-b border-slate-800/60">
            <span className="text-xs font-black uppercase tracking-wider text-cyan-400 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-cyan-400"></span>
              <span>{trade.fromTeam?.name ?? "Tím"}</span>
              <span className="text-slate-400 font-medium lowercase">({isDone ? "získal" : "posiela"}):</span>
            </span>
            <span className="text-[11px] text-slate-500 font-mono">
              {(isDone ? trade.toLabels : trade.fromLabels).length} aktív
            </span>
          </div>

          <div className="space-y-2">
            {(isDone ? trade.toLabels : trade.fromLabels).length === 0 ? (
              <p className="text-xs text-slate-500 italic py-2">future considerations</p>
            ) : (
              (isDone ? trade.toLabels : trade.fromLabels).map((asset, i) => (
                <TradeAssetRow key={i} asset={asset} />
              ))
            )}
          </div>
        </div>

        {/* Right Column */}
        <div className="md:pl-4 space-y-2.5 pt-3 md:pt-0">
          <div className="flex items-center justify-between pb-1.5 border-b border-slate-800/60">
            <span className="text-xs font-black uppercase tracking-wider text-blue-400 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-blue-400"></span>
              <span>{trade.toTeam?.name ?? "Tím"}</span>
              <span className="text-slate-400 font-medium lowercase">({isDone ? "získal" : "posiela"}):</span>
            </span>
            <span className="text-[11px] text-slate-500 font-mono">
              {(isDone ? trade.fromLabels : trade.toLabels).length} aktív
            </span>
          </div>

          <div className="space-y-2">
            {(isDone ? trade.fromLabels : trade.toLabels).length === 0 ? (
              <p className="text-xs text-slate-500 italic py-2">future considerations</p>
            ) : (
              (isDone ? trade.fromLabels : trade.toLabels).map((asset, i) => (
                <TradeAssetRow key={i} asset={asset} />
              ))
            )}
          </div>
        </div>
      </div>

      {/* 3. Condition box (if specified) */}
      {trade.condition && (
        <div className="mx-4 sm:mx-5 mb-4 p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/25 text-xs text-amber-200/90 flex items-start gap-2">
          <span className="shrink-0 text-amber-400">📎</span>
          <div>
            <strong className="text-amber-300 font-bold">Podmienka výmeny:</strong> {trade.condition}
          </div>
        </div>
      )}

      {/* 4. Commission review notes */}
      {trade.status === "AWAITING_COMMISH" && (
        <div className="mx-4 sm:mx-5 mb-4 p-2.5 rounded-xl bg-purple-500/10 border border-purple-500/25 text-xs text-purple-200/90 flex items-center gap-2">
          <span>🕵️</span>
          <span>Dohodnuté oboma manažérmi — čaká na finálne schválenie ligovou komisiou (ochrana rookie-GM).</span>
        </div>
      )}
      {trade.status === "MODIFY" && (
        <div className="mx-4 sm:mx-5 mb-4 p-2.5 rounded-xl bg-sky-500/10 border border-sky-500/25 text-xs text-sky-200/90 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span>✏️</span>
            <span>Komisia požiadala o prebalancovanie výmeny pred schválením.</span>
          </div>
          <Link href={`/trades/build?edit=${trade.id}`} className="underline font-bold text-sky-300 hover:text-white shrink-0">
            Upraviť a znovu odoslať →
          </Link>
        </div>
      )}
      {trade.status === "MODIFIED" && (
        <div className="mx-4 sm:mx-5 mb-4 p-2.5 rounded-xl bg-fuchsia-500/10 border border-fuchsia-500/25 text-xs text-fuchsia-200/90 flex items-center gap-2">
          <span>✏️</span>
          <span>Výmena bola upravená manažérom a vrátená komisii na opätovné posúdenie.</span>
        </div>
      )}

      {/* 5. Footer: Initiator, Timestamp and Actions */}
      <div className="px-4 sm:px-5 py-3 bg-slate-950/70 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-3 text-slate-400 flex-wrap">
          <span>
            Navrhol: <strong className="text-slate-200 font-semibold">{trade.fromTeam?.name ?? "?"}</strong>
          </span>
          <span className="text-slate-600">·</span>
          <span className="text-slate-500 font-mono">
            {isDone ? `Dokončené: ${trade.respondedAtStr ?? trade.createdAtStr}` : `Navrhnuté: ${trade.createdAtStr}`}
          </span>
          <span className="text-slate-600">·</span>
          <span className="text-slate-500 font-mono">#{trade.id}</span>
        </div>

        {/* Actions component */}
        <div className="flex items-center gap-2.5 flex-wrap">
          {(trade.action || admin) && (
            <TradeActions
              tradeId={trade.id}
              role={trade.action}
              admin={admin}
              pending={trade.status === "PENDING"}
            />
          )}

          {/* COMMISSION DIRECT APPROVAL BUTTONS */}
          {isCommission && isInReview && (
            <div className="flex items-center gap-2 bg-purple-950/30 border border-purple-500/30 px-3 py-1.5 rounded-xl">
              <span className="text-xs font-bold text-purple-300 flex items-center gap-1">
                <span>⚖️</span> Komisia:
              </span>
              {isConflicted ? (
                <span className="text-xs text-slate-400 italic">Váš tím je vo výmene (rozhoduje iný člen)</span>
              ) : (
                <CommishTradeActions tradeId={trade.id} status={trade.status} />
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// =========================================================================
// ASSET ROW COMPONENT (Player, Pick, Prospect, Cash)
// =========================================================================
function TradeAssetRow({ asset }: { asset: EnrichedTradeAsset }) {
  if (asset.assetType === "PLAYER") {
    return (
      <div className="flex items-center justify-between p-2 rounded-xl bg-slate-900/70 border border-slate-800 hover:border-slate-700 transition-colors group">
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          <div className="relative shrink-0">
            <PlayerAvatar src={asset.photoUrl ?? null} alt={asset.name ?? asset.text} size={34} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-xs font-bold text-slate-100 group-hover:text-cyan-300 transition-colors truncate">
              {asset.href ? (
                <Link href={asset.href}>{asset.name ?? asset.text}</Link>
              ) : (
                asset.name ?? asset.text
              )}
            </div>
            <div className="text-[11px] text-slate-400 flex items-center gap-1.5 mt-0.5 flex-wrap">
              {asset.position && (
                <span className="px-1.5 py-0.2 rounded bg-slate-800 text-[10px] font-mono text-slate-300 font-semibold">
                  {asset.position}
                </span>
              )}
              {asset.capHit != null && (
                <span className="font-mono text-slate-400">Cap: {formatCap(asset.capHit)}</span>
              )}
              {asset.retentionPct != null && asset.retentionPct > 0 && (
                <span className="px-1.5 py-0.2 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30 text-[10px] font-bold font-mono">
                  {asset.retentionPct}% retencia
                </span>
              )}
            </div>
          </div>
        </div>

        {asset.href && (
          <Link href={asset.href} className="text-xs text-slate-500 group-hover:text-cyan-400 font-bold shrink-0 pl-2">
            →
          </Link>
        )}
      </div>
    );
  }

  if (asset.assetType === "PICK") {
    return (
      <div className="flex items-center justify-between p-2 rounded-xl bg-slate-900/70 border border-slate-800 hover:border-slate-700 transition-colors group">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-sm shrink-0">
            🎫
          </div>
          <div className="min-w-0">
            <div className="text-xs font-bold text-slate-100 group-hover:text-amber-300 transition-colors truncate">
              {asset.pickYear && asset.pickRound
                ? `${asset.pickYear} · ${asset.pickRound}. Kolo Draftu`
                : asset.text}
            </div>
            <div className="text-[10px] text-slate-400 flex items-center gap-1.5 mt-0.5">
              {asset.origTeamLogo && (
                <img src={asset.origTeamLogo} alt="" className="w-3.5 h-3.5 object-contain" />
              )}
              {asset.origTeamCode ? (
                <span className="font-mono text-slate-300 font-medium">pôvodný výber {asset.origTeamCode}</span>
              ) : null}
            </div>
          </div>
        </div>

        {asset.pickRound != null && (
          <span className="px-2 py-0.5 rounded text-[10px] font-bold font-mono bg-amber-500/15 text-amber-300 border border-amber-500/30 shrink-0">
            KOLO {asset.pickRound}
          </span>
        )}
      </div>
    );
  }

  if (asset.assetType === "PROSPECT") {
    return (
      <div className="flex items-center justify-between p-2 rounded-xl bg-slate-900/70 border border-slate-800 hover:border-slate-700 transition-colors group">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-sm shrink-0">
            ⭐
          </div>
          <div className="min-w-0">
            <div className="text-xs font-bold text-slate-100 group-hover:text-purple-300 transition-colors truncate">
              {asset.name ?? asset.text}
            </div>
            <div className="text-[10px] text-purple-300/80 font-mono">
              Prospect · {asset.position ?? "Nádej"}
            </div>
          </div>
        </div>

        {asset.href && (
          <a
            href={asset.href}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[11px] text-slate-400 hover:text-purple-300 font-medium shrink-0 flex items-center gap-1 pl-2 transition-colors"
          >
            <span>EP</span>
            <span>↗</span>
          </a>
        )}
      </div>
    );
  }

  if (asset.assetType === "CASH") {
    return (
      <div className="flex items-center gap-2.5 p-2 rounded-xl bg-slate-900/70 border border-slate-800">
        <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-sm shrink-0">
          💵
        </div>
        <div className="text-xs font-bold text-emerald-300 font-mono">
          {asset.text}
        </div>
      </div>
    );
  }

  return (
    <div className="p-2 rounded-xl bg-slate-900/70 border border-slate-800 text-xs text-slate-300">
      {asset.text}
    </div>
  );
}

// =========================================================================
// 3-TEAM TRADE GROUP CARD COMPONENT
// =========================================================================
function TradeGroupCardComponent({
  group,
  isCommission,
}: {
  group: EnrichedGroup;
  isCommission?: boolean;
}) {
  const isCommishReview = group.status === "AWAITING_COMMISH";
  return (
    <div className="bg-[#0b1120] border border-sky-800/40 hover:border-sky-700/60 rounded-2xl shadow-xl overflow-hidden transition-all">
      {/* Header */}
      <div className="bg-gradient-to-r from-sky-950/40 via-slate-900 to-slate-900 px-4 sm:px-5 py-3 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          {group.legs.map((l, i) => (
            <div key={l.id} className="flex items-center gap-1.5 text-xs sm:text-sm">
              {l.fromTeam?.logoUrl ? (
                <img src={l.fromTeam.logoUrl} alt="" className="w-5 h-5 object-contain" />
              ) : null}
              <span className="font-bold text-white">{l.fromTeam?.code ?? l.fromTeam?.name ?? "?"}</span>
              <span className="text-slate-500">→</span>
              {i === group.legs.length - 1 && (
                <>
                  {l.toTeam?.logoUrl ? (
                    <img src={l.toTeam.logoUrl} alt="" className="w-5 h-5 object-contain" />
                  ) : null}
                  <span className="font-bold text-white">{l.toTeam?.code ?? l.toTeam?.name ?? "?"}</span>
                </>
              )}
            </div>
          ))}
        </div>

        <span
          className={`px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider border ${
            group.status === "AWAITING_COMMISH"
              ? "bg-purple-500/20 text-purple-300 border-purple-500/30"
              : "bg-sky-500/20 text-sky-300 border-sky-500/30"
          }`}
        >
          {group.status === "AWAITING_COMMISH" ? "⚖️ V SCHVAĽOVANÍ" : "🔄 3-TÍMOVÁ VÝMENA"}
        </span>
      </div>

      {/* Legs */}
      <div className="p-4 sm:p-5 space-y-3">
        {group.legs.map((leg) => (
          <div key={leg.id} className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2 font-bold text-white">
                {leg.fromTeam?.logoUrl && (
                  <img src={leg.fromTeam.logoUrl} alt="" className="w-4 h-4 object-contain" />
                )}
                <span>{leg.fromTeam?.name ?? "?"}</span>
                <span className="text-slate-500 font-normal">posiela do</span>
                {leg.toTeam?.logoUrl && (
                  <img src={leg.toTeam.logoUrl} alt="" className="w-4 h-4 object-contain" />
                )}
                <span>{leg.toTeam?.name ?? "?"}</span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {leg.assetLabels.length === 0 ? (
                <p className="text-xs text-slate-500 italic">future considerations</p>
              ) : (
                leg.assetLabels.map((a, i) => <TradeAssetRow key={i} asset={a} />)
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Responses */}
      <div className="px-4 sm:px-5 pb-3 flex items-center gap-2 flex-wrap text-xs">
        <span className="text-slate-400 font-semibold mr-1">Stav potvrdenia:</span>
        {group.responses.map((r) => (
          <span
            key={r.teamId}
            className={`px-2.5 py-0.5 rounded-full font-bold text-[11px] border ${
              r.status === "ACCEPTED"
                ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
                : r.status === "DECLINED"
                ? "bg-rose-500/15 text-rose-300 border-rose-500/30"
                : "bg-slate-800 text-slate-400 border-slate-700/60"
            }`}
          >
            {r.team?.code ?? r.team?.name ?? "?"}: {r.status}
          </span>
        ))}
      </div>

      {/* Footer */}
      <div className="px-4 sm:px-5 py-3 bg-slate-950/70 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-3 text-xs">
        <span className="text-slate-500 font-mono">Dátum návrhu: {group.createdAtStr}</span>
        <TradeGroupActions
          groupId={group.id}
          canRespond={group.canRespond || (!!isCommission && isCommishReview)}
          isCommishReview={group.isCommishReview || (!!isCommission && isCommishReview)}
        />
      </div>
    </div>
  );
}
