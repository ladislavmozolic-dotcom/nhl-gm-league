"use client";

import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import NominationForm from "@/components/all-star/NominationForm";
import { sendDm, getConversation, listConversations, type ConversationMsg, type ConvTeam } from "@/app/messages/actions";
import { useLang } from "@/components/LangProvider";

const EMOJIS = ["👍", "😂", "🔥", "🏒", "🥅", "💰", "🤝", "🤔", "😅", "😎", "👀", "🙌", "❌", "✅", "😱", "🎯", "💪", "🍺", "🫡", "🤯"];

type FilterTab = "all" | "active" | "unread" | "gms" | "system";

export default function Messenger({ initialTeams, initialActive }: { initialTeams: ConvTeam[]; initialActive: number | null }) {
  const router = useRouter();
  const lang = useLang();
  const isEn = lang === "en";

  const [teams, setTeams] = useState<ConvTeam[]>(initialTeams);
  const [active, setActive] = useState<number | null>(initialActive);
  const [msgs, setMsgs] = useState<ConversationMsg[]>([]);
  const [text, setText] = useState("");
  const [search, setSearch] = useState("");
  const [filterTab, setFilterTab] = useState<FilterTab>("all");
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [mobileChatOpen, setMobileChatOpen] = useState(initialActive !== null);

  const listRef = useRef<HTMLDivElement>(null);
  const atBottomRef = useRef(true);
  const stickBottomRef = useRef(true);

  const activeTeam = teams.find((t) => t.id === active) ?? null;

  // Load thread
  const loadConvo = useCallback(async (id: number) => {
    const r = await getConversation(id);
    if (!r.ok) return;
    setMsgs((prev) => {
      const same = prev.length === r.messages.length && prev.every((m, i) => m.id === r.messages[i].id && m.read === r.messages[i].read);
      return same ? prev : r.messages;
    });
  }, []);

  const refreshList = useCallback(async () => {
    const r = await listConversations();
    if (r.ok) {
      setTeams((prev) => {
        const same =
          prev.length === r.teams.length &&
          prev.every(
            (t, i) =>
              t.id === r.teams[i].id &&
              t.unread === r.teams[i].unread &&
              t.lastId === r.teams[i].lastId &&
              t.lastSnippet === r.teams[i].lastSnippet
          );
        return same ? prev : r.teams;
      });
    }
  }, []);

  // Poll conversation & conversation list
  useEffect(() => {
    if (active == null) return;
    stickBottomRef.current = true;
    loadConvo(active).then(() => router.refresh());
    const t = setInterval(() => {
      loadConvo(active);
      refreshList();
    }, 4000);
    return () => clearInterval(t);
  }, [active, loadConvo, refreshList, router]);

  // Keep chat pinned to bottom if already at bottom or newly opened
  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    if (stickBottomRef.current || atBottomRef.current) {
      el.scrollTop = el.scrollHeight;
      stickBottomRef.current = false;
    }
  }, [msgs]);

  const onListScroll = () => {
    const el = listRef.current;
    if (el) atBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
  };

  const open = (id: number) => {
    setActive(id);
    setMobileChatOpen(true);
    setTeams((ts) => ts.map((t) => (t.id === id ? { ...t, unread: 0 } : t)));
  };

  const send = async (body?: string, tradeUrl?: string) => {
    if (active == null) return;
    const b = (body ?? text).trim();
    if (!b) return;
    setSending(true);
    const r = await sendDm(active, b, tradeUrl);
    setSending(false);
    if (r.ok) {
      setText("");
      setEmojiOpen(false);
      stickBottomRef.current = true;
      await loadConvo(active);
      await refreshList();
    }
  };

  // Quick preset messages
  const quickTemplates = isEn
    ? [
        "Hey! Are you open to discussing trades?",
        "Took a look at your trade block. Let's make a deal.",
        "Interested in your draft picks. What is your asking price?",
        "Sent you a trade proposal on the board — let me know your thoughts!",
      ]
    : [
        "Ahoj! Si otvorený diskusiám o trejdoch?",
        "Pozeral som tvoj Trade Block. Skúsme niečo dohodnúť.",
        "Mám záujem o tvoje draft picky. Aká je tvoja predstava?",
        "Poslal som ti návrh na trejd — daj mi vedieť čo si o tom myslíš!",
      ];

  // Helper formatting for timestamps
  const formatTimeAgo = (iso?: string | null) => {
    if (!iso) return "";
    const date = new Date(iso);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    const diffHour = Math.floor(diffMin / 60);
    const diffDays = Math.floor(diffHour / 24);

    if (diffMin < 1) return isEn ? "just now" : "teraz";
    if (diffMin < 60) return `${diffMin}m`;
    if (diffHour < 24) return `${diffHour}h`;
    if (diffDays === 1) return isEn ? "yesterday" : "včera";
    if (diffDays < 7) return `${diffDays}d`;
    return date.toLocaleDateString(isEn ? "en-GB" : "sk-SK", { day: "numeric", month: "numeric" });
  };

  const formatMsgTime = (iso: string) => {
    return new Date(iso).toLocaleTimeString(isEn ? "en-GB" : "sk-SK", { hour: "2-digit", minute: "2-digit" });
  };

  const formatDateHeader = (iso: string) => {
    const d = new Date(iso);
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);

    if (d.toDateString() === today.toDateString()) {
      return isEn ? "Today" : "Dnes";
    }
    if (d.toDateString() === yesterday.toDateString()) {
      return isEn ? "Yesterday" : "Včera";
    }
    return d.toLocaleDateString(isEn ? "en-GB" : "sk-SK", {
      weekday: "short",
      day: "numeric",
      month: "short",
      year: d.getFullYear() !== today.getFullYear() ? "numeric" : undefined,
    });
  };

  // Filtered & Searched team conversations
  const filteredTeams = useMemo(() => {
    const q = search.trim().toLowerCase();
    return teams.filter((t) => {
      // Tab filter
      if (filterTab === "active" && t.lastId === 0) return false;
      if (filterTab === "unread" && t.unread === 0) return false;
      if (filterTab === "gms" && (!t.hasGm || t.code === "SYS" || t.code === "FA")) return false;
      if (filterTab === "system" && t.code !== "SYS" && t.code !== "FA") return false;

      // Text search
      if (!q) return true;
      const matchName = t.name.toLowerCase().includes(q);
      const matchCode = (t.code ?? "").toLowerCase().includes(q);
      const matchGm = (t.gm ?? "").toLowerCase().includes(q);
      const matchSnippet = (t.lastSnippet ?? "").toLowerCase().includes(q);
      return matchName || matchCode || matchGm || matchSnippet;
    });
  }, [teams, filterTab, search]);

  const totalUnreadCount = useMemo(() => {
    return teams.reduce((acc, curr) => acc + (curr.unread || 0), 0);
  }, [teams]);

  // Group messages by date
  const groupedMsgs = useMemo(() => {
    const groups: { dateKey: string; dateLabel: string; items: ConversationMsg[] }[] = [];
    let currentKey = "";
    let currentGroup: ConversationMsg[] = [];

    for (const m of msgs) {
      const dayKey = new Date(m.at).toDateString();
      if (dayKey !== currentKey) {
        if (currentGroup.length > 0) {
          groups.push({
            dateKey: currentKey,
            dateLabel: formatDateHeader(currentGroup[0].at),
            items: currentGroup,
          });
        }
        currentKey = dayKey;
        currentGroup = [m];
      } else {
        currentGroup.push(m);
      }
    }
    if (currentGroup.length > 0) {
      groups.push({
        dateKey: currentKey,
        dateLabel: formatDateHeader(currentGroup[0].at),
        items: currentGroup,
      });
    }
    return groups;
  }, [msgs, isEn]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-4 h-[78vh] min-h-[580px] select-text">
      {/* -------------------- LEFT SIDEBAR (CONVERSATION LIST) -------------------- */}
      <div
        className={`rounded-2xl border border-slate-800 bg-slate-900/60 backdrop-blur-md flex flex-col overflow-hidden shadow-xl ${
          mobileChatOpen ? "hidden lg:flex" : "flex"
        }`}
      >
        {/* Header & Search */}
        <div className="p-3.5 border-b border-slate-800/80 bg-slate-900/80 space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-slate-100 uppercase tracking-wider">
                {isEn ? "Conversations" : "Konverzácie"}
              </span>
              {totalUnreadCount > 0 && (
                <span className="px-1.5 py-0.5 rounded-full bg-red-600 text-[10px] font-black text-white shadow-sm">
                  {totalUnreadCount} {isEn ? "new" : "nových"}
                </span>
              )}
            </div>
            <span className="text-xs text-slate-500 font-medium">
              {filteredTeams.length} {isEn ? "teams" : "tímov"}
            </span>
          </div>

          {/* Search bar */}
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm">🔍</span>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={isEn ? "Search team, code or GM..." : "Hľadať tím, skratku alebo GM..."}
              className="w-full bg-slate-950/70 border border-slate-750 rounded-xl pl-9 pr-8 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500/80 transition-all"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 text-xs"
              >
                ✕
              </button>
            )}
          </div>

          {/* Filter Pills */}
          <div className="flex items-center gap-1 overflow-x-auto pb-0.5 text-[11px] scrollbar-none">
            <button
              onClick={() => setFilterTab("all")}
              className={`px-2.5 py-1 rounded-lg font-medium whitespace-nowrap transition-colors ${
                filterTab === "all" ? "bg-blue-600 text-white shadow" : "bg-slate-800/60 text-slate-400 hover:bg-slate-800"
              }`}
            >
              {isEn ? "All" : "Všetky"}
            </button>
            <button
              onClick={() => setFilterTab("active")}
              className={`px-2.5 py-1 rounded-lg font-medium whitespace-nowrap transition-colors ${
                filterTab === "active" ? "bg-blue-600 text-white shadow" : "bg-slate-800/60 text-slate-400 hover:bg-slate-800"
              }`}
            >
              {isEn ? "Active" : "Aktívne"}
            </button>
            <button
              onClick={() => setFilterTab("unread")}
              className={`px-2.5 py-1 rounded-lg font-medium whitespace-nowrap transition-colors flex items-center gap-1 ${
                filterTab === "unread" ? "bg-red-600 text-white shadow" : "bg-slate-800/60 text-slate-400 hover:bg-slate-800"
              }`}
            >
              {isEn ? "Unread" : "Neprečítané"}
              {totalUnreadCount > 0 && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
            </button>
            <button
              onClick={() => setFilterTab("gms")}
              className={`px-2.5 py-1 rounded-lg font-medium whitespace-nowrap transition-colors ${
                filterTab === "gms" ? "bg-blue-600 text-white shadow" : "bg-slate-800/60 text-slate-400 hover:bg-slate-800"
              }`}
            >
              {isEn ? "GMs" : "Manažéri"}
            </button>
            <button
              onClick={() => setFilterTab("system")}
              className={`px-2.5 py-1 rounded-lg font-medium whitespace-nowrap transition-colors ${
                filterTab === "system" ? "bg-amber-600 text-white shadow" : "bg-slate-800/60 text-slate-400 hover:bg-slate-800"
              }`}
            >
              {isEn ? "System" : "Systém"}
            </button>
          </div>
        </div>

        {/* Conversation List Items */}
        <div className="flex-1 overflow-y-auto divide-y divide-slate-800/40">
          {filteredTeams.length === 0 ? (
            <div className="p-8 text-center text-slate-500 text-xs">
              {isEn ? "No matching conversations found." : "Nenašli sa žiadne zodpovedajúce konverzácie."}
            </div>
          ) : (
            filteredTeams.map((t) => {
              const isSelected = active === t.id;
              const isSystem = t.code === "SYS";
              const isFA = t.code === "FA";

              return (
                <button
                  key={t.id}
                  onClick={() => open(t.id)}
                  className={`w-full flex items-center gap-3 px-3.5 py-3 text-left transition-all group ${
                    isSelected
                      ? "bg-blue-600/20 border-l-4 border-blue-500 pl-2.5 shadow-inner"
                      : "hover:bg-slate-800/50"
                  }`}
                >
                  {/* Team Logo / Avatar */}
                  <div className="relative shrink-0">
                    <div className="w-10 h-10 rounded-xl bg-slate-950/80 border border-slate-750 flex items-center justify-center overflow-hidden p-1">
                      {isSystem ? (
                        <span className="text-lg">📢</span>
                      ) : isFA ? (
                        <span className="text-lg">💼</span>
                      ) : t.logoUrl ? (
                        <img src={t.logoUrl} alt={t.name} className="w-full h-full object-contain" />
                      ) : (
                        <span className="text-xs font-bold text-slate-400">{t.code ?? "GM"}</span>
                      )}
                    </div>
                    {/* Status dot */}
                    <span
                      title={t.hasGm ? (isEn ? "Active GM" : "Aktívny GM") : isEn ? "CPU/Unclaimed" : "CPU Tím"}
                      className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-slate-900 ${
                        isSystem
                          ? "bg-amber-400"
                          : isFA
                          ? "bg-violet-400"
                          : t.hasGm
                          ? "bg-emerald-500"
                          : "bg-slate-500"
                      }`}
                    />
                  </div>

                  {/* Team & Message Snippet */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-1 mb-0.5">
                      <span className="text-xs font-bold text-slate-100 truncate group-hover:text-blue-300 transition-colors">
                        {t.name}
                      </span>
                      {t.lastAt && (
                        <span className="text-[10px] text-slate-500 shrink-0 whitespace-nowrap">
                          {formatTimeAgo(t.lastAt)}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center justify-between gap-1 text-[11px]">
                      <span className="text-slate-400 truncate flex items-center gap-1">
                        {isSystem ? (
                          <span className="text-amber-400 font-semibold">{isEn ? "System" : "Systém"}</span>
                        ) : isFA ? (
                          <span className="text-violet-400 font-semibold">{isEn ? "Agent" : "Agent"}</span>
                        ) : t.hasGm ? (
                          <span className="text-slate-400 font-medium truncate">
                            GM {t.gm || t.code}
                          </span>
                        ) : (
                          <span className="text-slate-500 italic">{isEn ? "no GM" : "bez GM"}</span>
                        )}
                        {t.lastSnippet && (
                          <>
                            <span className="text-slate-600">·</span>
                            <span className="text-slate-400 truncate max-w-[130px]">
                              {t.lastFromMe ? (isEn ? "You: " : "Ty: ") : ""}
                              {t.lastSnippet}
                            </span>
                          </>
                        )}
                      </span>

                      {/* Unread badge */}
                      {t.unread > 0 && (
                        <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-red-600 text-white text-[10px] font-black grid place-items-center shrink-0 shadow animate-pulse">
                          {t.unread}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* -------------------- RIGHT MAIN AREA (CHAT WINDOW) -------------------- */}
      <div
        className={`rounded-2xl border border-slate-800 bg-slate-900/60 backdrop-blur-md flex flex-col overflow-hidden shadow-xl ${
          mobileChatOpen ? "flex" : "hidden lg:flex"
        }`}
      >
        {activeTeam ? (
          <>
            {/* Chat Top Bar */}
            <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-slate-800 bg-slate-900/90">
              {/* Mobile Back Button */}
              <button
                onClick={() => setMobileChatOpen(false)}
                className="lg:hidden p-1.5 rounded-lg bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700"
                title={isEn ? "Back to conversations" : "Späť na konverzácie"}
              >
                ←
              </button>

              {/* Team Info */}
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <div className="w-10 h-10 rounded-xl bg-slate-950/80 border border-slate-750 flex items-center justify-center overflow-hidden p-1 shrink-0">
                  {activeTeam.code === "SYS" ? (
                    <span className="text-xl">📢</span>
                  ) : activeTeam.code === "FA" ? (
                    <span className="text-xl">💼</span>
                  ) : activeTeam.logoUrl ? (
                    <img src={activeTeam.logoUrl} alt="" className="w-full h-full object-contain" />
                  ) : (
                    <span className="text-xs font-bold text-slate-300">{activeTeam.code ?? "GM"}</span>
                  )}
                </div>

                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h2 className="font-bold text-slate-100 text-sm truncate">{activeTeam.name}</h2>
                    {activeTeam.code && (
                      <span className="px-1.5 py-0.2 rounded bg-slate-800 text-slate-400 text-[10px] font-mono">
                        {activeTeam.code}
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-slate-400 flex items-center gap-2 truncate">
                    {activeTeam.code === "SYS" ? (
                      <span className="text-amber-400 font-semibold">
                        {isEn ? "League Announcements & Trade Oversight" : "Ligové oznámenia a dohľad nad trejdami"}
                      </span>
                    ) : activeTeam.code === "FA" ? (
                      <span className="text-violet-400 font-semibold">
                        {isEn ? "Free Agent Contract Agency" : "Agentúra voľných hráčov"}
                      </span>
                    ) : (
                      <>
                        <span className="text-slate-300 font-medium">
                          {activeTeam.hasGm ? `GM ${activeTeam.gm || ""}` : isEn ? "CPU Controlled" : "Riadené AI"}
                        </span>
                        {activeTeam.division && (
                          <>
                            <span className="text-slate-600">·</span>
                            <span className="text-slate-400">{activeTeam.division}</span>
                          </>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Quick Actions Header */}
              {activeTeam.code !== "SYS" && (
                <div className="flex items-center gap-2 shrink-0">
                  {activeTeam.slug && (
                    <Link
                      href={`/teams/${activeTeam.slug}/trade-block`}
                      className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700/80 border border-slate-700/60 text-slate-200 text-xs font-semibold transition-all hover:scale-102"
                      title={isEn ? "View Trade Block" : "Pozrieť Trade Block"}
                    >
                      📋 <span className="hidden md:inline">{isEn ? "Trade Block" : "Na trhu"}</span>
                    </Link>
                  )}
                  {activeTeam.slug && (
                    <Link
                      href={`/teams/${activeTeam.slug}`}
                      className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700/80 border border-slate-700/60 text-slate-200 text-xs font-semibold transition-all hover:scale-102"
                      title={isEn ? "View Team Roster" : "Zostava tímu"}
                    >
                      🛡️ <span className="hidden md:inline">{isEn ? "Roster" : "Zostava"}</span>
                    </Link>
                  )}
                  <Link
                    href={`/trades/build?opp=${activeTeam.id}`}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold shadow-md hover:shadow-emerald-900/30 transition-all hover:scale-102"
                  >
                    🔁 <span>{isEn ? "Propose Trade" : "Ponúknuť výmenu"}</span>
                  </Link>
                </div>
              )}
            </div>

            {/* Quick Discussion Templates Pill Bar */}
            {activeTeam.code !== "SYS" && (
              <div className="px-4 py-2 border-b border-slate-800/60 bg-slate-950/40 flex items-center gap-2 overflow-x-auto scrollbar-none">
                <span className="text-[11px] text-slate-500 shrink-0 font-medium">⚡ {isEn ? "Quick:" : "Rýchle:"}</span>
                {quickTemplates.map((qt, i) => (
                  <button
                    key={i}
                    onClick={() => setText(qt)}
                    className="shrink-0 px-2.5 py-1 rounded-lg bg-slate-800/50 hover:bg-slate-800 border border-slate-755/50 text-[11px] text-slate-300 hover:text-white transition-colors"
                  >
                    {qt.length > 38 ? qt.slice(0, 38) + "…" : qt}
                  </button>
                ))}
              </div>
            )}

            {/* Chat Messages Feed */}
            <div
              ref={listRef}
              onScroll={onListScroll}
              className="flex-1 overflow-y-auto px-4 py-4 space-y-4 bg-gradient-to-b from-slate-950/30 to-slate-900/20"
            >
              {msgs.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center py-12 px-4">
                  <div className="w-14 h-14 rounded-2xl bg-blue-600/10 border border-blue-500/20 flex items-center justify-center text-2xl mb-3">
                    💬
                  </div>
                  <h3 className="text-sm font-semibold text-slate-200 mb-1">
                    {isEn ? "No messages yet" : "Žiadne správy"}
                  </h3>
                  <p className="text-xs text-slate-500 max-w-sm mb-4">
                    {isEn
                      ? `Start a conversation with ${activeTeam.name}. Discuss upcoming games, trade assets, or negotiate contracts.`
                      : `Začni konverzáciu s tímom ${activeTeam.name}. Dohodnite si trejdy, prediskutujte draft picky alebo sa pozdravte.`}
                  </p>
                  <button
                    onClick={() => send(isEn ? "Hi! 👋" : "Čau! 👋")}
                    className="px-3.5 py-1.5 rounded-xl bg-blue-600/80 hover:bg-blue-600 text-white text-xs font-semibold shadow transition-all hover:scale-102"
                  >
                    {isEn ? "Say Hi 👋" : "Pozdraviť 👋"}
                  </button>
                </div>
              ) : (
                groupedMsgs.map((grp) => (
                  <div key={grp.dateKey} className="space-y-3">
                    {/* Date Separator Pill */}
                    <div className="flex items-center justify-center my-3">
                      <span className="px-3 py-0.5 rounded-full bg-slate-800/80 border border-slate-700/60 text-[10px] font-medium text-slate-400 shadow-sm">
                        {grp.dateLabel}
                      </span>
                    </div>

                    {/* Messages in this day */}
                    {grp.items.map((m) => {
                      const isSystemMsg = activeTeam.code === "SYS";

                      if (isSystemMsg) {
                        return (
                          <div key={m.id} className="max-w-[85%] mx-auto my-2">
                            <div className="rounded-2xl border border-amber-600/30 bg-amber-950/20 p-3.5 text-xs text-slate-200 shadow-md">
                              <div className="flex items-center gap-1.5 text-amber-400 font-semibold mb-1">
                                <span>📢</span>
                                <span>{isEn ? "League Notification" : "Ligové oznámenie"}</span>
                              </div>
                              <div className="whitespace-pre-wrap break-words leading-relaxed">{m.body}</div>
                              {m.tradeUrl && (
                                <Link
                                  href={m.tradeUrl}
                                  className="mt-2.5 inline-flex items-center gap-1 px-3 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300 font-bold transition-colors"
                                >
                                  {m.tradeUrl.startsWith("/trades")
                                    ? isEn
                                      ? "🔁 Review Trade Proposal →"
                                      : "🔁 Otvoriť návrh výmeny →"
                                    : isEn
                                    ? "Open Link →"
                                    : "Otvoriť odkaz →"}
                                </Link>
                              )}
                              <div className="mt-1 text-[10px] text-amber-400/60 text-right">
                                {formatMsgTime(m.at)}
                              </div>
                            </div>
                          </div>
                        );
                      }

                      return (
                        <div
                          key={m.id}
                          className={`flex items-end gap-2 ${m.mine ? "justify-end" : "justify-start"}`}
                        >
                          {!m.mine && activeTeam.logoUrl && (
                            <img
                              src={activeTeam.logoUrl}
                              alt=""
                              className="w-6 h-6 object-contain shrink-0 mb-1 opacity-80"
                            />
                          )}

                          <div
                            className={`max-w-[78%] sm:max-w-[70%] rounded-2xl px-4 py-2.5 text-sm shadow-md transition-all ${
                              m.mine
                                ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-br-xs"
                                : "bg-slate-800/90 border border-slate-750 text-slate-100 rounded-bl-xs"
                            }`}
                          >
                            <div className="whitespace-pre-wrap break-words leading-relaxed text-[13px]">
                              {m.body}
                            </div>

                            {/* Attached links / forms */}
                            {m.tradeUrl === "/all-star/nominate" ? (
                              <div className="mt-2 pt-2 border-t border-white/10">
                                <NominationForm compact />
                              </div>
                            ) : m.tradeUrl === "/all-star/coach" ? (
                              <Link
                                href={m.tradeUrl}
                                className="mt-2 inline-flex items-center gap-1 rounded-xl bg-amber-600 hover:bg-amber-500 px-3 py-1.5 text-xs font-bold text-white shadow"
                              >
                                📋 {isEn ? "Open Coach Room →" : "Otvoriť trénerskú miestnosť →"}
                              </Link>
                            ) : (
                              m.tradeUrl && (
                                <Link
                                  href={m.tradeUrl}
                                  className={`mt-1.5 inline-flex items-center gap-1 text-xs font-semibold underline underline-offset-2 ${
                                    m.mine ? "text-blue-100 hover:text-white" : "text-emerald-400 hover:text-emerald-300"
                                  }`}
                                >
                                  {m.tradeUrl.startsWith("/trades")
                                    ? isEn
                                      ? "🔁 View Trade Proposal →"
                                      : "🔁 Zobraziť návrh výmeny →"
                                    : isEn
                                    ? "Open →"
                                    : "Otvoriť →"}
                                </Link>
                              )
                            )}

                            {/* Message Footer: time + read receipts */}
                            <div
                              className={`mt-1 text-[10px] flex items-center gap-1 justify-end select-none ${
                                m.mine ? "text-blue-200/80" : "text-slate-400"
                              }`}
                            >
                              <span>{formatMsgTime(m.at)}</span>
                              {m.mine && (
                                <span
                                  className="font-bold tracking-tighter"
                                  title={m.read ? (isEn ? "Read" : "Prečítané") : isEn ? "Delivered" : "Doručené"}
                                >
                                  {m.read ? (
                                    <span className="text-sky-200">✓✓</span>
                                  ) : (
                                    <span className="opacity-70">✓</span>
                                  )}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ))
              )}
            </div>

            {/* Input Bar */}
            {activeTeam.code === "SYS" ? (
              <div className="border-t border-slate-800 p-3 bg-slate-900/60 text-center text-xs text-slate-500">
                {isEn
                  ? "This is a broadcast channel for system alerts. Direct replies are disabled."
                  : "Toto je systémový informačný kanál. Priame odpovede sú vypnuté."}
              </div>
            ) : (
              <div className="border-t border-slate-800 p-3 bg-slate-900/80 relative">
                {/* Emoji Picker Popup */}
                {emojiOpen && (
                  <div className="absolute bottom-16 left-3 bg-slate-900 border border-slate-700/80 rounded-2xl p-2.5 grid grid-cols-10 gap-1.5 shadow-2xl z-20 backdrop-blur-md animate-in fade-in zoom-in-95 duration-100">
                    {EMOJIS.map((e) => (
                      <button
                        key={e}
                        type="button"
                        onClick={() => setText((t) => t + e)}
                        className="text-xl hover:bg-slate-800 rounded-lg p-1.5 transition-transform hover:scale-120"
                      >
                        {e}
                      </button>
                    ))}
                  </div>
                )}

                <div className="flex items-end gap-2">
                  <button
                    type="button"
                    onClick={() => setEmojiOpen((o) => !o)}
                    className="text-xl p-2 rounded-xl hover:bg-slate-800 text-slate-400 hover:text-amber-300 transition-colors shrink-0"
                    title={isEn ? "Add emoji" : "Pridať emoji"}
                  >
                    😊
                  </button>

                  <textarea
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    rows={1}
                    placeholder={isEn ? `Message ${activeTeam.name}…` : `Napísať tímu ${activeTeam.name}…`}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        send();
                      }
                    }}
                    className="flex-1 resize-none bg-slate-950/80 border border-slate-750 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 max-h-32 transition-all leading-relaxed"
                  />

                  <button
                    type="button"
                    onClick={() => send()}
                    disabled={sending || !text.trim()}
                    className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 disabled:opacity-40 text-white text-xs sm:text-sm font-bold shadow-md hover:shadow-blue-600/30 transition-all shrink-0 flex items-center gap-1.5"
                  >
                    {sending ? (
                      <span className="animate-spin text-xs">⏳</span>
                    ) : (
                      <>
                        <span>{isEn ? "Send" : "Odoslať"}</span>
                        <span>➤</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-slate-500">
            <div className="w-16 h-16 rounded-3xl bg-slate-800/40 border border-slate-750 flex items-center justify-center text-3xl mb-3 shadow-inner">
              📬
            </div>
            <h3 className="text-base font-bold text-slate-300 mb-1">
              {isEn ? "Select a GM or Team" : "Vyber manažéra alebo tím"}
            </h3>
            <p className="text-xs text-slate-500 max-w-sm">
              {isEn
                ? "Choose any team from the list on the left to start negotiating, chatting, or proposing trades."
                : "Klikni na tím v ľavom zozname a začni vyjednávať, dohadovať výmeny alebo písať správy."}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

