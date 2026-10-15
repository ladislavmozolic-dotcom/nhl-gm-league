"use client";

import InstallBanner from "./InstallBanner";
import { BACKGROUNDS, FONTS } from "./looks";
import { PushBanner, usePush, type PushApi } from "./push";
import { DEFAULT_PREFS, SOUNDS, loadPrefs, playSound, savePrefs, unlockAudio, type Prefs, type SoundId, type Theme } from "./sound";
import { EmojiPicker, GifPicker, Lightbox, VOICE_MAX_SECS, emoticonize, linkify, VoicePlayer, fileIcon, fmtSecs, fmtSize, isBigEmoji, prepareImage, startRecording, uploadFile, uploadImage, uploadVoice, type Recorder } from "./media";
import { Fragment, useLayoutEffect, useCallback, useEffect, useMemo, useRef, useState } from "react";

type TeamLite = { id: number; code: string | null; name: string; logoUrl: string | null; gmNickname: string | null; avatarUrl: string | null };
type Poll = { id: number; question: string; multi: boolean; closed: boolean; options: { id: number; text: string; voters: number[] }[] };
type FileAtt = { url: string; name: string; size: number };
type Reaction = { emoji: string; teams: number[] };
const QUICK_REACTIONS = ["❤️", "😂", "😮", "😢", "😡", "👍"];
const MORE_REACTIONS = ["🔥", "🏒", "🥅", "🎉", "👏", "🍆", "👎", "🙏"];
type Msg = { mentions: number[]; mentionAll: boolean; reactions: Reaction[]; kind: string; voice: { url: string; secs: number } | null; file: FileAtt | null; pinned: boolean; poll: Poll | null; imageUrl: string | null; edited: boolean; id: number; roomId: number; fromTeamId: number; body: string; at: string; deleted: boolean; replyTo: { id: number; fromTeamId: number; body: string } | null };
type Room = { mentioned: boolean; id: number; kind: string; otherTeamId: number | null; unread: number; last: Msg | null; lastReadId: number; muted: boolean; mutedUntil: string | null; bg: string | null; font: string | null; name: string | null; imageUrl: string | null; createdById: number | null; members: number[] };
const attending = () => typeof document !== "undefined" && document.visibilityState === "visible" && document.hasFocus();
const handleOf = (t?: { gmNickname: string | null; code: string | null } | null) => ((t?.gmNickname || t?.code) ?? "").replace(/\s+/g, "");
const ALL_TAGS = ["všetci", "vsetci", "all", "everyone"];
const roomMuted = (r?: { muted: boolean; mutedUntil: string | null } | null) => !!r?.muted && (!r.mutedUntil || new Date(r.mutedUntil) > new Date());
const muteLabel = (until: string | null) => (!until ? "Navždy" : `do ${new Date(until).toLocaleString("sk-SK", { day: "numeric", month: "numeric", hour: "2-digit", minute: "2-digit" })}`);
const MUTE_OPTIONS: { label: string; hours: number | null }[] = [{ label: "1 hodinu", hours: 1 }, { label: "8 hodín", hours: 8 }, { label: "1 deň", hours: 24 }, { label: "1 týždeň", hours: 168 }, { label: "Navždy", hours: null }];
type Boot = { tradeRoomId: number | null; cursor: number; me: TeamLite; admin: boolean; enabled: boolean; muted: boolean; leagueRoomId: number; teams: TeamLite[]; rooms: Room[]; vapid: string | null; gif: boolean };

const hm = (iso: string) => new Date(iso).toLocaleTimeString("sk-SK", { hour: "2-digit", minute: "2-digit" });
function dayLabel(iso: string) {
  const d = new Date(iso), n = new Date();
  const same = (a: Date, b: Date) => a.toDateString() === b.toDateString();
  if (same(d, n)) return "Dnes";
  const y = new Date(n); y.setDate(n.getDate() - 1);
  return same(d, y) ? "Včera" : d.toLocaleDateString("sk-SK", { day: "numeric", month: "long" });
}
function Logo({ t, size = 40 }: { t?: TeamLite | null; size?: number }) {
  return (
    <div className="shrink-0 rounded-full bg-slate-800 flex items-center justify-center overflow-hidden" style={{ width: size, height: size }}>
      {t?.avatarUrl ? <img src={t.avatarUrl} alt="" className="w-full h-full object-cover" /> : t?.logoUrl ? <img src={t.logoUrl} alt="" className="w-[75%] h-[75%] object-contain" /> : <span className="text-xs font-bold text-slate-400">{t?.code ?? "?"}</span>}
    </div>
  );
}

function RoomIcon({ r, size }: { r: { kind: string; imageUrl: string | null } | null; size: number }) {
  const league = r?.kind === "league";
  return (
    <div className={`shrink-0 rounded-full overflow-hidden flex items-center justify-center ${league ? "bg-blue-600/20" : "bg-emerald-600/20"}`} style={{ width: size, height: size, fontSize: size * 0.45 }}>
      {r?.imageUrl ? <img src={r.imageUrl} alt="" className="w-full h-full object-cover" /> : league ? "🏒" : "👥"}
    </div>
  );
}

// Light theme = the whole slate scale flipped inside .chat-light (Tailwind utilities read these CSS variables),
// plus darker accent text colours and white text on solid accent fills.
const LIGHT_CSS = `
.chat-light{--color-slate-950:#ffffff;--color-slate-900:#f1f5f9;--color-slate-800:#e2e8f0;--color-slate-700:#cbd5e1;--color-slate-600:#94a3b8;--color-slate-500:#64748b;--color-slate-400:#475569;--color-slate-300:#334155;--color-slate-200:#1e293b;--color-slate-100:#0f172a;--color-slate-50:#020617;
--color-blue-400:#2563eb;--color-blue-300:#1d4ed8;--color-violet-300:#6d28d9;--color-violet-200:#5b21b6;--color-amber-300:#b45309;--color-amber-400:#b45309;--color-red-400:#dc2626;--color-red-300:#b91c1c;--surface:#f1f5f9;--surface-2:#e2e8f0;--border:#e2e8f0;--text:#0f172a;--text-2:#475569;--text-3:#64748b;color-scheme:light}
.chat-light .bg-blue-600,.chat-light .bg-blue-500,.chat-light .bg-red-500,.chat-light .bg-emerald-600{color:#fff}
.chat-light .bg-slate-600{color:#fff}
`;

export default function ChatApp() {
  const [boot, setBoot] = useState<Boot | null>(null);
  const [err, setErr] = useState("");
  const [active, setActive] = useState<number | null>(null); // roomId; null = list (mobile)
  const [pendingDm, setPendingDm] = useState<number | null>(null); // teamId of a DM with no room yet
  const [msgs, setMsgs] = useState<Record<number, Msg[]>>({});
  const [reads, setReads] = useState<Record<number, Record<number, number>>>({}); // roomId -> teamId -> lastReadId
  const [picker, setPicker] = useState(false);
  const [groupNew, setGroupNew] = useState(false);
  const [pinSig, setPinSig] = useState<{ roomId: number; n: number }>({ roomId: 0, n: 0 });
  const [openUnread, setOpenUnread] = useState<{ roomId: number; n: number; afterId: number }>({ roomId: 0, n: 0, afterId: 0 });
  const [settings, setSettings] = useState(false);
  const activeRef = useRef<number | null>(null);
  activeRef.current = active;
  const [prefs, setPrefsState] = useState<Prefs>(DEFAULT_PREFS);
  const pushApi = usePush(boot?.vapid ?? null);
  const [sysLight, setSysLight] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: light)"); setSysLight(mq.matches);
    const h = (e: MediaQueryListEvent) => setSysLight(e.matches);
    mq.addEventListener("change", h); return () => mq.removeEventListener("change", h);
  }, []);
  const light = prefs.theme === "light" || (prefs.theme === "auto" && sysLight);
  const prefsRef = useRef<Prefs>(DEFAULT_PREFS);
  const bootRef = useRef<Boot | null>(null);
  bootRef.current = boot;
  const msgsRef = useRef<Record<number, Msg[]>>({});
  msgsRef.current = msgs;
  const [banner, setBanner] = useState<{ roomId: number; title: string; text: string; team: TeamLite | null; kind: string } | null>(null);
  const bannerTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const setPrefs = (p: Prefs) => { prefsRef.current = p; setPrefsState(p); savePrefs(p); };
  useLayoutEffect(() => { const p = loadPrefs(); prefsRef.current = p; setPrefsState(p); }, []);
  useEffect(() => {
    const un = () => { unlockAudio(); window.removeEventListener("pointerdown", un); window.removeEventListener("keydown", un); };
    window.addEventListener("pointerdown", un); window.addEventListener("keydown", un);
    return () => { window.removeEventListener("pointerdown", un); window.removeEventListener("keydown", un); };
  }, []);

  const teamMap = useMemo(() => new Map((boot?.teams ?? []).map((t) => [t.id, t])), [boot]);

  const load = useCallback(async () => {
    const r = await fetch("/api/im/bootstrap");
    if (r.status === 401) { window.location.reload(); return; }
    if (!r.ok) { setErr(r.status === 403 ? "Chat nie je zapnutý." : "Chyba načítania."); return; }
    setBoot(await r.json());
  }, []);
  useEffect(() => { void load(); }, [load]);

  // PWA: swap in the chat manifest + register the push-capable service worker
  useEffect(() => {
    // Swap in the chat manifest ONLY for a standalone browser tab / the chat app itself.
    // If /chat was opened from a link inside the installed LEAGUE app window (standalone +
    // a same-site referrer), leave the league manifest alone — otherwise Chrome would
    // "update" the league app into the chat app.
    const standalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone;
    let fromSite = false;
    try { fromSite = !!document.referrer && new URL(document.referrer).origin === location.origin; } catch { /* ignore */ }
    if (!(standalone && fromSite)) {
      document.querySelectorAll('link[rel="manifest"]').forEach((l) => l.remove());
      const link = document.createElement("link");
      link.rel = "manifest"; link.href = "/chat/manifest.webmanifest";
      document.head.appendChild(link);
    }
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/chat-sw.js", { scope: "/chat" }).catch(() => {});
  }, []);

  const loadRoom = useCallback(async (roomId: number) => {
    const r = await fetch(`/api/im/messages?roomId=${roomId}`);
    if (!r.ok) return;
    const j = await r.json();
    setMsgs((m) => ({ ...m, [roomId]: j.messages }));
    setReads((p) => ({ ...p, [roomId]: j.reads ?? {} }));
  }, []);

  const markRead = useCallback((roomId: number, list: Msg[]) => {
    const last = list[list.length - 1]?.id;
    if (!last) return;
    void fetch("/api/im/read", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ roomId, lastReadId: last }) });
    setBoot((b) => b && { ...b, rooms: b.rooms.map((x) => (x.id === roomId ? { ...x, unread: 0, mentioned: false } : x)) });
  }, []);

  useEffect(() => {
    if (active == null) return;
    // remember how many were unread (and where) BEFORE the chat is marked read — for "Summarize what I missed"
    const r = bootRef.current?.rooms.find((x) => x.id === active);
    setOpenUnread({ roomId: active, n: r?.unread ?? 0, afterId: r?.lastReadId ?? 0 });
    void loadRoom(active);
  }, [active, loadRoom]);
  useEffect(() => {
    if (active != null && msgs[active] && attending()) markRead(active, msgs[active]);
  }, [active, msgs, markRead]);

  // live stream (auto-reconnect by EventSource; server recycles every ~55 s)
  const lastSeen = useRef(0);
  useEffect(() => {
    if (!boot) return;
    let es: EventSource | null = null, dead = false, lastBeat = Date.now();
    if (lastSeen.current === 0) lastSeen.current = boot.cursor;
    const handleMessages = (list: Msg[]) => {
        lastSeen.current = Math.max(lastSeen.current, ...list.map((m) => m.id));
        // live alert for messages from others: sound + in-app banner (not for muted chats / own / system lines)
        const b0 = bootRef.current;
        if (b0 && document.visibilityState === "visible") {
          const incoming = list.filter((m) => m.kind !== "system" && m.fromTeamId !== b0.me.id && (!roomMuted(b0.rooms.find((r) => r.id === m.roomId)) || m.mentions.includes(b0.me.id)));
          const m = incoming[incoming.length - 1];
          if (m) {
            const pr = prefsRef.current;
            playSound(pr.sound, pr.volume);
            if (pr.vibrate) navigator.vibrate?.(120);
            const viewing = activeRef.current === m.roomId && attending();
            if (pr.banner && !viewing) {
              const room = b0.rooms.find((r) => r.id === m.roomId);
              const from = b0.teams.find((t) => t.id === m.fromTeamId) ?? null;
              const title = room?.kind === "league" ? `${room.name || "# Liga"} · ${from?.code ?? ""}` : room?.kind === "group" ? `${room.name ?? "Skupina"} · ${from?.code ?? ""}` : from?.name ?? "GM";
              const text = m.voice ? "🎤 Hlasová správa" : m.body || (m.imageUrl ? (/\.gif|giphy/i.test(m.imageUrl) ? "GIF" : "📷 Fotka") : "");
              setBanner({ roomId: m.roomId, title, text, team: from, kind: room?.kind ?? "dm" });
              if (bannerTimer.current) clearTimeout(bannerTimer.current);
              bannerTimer.current = setTimeout(() => setBanner(null), 4500);
            }
          }
        }
        setMsgs((cur) => {
          const next = { ...cur };
          for (const m of list) {
            if (!next[m.roomId]) continue; // not loaded yet — fetched on open
            if (!next[m.roomId].some((x) => x.id === m.id)) next[m.roomId] = [...next[m.roomId], m];
          }
          return next;
        });
        let unknownRoom = false;
        setBoot((b) => {
          if (!b) return b;
          let rooms = b.rooms;
          for (const m of list) {
            const ex = rooms.find((r) => r.id === m.roomId);
            if (!ex) { unknownRoom = true; continue; }
            const mineMsg = m.fromTeamId === b.me.id || m.kind === "system";
            rooms = rooms.map((r) => r.id === m.roomId ? { ...r, mentioned: r.mentioned || (!mineMsg && !(activeRef.current === m.roomId && attending()) && (m.mentionAll || m.mentions.includes(b.me.id))), last: m, unread: mineMsg || (activeRef.current === m.roomId && attending()) ? r.unread : r.unread + 1 } : r);
          }
          return { ...b, rooms };
        });
        if (unknownRoom) void load();
    };
    // catch-up for anything missed while the stream was stalled / the app was asleep
    const catchUp = async () => {
      const r = await fetch(`/api/im/since?after=${lastSeen.current}`).catch(() => null);
      if (!r?.ok) return;
      const j = (await r.json()) as { messages: Msg[]; latest: number };
      if (j.messages.length) handleMessages(j.messages); else lastSeen.current = Math.max(lastSeen.current, j.latest);
    };
    const open = () => {
      if (dead) return;
      es = new EventSource(`/api/im/stream${lastSeen.current ? `?after=${lastSeen.current}` : ""}`);
      es.addEventListener("messages", (e) => { lastBeat = Date.now(); handleMessages(JSON.parse((e as MessageEvent).data) as Msg[]); });
      es.addEventListener("hello", () => { lastBeat = Date.now(); });
      es.addEventListener("hb", () => { lastBeat = Date.now(); });
      es.addEventListener("deleted", (e) => {
        const dl = JSON.parse((e as MessageEvent).data) as { id: number; roomId: number }[];
        setMsgs((cur) => {
          const next = { ...cur };
          for (const d of dl) if (next[d.roomId]) next[d.roomId] = next[d.roomId].map((m) => (m.id === d.id ? { ...m, deleted: true, body: "" } : m));
          return next;
        });
      });
      es.addEventListener("edited", (e) => {
        const list = JSON.parse((e as MessageEvent).data) as Msg[];
        setMsgs((cur) => {
          const next = { ...cur };
          for (const m of list) if (next[m.roomId]) next[m.roomId] = next[m.roomId].map((x) => (x.id === m.id ? { ...x, body: m.body, edited: true } : x));
          return next;
        });
        setBoot((b) => b && { ...b, rooms: b.rooms.map((r) => (r.last && list.some((m) => m.id === r.last!.id) ? { ...r, last: { ...r.last, body: list.find((m) => m.id === r.last!.id)!.body } } : r)) });
      });
      es.addEventListener("reacts", (e) => {
        const rs = JSON.parse((e as MessageEvent).data) as { messageId: number; roomId: number; reactions: Reaction[] }[];
        setMsgs((cur) => {
          const next = { ...cur };
          for (const r of rs) if (next[r.roomId]) next[r.roomId] = next[r.roomId].map((x) => (x.id === r.messageId ? { ...x, reactions: r.reactions } : x));
          return next;
        });
      });
      es.addEventListener("polls", (e) => {
        const ps = JSON.parse((e as MessageEvent).data) as { messageId: number; roomId: number; poll: Poll }[];
        setMsgs((cur) => {
          const next = { ...cur };
          for (const p of ps) if (next[p.roomId]) next[p.roomId] = next[p.roomId].map((x) => (x.id === p.messageId ? { ...x, poll: p.poll } : x));
          return next;
        });
      });
      es.addEventListener("pins", (e) => {
        const rs = JSON.parse((e as MessageEvent).data) as { roomId: number }[];
        setPinSig((p) => ({ roomId: rs[rs.length - 1].roomId, n: p.n + 1 }));
      });
      es.addEventListener("reads", (e) => {
        const rs = JSON.parse((e as MessageEvent).data) as { roomId: number; teamId: number; lastReadId: number }[];
        setReads((p) => { const n = { ...p }; rs.forEach((r) => (n[r.roomId] = { ...(n[r.roomId] ?? {}), [r.teamId]: r.lastReadId })); return n; });
      });
    };
    open();
    const reopen = () => { es?.close(); lastBeat = Date.now(); open(); void catchUp(); };
    // watchdog: a healthy stream beats every ~8 s; if it goes quiet (proxy buffering, sleeping tab, dropped Wi-Fi) reconnect + catch up
    const wd = setInterval(() => { if (document.visibilityState === "visible" && (Date.now() - lastBeat > 14000 || es?.readyState === 2)) reopen(); }, 5000);
    const onVis = () => { if (document.visibilityState === "visible") { onFocus(); reopen(); void load(); if (activeRef.current) void loadRoom(activeRef.current); } };
    const onOnline = () => reopen();
    const onFocus = () => { const a = activeRef.current; if (a != null && attending() && msgsRef.current[a]) markRead(a, msgsRef.current[a]); };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("online", onOnline);
    return () => { dead = true; es?.close(); clearInterval(wd); document.removeEventListener("visibilitychange", onVis); window.removeEventListener("online", onOnline); window.removeEventListener("focus", onFocus); };
  }, [boot?.me.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // app-icon badge with total unread
  const totalUnread = (boot?.rooms ?? []).reduce((s, r) => s + r.unread, 0);
  useEffect(() => {
    document.title = totalUnread ? `(${totalUnread}) UNHL Chat` : "UNHL Chat";
    const nav = navigator as Navigator & { setAppBadge?: (n: number) => Promise<void>; clearAppBadge?: () => Promise<void> };
    if (totalUnread) nav.setAppBadge?.(totalUnread).catch(() => {}); else nav.clearAppBadge?.().catch(() => {});
  }, [totalUnread]);

  // Back navigation like Viber: opening a thread adds a history entry, so the phone's back gesture/button
  // (iOS edge swipe, Android back, browser back) returns to the chat list instead of leaving the app.
  const threadPushed = useRef(false);
  useEffect(() => {
    const open = active != null || pendingDm != null;
    if (open && !threadPushed.current) { history.pushState({ chatThread: true }, ""); threadPushed.current = true; }
    if (!open && threadPushed.current) { threadPushed.current = false; if (history.state?.chatThread) history.back(); }
  }, [active, pendingDm]);
  useEffect(() => {
    const h = () => { threadPushed.current = false; setActive(null); setPendingDm(null); };
    window.addEventListener("popstate", h);
    return () => window.removeEventListener("popstate", h);
  }, []);
  const goBack = () => { if (threadPushed.current && history.state?.chatThread) history.back(); else { setActive(null); setPendingDm(null); } };
  const backSwipe = useRef<{ x: number; y: number; ok: boolean } | null>(null);

  // removed from / left the open group → back to the list
  useEffect(() => { if (boot && active != null && !boot.rooms.some((r) => r.id === active)) setActive(null); }, [boot, active]);

  if (err) return <div className="h-full flex items-center justify-center text-slate-400 p-6 text-center">{err}</div>;
  if (!boot) return <div className="h-full flex items-center justify-center text-slate-500">Načítavam…</div>;

  const sortedRooms = [...boot.rooms].sort((a, b) => {
    if (a.kind === "league" && b.kind !== "league") return -1;
    if (b.kind === "league" && a.kind !== "league") return 1;
    return (b.last?.id ?? 0) - (a.last?.id ?? 0);
  }).filter((r) => r.kind === "league" || r.last);

  const roomTitle = (r: Room) => (r.kind === "league" ? r.name || "# Liga" : r.kind === "group" ? r.name ?? "Skupina" : teamMap.get(r.otherTeamId ?? 0)?.name ?? "GM");
  const activeRoom = boot.rooms.find((r) => r.id === active) ?? null;
  const showThread = active != null || pendingDm != null;

  return (
    <div className={`chat-root h-full flex bg-slate-950 text-slate-100 ${light ? "chat-light" : ""}`} style={{ paddingTop: "env(safe-area-inset-top)", paddingBottom: "env(safe-area-inset-bottom)" }}>
      <style>{LIGHT_CSS}</style>
      {/* LEFT — conversation list */}
      <aside className={`${showThread ? "hidden md:flex" : "flex"} w-full md:w-[360px] md:border-r border-slate-800 flex-col min-h-0`}>
        <header className="flex items-center gap-3 px-4 py-3 border-b border-slate-800">
          <Logo t={boot.me} size={36} />
          <div className="flex-1 min-w-0">
            <div className="font-semibold leading-tight">UNHL Chat</div>
            <div className="text-xs text-slate-500 truncate">{boot.me.gmNickname ?? boot.me.name}</div>
          </div>
          <button onClick={() => setPicker(true)} aria-label="Nový chat" className="w-10 h-10 rounded-full bg-blue-600 hover:bg-blue-500 text-xl">＋</button>
          <button onClick={() => setPrefs({ ...prefs, theme: light ? "dark" : "light" })} aria-label="Svetlý / tmavý režim" title={light ? "Tmavý režim" : "Svetlý režim"} className="w-10 h-10 rounded-full bg-slate-800 hover:bg-slate-700">{light ? "🌙" : "☀️"}</button>
          <button onClick={() => setSettings(true)} aria-label="Nastavenia" className="w-10 h-10 rounded-full bg-slate-800 hover:bg-slate-700">⚙︎</button>
        </header>
        <InstallBanner />
        <PushBanner api={pushApi} />
        {!boot.enabled && <div className="bg-amber-500/10 text-amber-300 text-xs px-4 py-2">Chat je pre ostatných GM zatiaľ vypnutý (vidíš ho ako admin).</div>}
        <div className="flex-1 overflow-y-auto">
          {sortedRooms.map((r) => {
            const other = r.otherTeamId ? teamMap.get(r.otherTeamId) : null;
            const lastMine = r.last?.fromTeamId === boot.me.id;
            return (
              <button key={r.id} onClick={() => { setPendingDm(null); setActive(r.id); }}
                className={`w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-slate-900 ${active === r.id ? "bg-slate-900" : ""}`}>
                {r.kind === "dm" ? <Logo t={other} size={48} /> : <RoomIcon r={r} size={48} />}
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2">
                    <span className="font-medium truncate flex-1">{roomTitle(r)}</span>
                    {r.last && <span className="text-[11px] text-slate-500">{hm(r.last.at)}</span>}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-sm truncate flex-1 ${r.unread ? "text-slate-200" : "text-slate-500"}`}>
                      {r.last ? (r.last.deleted ? "🚫 Správa bola odstránená" : r.last.voice ? `${lastMine ? "Ty: " : ""}🎤 Hlasová správa` : r.last.poll ? `${lastMine ? "Ty: " : ""}📊 ${r.last.poll.question}` : !r.last.body && r.last.file ? `${lastMine ? "Ty: " : ""}📎 ${r.last.file.name}` : !r.last.body && r.last.imageUrl ? `${lastMine ? "Ty: " : ""}${/\.gif|giphy/i.test(r.last.imageUrl) ? "GIF" : "📷 Fotka"}` : `${lastMine ? "Ty: " : r.kind !== "dm" && r.last.kind !== "system" && r.last.kind !== "trade" ? `${teamMap.get(r.last.fromTeamId)?.code ?? ""}: ` : ""}${r.last.body}`) : "Ešte tu nikto nenapísal"}
                    </span>
                    {roomMuted(r) && <span className="text-xs text-slate-500" title="Stlmené">🔕</span>}
                    {r.mentioned && r.unread > 0 && <span className="min-w-5 h-5 px-1.5 rounded-full bg-amber-500 text-black text-[11px] font-bold flex items-center justify-center" title="Označili ťa">@</span>}
                    {r.unread > 0 && <span className={`min-w-5 h-5 px-1.5 rounded-full text-[11px] font-bold flex items-center justify-center ${roomMuted(r) ? "bg-slate-600" : "bg-blue-600"}`}>{r.unread}</span>}
                  </div>
                </div>
              </button>
            );
          })}
          {sortedRooms.length <= 1 && <p className="text-center text-slate-600 text-sm p-8">Klikni na ＋ a napíš niektorému GM.</p>}
        </div>
      </aside>

      {/* RIGHT — thread */}
      <section className={`${showThread ? "flex" : "hidden md:flex"} flex-1 min-w-0 min-h-0 flex-col`}
        onTouchStart={(e) => { const t = e.touches[0]; backSwipe.current = { x: t.clientX, y: t.clientY, ok: t.clientX >= 24 && !(e.target as HTMLElement).closest('.select-text,textarea,input,[role="slider"],em-emoji-picker,audio') }; }}
        onTouchEnd={(e) => {
          const b = backSwipe.current; backSwipe.current = null;
          if (!b?.ok || !showThread || window.innerWidth >= 768) return;
          const t = e.changedTouches[0];
          if (t.clientX - b.x > 80 && Math.abs(t.clientY - b.y) < 50) goBack(); // swipe right → back to the list
        }}>
        {showThread ? (
          <Thread
            key={active ?? `dm-${pendingDm}`}
            boot={boot} teamMap={teamMap}
            room={activeRoom} dmTeamId={activeRoom ? activeRoom.otherTeamId : pendingDm}
            messages={active != null ? msgs[active] ?? null : []}
            reads={active != null ? reads[active] ?? {} : {}}
            title={activeRoom ? roomTitle(activeRoom) : teamMap.get(pendingDm ?? 0)?.name ?? ""}
            onBack={goBack}
            pinTick={active != null && pinSig.roomId === active ? pinSig.n : 0}
            missed={active != null && openUnread.roomId === active ? openUnread : null}
            onReactions={(messageId, roomId, reactions) => setMsgs((c) => (c[roomId] ? { ...c, [roomId]: c[roomId].map((x) => (x.id === messageId ? { ...x, reactions } : x)) } : c))}
            onPollUpdate={(messageId, roomId, poll) => setMsgs((c) => (c[roomId] ? { ...c, [roomId]: c[roomId].map((x) => (x.id === messageId ? { ...x, poll } : x)) } : c))}
            onGroupChanged={async (left) => { await load(); if (left) setActive(null); }}
            onCleared={async (roomId) => { setMsgs((c) => { const n = { ...c }; delete n[roomId]; return n; }); setActive(null); await load(); }}
            onSent={async (roomId, m) => {
              if (active == null) { await load(); setPendingDm(null); setActive(roomId); setMsgs((c) => ({ ...c, [roomId]: [m] })); }
              else setMsgs((c) => (c[roomId]?.some((x) => x.id === m.id) ? c : { ...c, [roomId]: [...(c[roomId] ?? []), m] }));
              setBoot((b) => b && { ...b, rooms: b.rooms.map((r) => (r.id === roomId ? { ...r, last: m } : r)) });
            }}
          />
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-600 gap-2"><div className="text-5xl">💬</div><div>Vyber konverzáciu</div></div>
        )}
      </section>

      {picker && (
        <Sheet title="Nový chat" onClose={() => setPicker(false)}>
          <button onClick={() => { setPicker(false); setGroupNew(true); }} className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-slate-800 text-left">
            <div className="w-9 h-9 rounded-full bg-emerald-600/20 flex items-center justify-center">👥</div><span className="flex-1 font-medium">Nová skupina</span>
          </button>
          {boot.teams.filter((t) => t.id !== boot.me.id).map((t) => (
            <button key={t.id} onClick={() => {
              setPicker(false);
              const ex = boot.rooms.find((r) => r.otherTeamId === t.id);
              if (ex) { setPendingDm(null); setActive(ex.id); } else { setActive(null); setPendingDm(t.id); }
            }} className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-slate-800 text-left">
              <Logo t={t} size={36} /><span className="flex-1">{t.name}</span><span className="text-xs text-slate-500">{t.gmNickname}</span>
            </button>
          ))}
        </Sheet>
      )}
      {groupNew && <GroupCreate boot={boot} onClose={() => setGroupNew(false)} onCreated={async (roomId) => { setGroupNew(false); await load(); setPendingDm(null); setActive(roomId); }} />}
      {banner && (
        <button onClick={() => { setPendingDm(null); setActive(banner.roomId); setBanner(null); }}
          className="fixed top-3 left-1/2 -translate-x-1/2 z-40 w-[min(94vw,420px)] flex items-center gap-3 rounded-2xl bg-slate-800/95 backdrop-blur border border-slate-700 shadow-2xl px-4 py-3 text-left"
          style={{ marginTop: "env(safe-area-inset-top)" }}>
          {banner.kind === "dm" ? <Logo t={banner.team} size={40} /> : <div className="w-10 h-10 shrink-0 rounded-full bg-blue-600/20 flex items-center justify-center text-lg">{banner.kind === "league" ? "🏒" : "👥"}</div>}
          <div className="min-w-0 flex-1"><div className="text-sm font-semibold truncate">{banner.title}</div><div className="text-sm text-slate-300 truncate">{banner.text}</div></div>
          <span onClick={(e) => { e.stopPropagation(); setBanner(null); }} className="text-slate-500 px-1">✕</span>
        </button>
      )}
      {settings && <Settings boot={boot} teamMap={teamMap} onClose={() => setSettings(false)} reload={load} prefs={prefs} setPrefs={setPrefs} pushApi={pushApi} />}
    </div>
  );
}

function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-10 bg-black/60 flex items-end md:items-center justify-center" onClick={onClose}>
      <div className="w-full md:max-w-md max-h-[85%] bg-slate-900 rounded-t-3xl md:rounded-3xl flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center px-5 py-4 border-b border-slate-800"><h2 className="flex-1 font-semibold">{title}</h2><button onClick={onClose} className="text-slate-400 text-xl">✕</button></div>
        <div className="overflow-y-auto pb-4">{children}</div>
      </div>
    </div>
  );
}

function Thread(props: {
  boot: Boot; teamMap: Map<number, TeamLite>; room: Room | null; dmTeamId: number | null; messages: Msg[] | null;
  reads: Record<number, number>; title: string; onBack: () => void; onSent: (roomId: number, m: Msg) => void; onGroupChanged: (left: boolean) => Promise<void>; onCleared: (roomId: number) => Promise<void>;
  pinTick: number; onPollUpdate: (messageId: number, roomId: number, poll: Poll) => void; onReactions: (messageId: number, roomId: number, reactions: Reaction[]) => void; missed: { roomId: number; n: number; afterId: number } | null;
}) {
  const { boot, teamMap, room, dmTeamId, messages, reads, title, onBack, onSent, onGroupChanged, onCleared, pinTick, onPollUpdate, onReactions, missed } = props;
  const [sum, setSum] = useState<null | { state: "loading" } | { state: "done"; text: string; ai: boolean; note?: string } | { state: "hidden" }>(null);
  async function summarize() {
    if (!room || !missed) return;
    setSum({ state: "loading" });
    const r = await fetch("/api/im/summary", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ roomId: room.id, afterId: missed.afterId }) }).catch(() => null);
    if (!r?.ok) { setSum({ state: "done", text: "Zhrnutie sa nepodarilo načítať, skús znova.", ai: false }); return; }
    const j = await r.json();
    setSum({ state: "done", text: j.summary, ai: j.ai, note: j.note });
  }
  const [info, setInfo] = useState(false);
  const [tray, setTray] = useState<null | "emoji" | "gif">(null);
  const [editing, setEditing] = useState<Msg | null>(null);
  const [flash, setFlash] = useState<number | null>(null);
  const [zoom, setZoom] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const docRef = useRef<HTMLInputElement>(null);
  const look = room ? { bg: BACKGROUNDS[room.bg ?? "none"] ?? BACKGROUNDS.none, font: FONTS[room.font ?? "default"] ?? FONTS.default } : null;
  const [mq, setMq] = useState<{ start: number; query: string } | null>(null);
  const [mentionIds, setMentionIds] = useState<number[]>([]);
  const [mentionAll, setMentionAll] = useState(false);
  const [attach, setAttach] = useState(false);
  const [pending, setPending] = useState<File | null>(null);
  const [pendingUrl, setPendingUrl] = useState<string | null>(null);
  useEffect(() => { if (!pending || !pending.type.startsWith("image/")) { setPendingUrl(null); return; } const u = URL.createObjectURL(pending); setPendingUrl(u); return () => URL.revokeObjectURL(u); }, [pending]);
  const DOC_EXT = /\.(pdf|docx?|xlsx?|pptx?|csv|txt|zip)$/i;
  function takeFile(f: File | undefined | null) { if (f && (f.type.startsWith("image/") || DOC_EXT.test(f.name))) setPending(f); }
  const [pollNew, setPollNew] = useState(false);
  const [pins, setPins] = useState<Msg[]>([]);
  const [pinList, setPinList] = useState(false);
  const [rec, setRec] = useState<null | { secs: number; lvl: number }>(null);
  const recRef = useRef<Recorder | null>(null);
  async function beginRec() {
    setError(""); setTray(null);
    try {
      const r = await startRecording();
      recRef.current = r; setRec({ secs: 0, lvl: 0 });
    } catch { setError("Mikrofón sa nepodarilo zapnúť — povoľ prístup k mikrofónu v prehliadači/telefóne."); }
  }
  function cancelRec() { recRef.current?.cancel(); recRef.current = null; setRec(null); }
  async function finishRec() {
    const r = recRef.current; if (!r) return;
    recRef.current = null; setRec(null);
    const { blob, secs } = await r.stop();
    if (secs < 1 || blob.size < 2000) return;
    setUploading(true);
    const up = await uploadVoice(blob);
    setUploading(false);
    if ("error" in up) { setError(up.error); return; }
    await send(undefined, undefined, { url: up.url, secs });
  }
  useEffect(() => {
    if (!rec) return;
    const iv = setInterval(() => {
      const r = recRef.current; if (!r) return;
      const secs = r.elapsed();
      if (secs >= VOICE_MAX_SECS) { void finishRec(); return; }
      setRec({ secs, lvl: r.level() });
    }, 120);
    return () => clearInterval(iv);
  }, [!!rec]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => { recRef.current?.cancel(); }, []);
  const [text, setText] = useState("");
  const [reply, setReply] = useState<Msg | null>(null);
  const [menu, setMenu] = useState<Msg | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const endRef = useRef<HTMLDivElement>(null);
  const isLeague = room?.kind === "league";
  const isGroup = room?.kind === "group";
  const multi = isLeague || isGroup; // multi-party room: show sender names
  const other = dmTeamId ? teamMap.get(dmTeamId) : null;
  const canWrite = !(isLeague && boot.muted);

  useEffect(() => { endRef.current?.scrollIntoView({ block: "end" }); }, [messages?.length]);
  useEffect(() => {
    if (!room) { setPins([]); return; }
    void fetch(`/api/im/pins?roomId=${room.id}`).then((r) => r.ok ? r.json() : { pins: [] }).then((j) => setPins(j.pins));
  }, [room?.id, pinTick]); // eslint-disable-line react-hooks/exhaustive-deps
  const canPin = isLeague ? boot.admin : true;
  const pinPreview = (m: Msg) => (m.voice ? "🎤 Hlasová správa" : m.poll ? `📊 ${m.poll.question}` : m.file && !m.body ? `📎 ${m.file.name}` : m.imageUrl && !m.body ? "📷 Fotka / GIF" : m.body);
  async function pin(m: Msg, v: boolean) {
    setMenu(null);
    const r = await fetch("/api/im/pin", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: m.id, pinned: v }) });
    if (!r.ok) setError(r.status === 400 ? "Pripnúť sa dá najviac 10 správ." : "Pripnúť môže len komisár (ligový kanál).");
  }
  const [moreReact, setMoreReact] = useState(false);
  const [infoMsg, setInfoMsg] = useState<Msg | null>(null);
  async function react(m: Msg, emoji: string) {
    setMenu(null); setMoreReact(false);
    const r = await fetch("/api/im/react", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: m.id, emoji }) });
    if (r.ok) { const j = await r.json(); onReactions(m.id, m.roomId, j.reactions); }
  }
  async function vote(m: Msg, optionId: number) {
    const r = await fetch("/api/im/poll/vote", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ pollId: m.poll!.id, optionId }) });
    if (r.ok) { const j = await r.json(); if (j.poll) onPollUpdate(m.id, m.roomId, j.poll); }
  }
  async function closePoll(m: Msg) {
    if (!confirm("Uzavrieť anketu? Hlasovať už nepôjde.")) return;
    const r = await fetch("/api/im/poll/vote", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ pollId: m.poll!.id, close: true }) });
    if (r.ok) { const j = await r.json(); if (j.poll) onPollUpdate(m.id, m.roomId, j.poll); }
  }

  // who must have read a message of mine: the peer (DM) or every other current member (group)
  const audience: number[] = isGroup ? room!.members.filter((id) => id !== boot.me.id) : dmTeamId ? [dmTeamId] : [];
  const readBy = (m: Msg) => audience.filter((t) => (reads[t] ?? 0) >= m.id);
  const allRead = (m: Msg) => audience.length > 0 && readBy(m).length === audience.length;

  async function send(imageUrl?: string, file?: FileAtt, voice?: { url: string; secs: number }) {
    const body = imageUrl || file || voice ? "" : emoticonize(text.trim());
    if ((!body && !imageUrl && !file && !voice) || sending) return;
    setSending(true); setError("");
    if (editing) {
      const er = await fetch("/api/im/edit", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: editing.id, body }) });
      setSending(false);
      if (!er.ok) { setError(er.status === 400 ? "Správu už nejde upraviť (starsia ako 48 h)." : "Úprava zlyhala."); return; }
      setEditing(null); setText("");
      return;
    }
    const r = await fetch("/api/im/send", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...(room ? { roomId: room.id } : { toTeamId: dmTeamId }), body, imageUrl, file, voice, replyToId: reply?.id, mentions: mentionIds.filter((id) => body.toLowerCase().includes(`@${handleOf(teamMap.get(id)).toLowerCase()}`)), mentionAll: mentionAll && /@(všetci|vsetci|all|everyone)\b/i.test(body) }),
    });
    setSending(false);
    if (!r.ok) { setError(r.status === 403 ? "Nemáš oprávnenie písať." : "Nepodarilo sa odoslať."); return; }
    const j = await r.json();
    if (!imageUrl && !file && !voice) { setText(""); setMentionIds([]); setMentionAll(false); setMq(null); }
    setReply(null); setTray(null);
    onSent(j.roomId, j.message);
  }

  async function sendFile(f: File) {
    setUploading(true); setError("");
    const up = await uploadImage(await prepareImage(f, { max: 1600 }));
    setUploading(false);
    if ("error" in up) { setError(up.error); return; }
    await send(up.url);
  }

  async function sendDoc(f: File) {
    setUploading(true); setError("");
    const up = await uploadFile(f);
    setUploading(false);
    if ("error" in up) { setError(up.error); return; }
    await send(undefined, up);
  }
  async function createPoll(question: string, options: string[], multi: boolean) {
    const r = await fetch("/api/im/poll", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...(room ? { roomId: room.id } : { toTeamId: dmTeamId }), question, options, multi }) });
    if (!r.ok) return false;
    const j = await r.json(); onSent(j.roomId, j.message); return true;
  }
  const renderBody = (m: Msg): React.ReactNode =>
    emoticonize(m.body).split(/(@[\p{L}\p{N}_.\-]+)/gu).map((part, i) => {
      if (!part.startsWith("@")) return <Fragment key={i}>{linkify(part)}</Fragment>;
      const tag = part.slice(1).toLowerCase();
      const hit = (ALL_TAGS.includes(tag) && m.mentionAll) || m.mentions.some((id) => { const t = teamMap.get(id); return handleOf(t).toLowerCase() === tag || t?.code?.toLowerCase() === tag; });
      return hit ? <span key={i} className="font-semibold rounded px-1 bg-amber-400/25 text-amber-200">{part}</span> : <Fragment key={i}>{part}</Fragment>;
    });
  const mentionsMe = (m: Msg) => m.fromTeamId !== boot.me.id && (m.mentionAll || m.mentions.includes(boot.me.id));
  // @mentions — people who can be tagged in this chat (+ @všetci in group / league)
  const taggable: TeamLite[] = (isLeague ? boot.teams : isGroup ? room!.members.map((id) => teamMap.get(id)).filter((t): t is TeamLite => !!t) : other ? [other] : []).filter((t) => t.id !== boot.me.id);
  const mqList = mq ? taggable.filter((t) => { const q = mq.query.toLowerCase(); return !q || [t.gmNickname, t.name, t.code].some((x) => x?.toLowerCase().includes(q)); }).slice(0, 6) : [];
  const showAllOpt = !!mq && multi && (!mq.query || "všetci".startsWith(mq.query.toLowerCase()) || "all".startsWith(mq.query.toLowerCase()));
  function detectMention(value: string, caret: number) {
    const m = /(^|\s)@([^\s@]*)$/.exec(value.slice(0, caret));
    setMq(m ? { start: caret - m[2].length - 1, query: m[2] } : null);
  }
  function pickMention(t: TeamLite | "all") {
    if (!mq) return;
    const ta = taRef.current, caret = ta?.selectionStart ?? text.length;
    const tag = t === "all" ? "@všetci " : `@${handleOf(t)} `;
    setText(text.slice(0, mq.start) + tag + text.slice(caret));
    if (t === "all") setMentionAll(true); else setMentionIds((ids) => (ids.includes(t.id) ? ids : [...ids, t.id]));
    setMq(null);
    requestAnimationFrame(() => { ta?.focus(); const pos = mq.start + tag.length; ta?.setSelectionRange(pos, pos); });
  }
  function startEdit(m: Msg) { setMenu(null); setReply(null); setEditing(m); setText(m.body); setTray(null); requestAnimationFrame(() => taRef.current?.focus()); }
  function cancelEdit() { setEditing(null); setText(""); }
  function jumpTo(id: number) {
    const el = document.getElementById(`msg-${id}`);
    if (!el) return;
    el.scrollIntoView({ block: "center", behavior: "smooth" });
    setFlash(id); setTimeout(() => setFlash(null), 1400);
  }
  const swipe = useRef<{ x: number; y: number; id: number } | null>(null);

  function insertEmoji(e: string) {
    const ta = taRef.current;
    if (!ta) { setText((t) => t + e); return; }
    const a = ta.selectionStart ?? text.length, b = ta.selectionEnd ?? text.length;
    setText(text.slice(0, a) + e + text.slice(b));
    requestAnimationFrame(() => { ta.focus(); ta.setSelectionRange(a + e.length, a + e.length); });
  }

  async function del(m: Msg) {
    setMenu(null);
    await fetch("/api/im/delete", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: m.id }) });
  }

  let lastDay = "";
  return (
    <>
      <header className="flex items-center gap-3 px-3 py-3 border-b border-slate-800">
        <button onClick={onBack} className="md:hidden w-10 h-10 text-2xl text-slate-300" aria-label="Späť">‹</button>
        <button onClick={() => room && setInfo(true)} className={`flex items-center gap-3 min-w-0 flex-1 text-left ${room ? "" : "cursor-default"}`}>
          {room && room.kind !== "dm" ? <RoomIcon r={room} size={40} /> : <Logo t={other} size={40} />}
          <div className="min-w-0"><div className="font-semibold truncate" style={{ fontFamily: look?.font.title || undefined, fontSize: look?.font.title ? "1.1rem" : undefined }}>{title}</div><div className="text-xs text-slate-500 truncate">{isLeague ? "Verejný kanál celej ligy" : isGroup ? `${room!.members.length} členov · ${room!.members.map((id) => teamMap.get(id)?.code).filter(Boolean).join(", ")}` : other?.gmNickname ?? "Súkromná konverzácia"}</div></div>
        </button>
        {room && <button onClick={() => setInfo(true)} aria-label="Informácie" className="w-10 h-10 rounded-full text-xl text-blue-400 hover:bg-slate-800">ⓘ</button>}
      </header>
      {pins.length > 0 && (
        <div className="flex items-center gap-2 px-4 py-2 bg-slate-900 border-b border-slate-800 text-sm">
          <button onClick={() => { if (document.getElementById(`msg-${pins[0].id}`)) jumpTo(pins[0].id); else setPinList(true); }} className="flex-1 min-w-0 flex items-center gap-2 text-left">
            <span>📌</span>
            <span className="min-w-0 flex-1"><span className="block text-[11px] text-blue-300">Pripnuté{pins.length > 1 ? ` · ${pins.length}` : ""}</span><span className="block truncate text-slate-300">{pinPreview(pins[0])}</span></span>
          </button>
          {pins.length > 1 || canPin ? <button onClick={() => setPinList(true)} aria-label="Všetky pripnuté" className="w-8 h-8 text-slate-400">▾</button> : null}
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-1 bg-slate-950" style={{ backgroundImage: look?.bg.css || undefined, backgroundAttachment: "local", fontFamily: look?.font.body || undefined }} onDragOver={(e) => { if (e.dataTransfer.types.includes("Files")) e.preventDefault(); }} onDrop={(e) => { const f = e.dataTransfer.files?.[0]; if (f) { e.preventDefault(); takeFile(f); } }}>
        {missed && missed.n >= 8 && sum?.state !== "hidden" && (
          <div className="sticky top-0 z-[5] mb-2">
            {sum?.state === "done" ? (
              <div className="rounded-2xl bg-slate-900/95 backdrop-blur border border-violet-500/40 p-4 shadow-xl">
                <div className="flex items-center gap-2 mb-2"><span className="text-sm font-semibold text-violet-300">✨ {sum.ai ? "AI zhrnutie" : "Prehľad"} zmeškaných správ</span><button onClick={() => setSum({ state: "hidden" })} aria-label="Zavrieť" className="ml-auto text-slate-400">✕</button></div>
                <div className="text-sm text-slate-200 whitespace-pre-wrap leading-relaxed">{sum.text}</div>
                {sum.note && <div className="mt-2 text-[11px] text-slate-500">{sum.note}</div>}
                {sum.ai && <div className="mt-2 text-[11px] text-slate-600">Vytvorené AI, môže obsahovať chyby. Dôležité si over v správach.</div>}
              </div>
            ) : (
              <button onClick={summarize} disabled={sum?.state === "loading"} className="w-full flex items-center gap-3 rounded-2xl bg-violet-600/20 hover:bg-violet-600/30 border border-violet-500/40 px-4 py-3 text-left disabled:opacity-70">
                <span className="text-xl">✨</span>
                <span className="flex-1 min-w-0"><span className="block text-sm font-semibold text-violet-200">{sum?.state === "loading" ? "Zhŕňam…" : `Zhrnúť ${missed.n} neprečítaných správ`}</span><span className="block text-xs text-slate-400">Čo sa riešilo, kým si tu nebol</span></span>
              </button>
            )}
          </div>
        )}
        {messages == null && <p className="text-center text-slate-600 text-sm py-6">Načítavam…</p>}
        {messages?.length === 0 && <p className="text-center text-slate-600 text-sm py-10">Napíš prvú správu 👋</p>}
        {messages?.map((m, i) => {
          const mine = m.fromTeamId === boot.me.id;
          const t = teamMap.get(m.fromTeamId);
          const day = dayLabel(m.at);
          const showDay = day !== lastDay; lastDay = day;
          const prev = messages[i - 1];
          const showName = multi && !mine && m.kind !== "system" && (!prev || prev.fromTeamId !== m.fromTeamId || prev.kind === "system" || showDay);
          return (
            <div key={m.id}>
              {showDay && <div className="text-center my-3"><span className="text-[11px] text-slate-400 bg-slate-800/70 rounded-full px-3 py-1">{day}</span></div>}
              {m.kind === "trade" ? (
                <div id={`msg-${m.id}`} onDoubleClick={() => { window.getSelection()?.removeAllRanges(); setMenu(m); }} onContextMenu={(e) => { e.preventDefault(); setMenu(m); }}
                  onClick={() => { if (!window.getSelection()?.toString() && window.matchMedia("(pointer: coarse)").matches) setMenu(m); }}
                  className={`my-3 mx-auto w-full sm:w-[480px] max-w-full select-text cursor-pointer rounded-2xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 transition-colors duration-500 ${flash === m.id ? "ring-2 ring-blue-500" : ""}`}>
                  <div className="whitespace-pre-wrap break-words text-sm leading-relaxed">{linkify(m.body)}</div>
                  {m.reactions.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {m.reactions.map((rc) => (
                        <span key={rc.emoji} onClick={(e) => { e.stopPropagation(); void react(m, rc.emoji); }} title={rc.teams.map((id) => teamMap.get(id)?.code).filter(Boolean).join(", ")}
                          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs cursor-pointer ${rc.teams.includes(boot.me.id) ? "bg-amber-500/30 ring-1 ring-amber-400" : "bg-black/20"}`}>
                          <span className="text-sm leading-none">{rc.emoji}</span>{rc.teams.length > 1 && <span className="opacity-80">{rc.teams.length}</span>}
                        </span>
                      ))}
                    </div>
                  )}
                  <div className="text-[10px] opacity-60 text-right mt-1">{hm(m.at)}</div>
                </div>
              ) : m.kind === "system" ? (
                <div className="text-center my-2"><span className="text-[11px] text-slate-400 bg-slate-800/60 rounded-full px-3 py-1 inline-block max-w-[90%]">{m.body}</span></div>
              ) : (
              <div id={`msg-${m.id}`} className={`group flex gap-2 items-center rounded-xl transition-colors duration-500 ${flash === m.id ? "bg-blue-500/20" : ""} ${mine ? "justify-end" : "justify-start"}`}
                onTouchStart={(e) => { swipe.current = (e.target as HTMLElement).closest(".select-text") ? { x: e.touches[0].clientX, y: e.touches[0].clientY, id: m.id } : null; }}
                onTouchEnd={(e) => { const s0 = swipe.current; swipe.current = null; if (!s0 || m.deleted) return; const dx = e.changedTouches[0].clientX - s0.x, dy = Math.abs(e.changedTouches[0].clientY - s0.y); if (dx > 70 && dy < 40) { setReply(m); setEditing(null); taRef.current?.focus(); } }}>
                {multi && !mine && (showName ? <Logo t={t} size={28} /> : <div className="w-7 shrink-0" />)}
                <div role="button" tabIndex={0} onClick={() => { if (m.deleted || window.getSelection()?.toString()) return; if (window.matchMedia("(pointer: coarse)").matches) setMenu(m); }}
                  onDoubleClick={() => { if (m.deleted) return; window.getSelection()?.removeAllRanges(); setMenu(m); }}
                  onContextMenu={(e) => { if (m.deleted) return; e.preventDefault(); setMenu(m); }}
                  onKeyDown={(e) => { if (e.key === "Enter" && e.target === e.currentTarget && !m.deleted) setMenu(m); }}
                  className={`max-w-[80%] text-left select-text cursor-pointer rounded-2xl px-3 py-2 ${mine ? "bg-blue-600 text-white rounded-br-md" : "bg-slate-800 rounded-bl-md"} ${mentionsMe(m) ? "ring-2 ring-amber-400/70" : ""} ${m.deleted ? "opacity-60 italic" : ""}`}>
                  {showName && <div className="text-[11px] font-semibold text-blue-300 mb-0.5">{t?.gmNickname ?? t?.code ?? "GM"} · {t?.code}</div>}
                  {m.replyTo && !m.deleted && (
                    <div onClick={(e) => { e.stopPropagation(); jumpTo(m.replyTo!.id); }} className="border-l-2 border-white/40 pl-2 mb-1 text-xs opacity-80 cursor-pointer">
                      <div className="font-semibold">{m.replyTo.fromTeamId === boot.me.id ? "Ty" : teamMap.get(m.replyTo.fromTeamId)?.code}</div>
                      <div className="line-clamp-2">{m.replyTo.body || "📷"}</div>
                    </div>
                  )}
                  {m.imageUrl && !m.deleted && (
                    <img src={m.imageUrl} alt="" loading="lazy" onClick={(e) => { e.stopPropagation(); setZoom(m.imageUrl); }}
                      className="rounded-xl max-h-72 max-w-full object-cover mb-1 cursor-zoom-in bg-slate-900/40" />
                  )}
                  {m.voice && !m.deleted && <VoicePlayer url={m.voice.url} secs={m.voice.secs} />}
                  {m.file && !m.deleted && (
                    <a href={m.file.url} target="_blank" rel="noopener noreferrer" download={m.file.name} onClick={(e) => e.stopPropagation()}
                      className="flex items-center gap-3 rounded-xl bg-black/20 hover:bg-black/30 px-3 py-2.5 mb-1 min-w-[200px]">
                      <span className="text-3xl">{fileIcon(m.file.name)}</span>
                      <span className="min-w-0 flex-1"><span className="block text-sm font-medium truncate">{m.file.name}</span><span className="block text-[11px] opacity-70">{fmtSize(m.file.size)} · ⬇︎ Stiahnuť</span></span>
                    </a>
                  )}
                  {m.poll && !m.deleted && <PollCard m={m} me={boot.me.id} teamMap={teamMap} onVote={(oid) => void vote(m, oid)} onClose={() => void closePoll(m)} />}
                  {(m.deleted || (m.body && !m.poll)) && <div className={`whitespace-pre-wrap break-words ${!m.deleted && isBigEmoji(emoticonize(m.body)) ? "text-5xl leading-tight" : "text-[15px]"}`}>{m.deleted ? "🚫 Správa bola odstránená" : renderBody(m)}</div>}
                  {m.reactions.length > 0 && !m.deleted && (
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {m.reactions.map((rc) => {
                        const mineR = rc.teams.includes(boot.me.id);
                        return (
                          <span key={rc.emoji} onClick={(e) => { e.stopPropagation(); void react(m, rc.emoji); }} title={rc.teams.map((id) => teamMap.get(id)?.code).filter(Boolean).join(", ")}
                            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs cursor-pointer ${mineR ? "bg-white/30 ring-1 ring-white/60" : "bg-black/20"}`}>
                            <span className="text-sm leading-none">{rc.emoji}</span>{rc.teams.length > 1 && <span className="opacity-80">{rc.teams.length}</span>}
                          </span>
                        );
                      })}
                    </div>
                  )}
                  <div className="text-[10px] opacity-60 text-right mt-0.5">
                    {m.edited && !m.deleted && <span>upravené · </span>}{hm(m.at)}{mine && !isLeague && !m.deleted && <span className={allRead(m) ? "text-sky-300 opacity-100" : ""}> {allRead(m) ? "✓✓" : "✓"}</span>}
                  </div>
                </div>
                {!m.deleted && <button onClick={() => void react(m, "❤️")} aria-label="Páči sa mi" className={`shrink-0 w-7 h-7 rounded-full text-sm hover:bg-slate-800 opacity-40 group-hover:opacity-100 ${mine ? "order-first" : ""}`}>{m.reactions.some((rc) => rc.emoji === "❤️" && rc.teams.includes(boot.me.id)) ? "❤️" : "🤍"}</button>}
                {!m.deleted && <button onClick={() => { setReply(m); setEditing(null); taRef.current?.focus(); }} aria-label="Odpovedať" className={`shrink-0 w-7 h-7 rounded-full text-sm text-slate-500 hover:text-white hover:bg-slate-800 opacity-40 group-hover:opacity-100 ${mine ? "order-first" : ""}`}>↩︎</button>}
              </div>
              )}
            </div>
          );
        })}
        <div ref={endRef} />
      </div>

      {error && <div className="bg-red-500/10 text-red-300 text-sm px-4 py-2">{error}</div>}
      {editing && (
        <div className="flex items-center gap-2 px-4 py-2 bg-slate-900 border-t border-slate-800 text-sm">
          <div className="flex-1 min-w-0 border-l-2 border-amber-500 pl-2"><div className="text-xs text-amber-300">Úprava správy</div><div className="truncate text-slate-400">{editing.body}</div></div>
          <button onClick={cancelEdit} className="text-slate-400">✕</button>
        </div>
      )}
      {reply && (
        <div className="flex items-center gap-2 px-4 py-2 bg-slate-900 border-t border-slate-800 text-sm">
          <div className="flex-1 min-w-0 border-l-2 border-blue-500 pl-2"><div className="text-xs text-blue-300">Odpoveď</div><div className="truncate text-slate-400">{reply.body}</div></div>
          <button onClick={() => setReply(null)} className="text-slate-400">✕</button>
        </div>
      )}
      {canWrite ? (
        <div className="border-t border-slate-800 bg-slate-900">
          {mq && (mqList.length > 0 || showAllOpt) && (
            <div className="mx-3 mt-2 rounded-xl border border-slate-700 bg-slate-900 shadow-xl overflow-hidden">
              {showAllOpt && <button onMouseDown={(e) => e.preventDefault()} onClick={() => pickMention("all")} className="w-full flex items-center gap-3 px-4 py-2 hover:bg-slate-800 text-left"><span className="w-8 h-8 rounded-full bg-amber-500 text-black flex items-center justify-center font-bold">@</span><span className="text-sm">@všetci <span className="text-slate-500">· označiť všetkých</span></span></button>}
              {mqList.map((t) => (
                <button key={t.id} onMouseDown={(e) => e.preventDefault()} onClick={() => pickMention(t)} className="w-full flex items-center gap-3 px-4 py-2 hover:bg-slate-800 text-left">
                  <Logo t={t} size={32} /><span className="flex-1 min-w-0 text-sm truncate">{t.gmNickname ?? t.code} <span className="text-slate-500">· {t.name}</span></span>
                </button>
              ))}
            </div>
          )}
          {uploading && <div className="px-4 pt-2 text-xs text-slate-400">Nahrávam obrázok…</div>}
          {rec ? (
            <div className="flex items-center gap-3 p-3">
              <button onClick={cancelRec} aria-label="Zrušiť" className="w-11 h-11 rounded-full bg-slate-800 text-lg text-red-400">🗑</button>
              <div className="flex-1 flex items-center gap-3 rounded-2xl bg-slate-800 px-4 h-11">
                <span className="w-3 h-3 rounded-full bg-red-500 animate-pulse" />
                <span className="text-sm tabular-nums">{fmtSecs(rec.secs)}</span>
                <div className="flex-1 h-1.5 rounded-full bg-slate-700 overflow-hidden"><div className="h-full bg-red-400 transition-all" style={{ width: `${Math.min(100, rec.lvl * 160)}%` }} /></div>
                <span className="text-[11px] text-slate-500">max {fmtSecs(VOICE_MAX_SECS)}</span>
              </div>
              <button onClick={() => void finishRec()} aria-label="Odoslať hlasovú správu" className="w-11 h-11 rounded-full bg-blue-600 text-lg">➤</button>
            </div>
          ) : (
          <div className="flex items-end gap-1.5 p-3">
            <button onClick={() => setTray(tray === "emoji" ? null : "emoji")} aria-label="Emoji" className={`w-10 h-11 text-2xl ${tray === "emoji" ? "text-blue-400" : "text-slate-400"}`}>☺︎</button>
            <button onClick={() => { setTray(null); setAttach(true); }} aria-label="Pripojiť" className="w-9 h-11 text-2xl text-slate-400">＋</button>
            {<button onClick={() => setTray(tray === "gif" ? null : "gif")} aria-label="GIF" className={`h-11 px-1.5 text-xs font-bold ${tray === "gif" ? "text-blue-400" : "text-slate-400"}`}>GIF</button>}
            <input ref={docRef} type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.csv,.txt,.zip" className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) void sendDoc(f); }} />
            <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif" className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; e.target.accept = "image/png,image/jpeg,image/webp,image/gif"; if (f) void sendFile(f); }} />
            <textarea ref={taRef} value={text} onChange={(e) => { setText(e.target.value); detectMention(e.target.value, e.target.selectionStart); }} rows={1} maxLength={2000} placeholder="Správa" onFocus={() => setTray(null)}
              onPaste={(e) => { const f = [...e.clipboardData.files][0]; if (f) { e.preventDefault(); takeFile(f); } }}
              onKeyDown={(e) => { if (mq && (e.key === "Enter" || e.key === "Tab") && (mqList[0] || showAllOpt)) { e.preventDefault(); pickMention(mqList[0] ?? "all"); return; } if (e.key === "Escape" && mq) { setMq(null); return; } if (e.key === "Enter" && !e.shiftKey && window.matchMedia("(pointer:fine)").matches) { e.preventDefault(); void send(); } }}
              className="flex-1 min-w-0 resize-none max-h-32 rounded-2xl bg-slate-800 px-4 py-2.5 text-base outline-none" />
            {text.trim() || editing
              ? <button onClick={() => send()} disabled={!text.trim() || sending} className="w-11 h-11 rounded-full bg-blue-600 disabled:opacity-40 text-lg" aria-label="Odoslať">➤</button>
              : <button onClick={() => void beginRec()} disabled={sending || uploading} className="w-11 h-11 rounded-full bg-blue-600 disabled:opacity-40 text-lg" aria-label="Nahrať hlasovú správu">🎤</button>}
          </div>
          )}
          {tray === "emoji" && <div className="border-t border-slate-800"><EmojiPicker onPick={insertEmoji} /></div>}
          {tray === "gif" && <div className="border-t border-slate-800 pt-2 max-h-[240px] overflow-y-auto"><GifPicker search={boot.gif} roomId={room?.id ?? null} onPick={(u) => void send(u)} onUpload={() => { if (fileRef.current) { fileRef.current.accept = "image/gif"; fileRef.current.click(); } }} /></div>}
        </div>
      ) : <div className="p-4 text-center text-sm text-amber-300 bg-slate-900 border-t border-slate-800">Komisár ti dočasne zakázal písať do ligového kanála.</div>}

      {pending && (
        <Sheet title="Odoslať súbor?" onClose={() => setPending(null)}>
          <div className="px-5 py-3">
            {pendingUrl ? <img src={pendingUrl} alt="" className="max-h-72 w-full object-contain rounded-xl bg-slate-800" /> : <div className="flex items-center gap-3 rounded-xl bg-slate-800 px-4 py-3"><span className="text-3xl">{fileIcon(pending.name)}</span><span className="min-w-0 flex-1"><span className="block text-sm truncate">{pending.name}</span><span className="block text-xs text-slate-500">{fmtSize(pending.size)}</span></span></div>}
          </div>
          <div className="px-5 pb-2 flex gap-2">
            <button onClick={() => setPending(null)} className="flex-1 rounded-xl bg-slate-800 py-3">Zrušiť</button>
            <button onClick={() => { const f = pending; setPending(null); void (f.type.startsWith("image/") ? sendFile(f) : sendDoc(f)); }} className="flex-1 rounded-xl bg-blue-600 text-white py-3 font-medium">Odoslať</button>
          </div>
        </Sheet>
      )}
      {attach && (
        <Sheet title="Pripojiť" onClose={() => setAttach(false)}>
          <button onClick={() => { setAttach(false); if (fileRef.current) fileRef.current.accept = "image/png,image/jpeg,image/webp,image/gif"; fileRef.current?.click(); }} className="w-full text-left px-5 py-3.5 hover:bg-slate-800 flex gap-3"><span>🖼</span>Fotka alebo GIF zo zariadenia</button>
          <button onClick={() => { setAttach(false); docRef.current?.click(); }} className="w-full text-left px-5 py-3.5 hover:bg-slate-800 flex gap-3"><span>📎</span>Súbor (PDF, Word, Excel, CSV, ZIP…)</button>
          <button onClick={() => { setAttach(false); setPollNew(true); }} className="w-full text-left px-5 py-3.5 hover:bg-slate-800 flex gap-3"><span>📊</span>Anketa</button>
        </Sheet>
      )}
      {infoMsg && (() => {
        const m = infoMsg;
        const mineMsg = m.fromTeamId === boot.me.id;
        const everyone = isLeague ? boot.teams.map((t) => t.id).filter((id) => id !== m.fromTeamId) : isGroup ? room!.members.filter((id) => id !== m.fromTeamId) : dmTeamId ? [dmTeamId, boot.me.id].filter((id) => id !== m.fromTeamId) : [];
        const seen = everyone.filter((id) => id === boot.me.id || (reads[id] ?? 0) >= m.id);
        const unseen = everyone.filter((id) => !seen.includes(id));
        const nm = (id: number) => { const t = teamMap.get(id); return id === boot.me.id ? "Ty" : `${t?.name ?? "GM"}${t?.gmNickname ? ` · ${t.gmNickname}` : ""}`; };
        const Row = ({ id, extra }: { id: number; extra?: string }) => <div className="px-5 py-1.5 flex items-center gap-3"><Logo t={teamMap.get(id)} size={32} /><span className="flex-1 text-sm truncate">{nm(id)}</span>{extra && <span className="text-xl">{extra}</span>}</div>;
        return (
          <Sheet title="Informácie o správe" onClose={() => setInfoMsg(null)}>
            <div className="px-5 pb-2 text-sm text-slate-400 line-clamp-2">{pinPreview(m) || "Správa"}</div>
            <div className="px-5 pt-2 pb-1 text-xs text-slate-500">Odoslal: {nm(m.fromTeamId)} · {new Date(m.at).toLocaleString("sk-SK", { day: "numeric", month: "numeric", hour: "2-digit", minute: "2-digit" })}</div>
            <div className="px-5 pt-3 pb-1 text-xs uppercase tracking-wide text-slate-500">Reakcie ({m.reactions.reduce((n, r) => n + r.teams.length, 0)})</div>
            {m.reactions.length === 0 && <p className="px-5 pb-2 text-sm text-slate-600">Zatiaľ žiadne reakcie</p>}
            {m.reactions.flatMap((r) => r.teams.map((id) => <Row key={`${r.emoji}-${id}`} id={id} extra={r.emoji} />))}
            {mineMsg && (
              <>
                <div className="px-5 pt-3 pb-1 text-xs uppercase tracking-wide text-sky-300">✓✓ Prečítali ({seen.filter((id) => id !== boot.me.id).length})</div>
                {seen.filter((id) => id !== boot.me.id).length === 0 && <p className="px-5 pb-2 text-sm text-slate-600">Zatiaľ nikto</p>}
                {seen.filter((id) => id !== boot.me.id).map((id) => <Row key={id} id={id} />)}
                {unseen.length > 0 && <div className="px-5 pt-3 pb-1 text-xs uppercase tracking-wide text-slate-500">✓ Ešte nečítali ({unseen.length})</div>}
                {unseen.map((id) => <Row key={id} id={id} />)}
              </>
            )}
          </Sheet>
        );
      })()}
      {pollNew && <PollCreate onClose={() => setPollNew(false)} onCreate={createPoll} />}
      {pinList && (
        <Sheet title={`Pripnuté správy (${pins.length})`} onClose={() => setPinList(false)}>
          {pins.map((p) => (
            <div key={p.id} className="px-5 py-3 flex items-center gap-3 border-b border-slate-800/60">
              <button onClick={() => { setPinList(false); jumpTo(p.id); }} className="flex-1 min-w-0 text-left">
                <div className="text-[11px] text-slate-500">{teamMap.get(p.fromTeamId)?.code} · {hm(p.at)}</div>
                <div className="text-sm truncate">{pinPreview(p)}</div>
              </button>
              {canPin && <button onClick={() => void pin(p, false)} className="text-xs rounded-lg bg-slate-800 px-3 py-1.5 text-slate-300">Odopnúť</button>}
            </div>
          ))}
          {pins.length === 0 && <p className="px-5 py-6 text-center text-slate-500 text-sm">Žiadne pripnuté správy</p>}
        </Sheet>
      )}
      {zoom && <Lightbox src={zoom} onClose={() => setZoom(null)} />}
      {info && room && <InfoPanel boot={boot} teamMap={teamMap} room={room} title={title} onClose={() => setInfo(false)} onChanged={onGroupChanged} onCleared={onCleared} />}
      {menu && (
        <Sheet title="Správa" onClose={() => { setMenu(null); setMoreReact(false); }}>
          <div className="px-4 pt-1 pb-2">
            <div className="flex items-center justify-between gap-1">
              {QUICK_REACTIONS.map((em) => <button key={em} onClick={() => void react(menu, em)} className={`w-11 h-11 rounded-full text-2xl hover:bg-slate-800 ${menu.reactions.some((rc) => rc.emoji === em && rc.teams.includes(boot.me.id)) ? "bg-slate-800 ring-1 ring-blue-500" : ""}`}>{em}</button>)}
              <button onClick={() => setMoreReact((v) => !v)} aria-label="Ďalšie emoji" className="w-11 h-11 rounded-full bg-slate-800 text-xl text-slate-300">{moreReact ? "−" : "＋"}</button>
            </div>
            {moreReact && (
              <div className="mt-2">
                <div className="flex flex-wrap gap-1 mb-1">{MORE_REACTIONS.map((em) => <button key={em} onClick={() => void react(menu, em)} className="w-10 h-10 rounded-full text-xl hover:bg-slate-800">{em}</button>)}</div>
                <EmojiPicker onPick={(em) => void react(menu, em)} />
              </div>
            )}
          </div>
          <div className="px-5 py-3 text-sm text-slate-400 line-clamp-3">{menu.body}</div>
          <button onClick={() => { setReply(menu); setEditing(null); setMenu(null); requestAnimationFrame(() => taRef.current?.focus()); }} className="w-full text-left px-5 py-3 hover:bg-slate-800">↩︎ Odpovedať (citovať)</button>
          {menu.fromTeamId === boot.me.id && menu.body && menu.kind === "user" && <button onClick={() => startEdit(menu)} className="w-full text-left px-5 py-3 hover:bg-slate-800">✏️ Upraviť</button>}
          <button onClick={() => { setInfoMsg(menu); setMenu(null); setMoreReact(false); }} className="w-full text-left px-5 py-3 hover:bg-slate-800">ℹ️ Informácie</button>
          {canPin && (menu.pinned || pins.some((p) => p.id === menu.id)
            ? <button onClick={() => void pin(menu, false)} className="w-full text-left px-5 py-3 hover:bg-slate-800">📌 Odopnúť</button>
            : <button onClick={() => void pin(menu, true)} className="w-full text-left px-5 py-3 hover:bg-slate-800">📌 Pripnúť na vrch chatu</button>)}
          <button onClick={() => { void navigator.clipboard?.writeText(menu.body); setMenu(null); }} className="w-full text-left px-5 py-3 hover:bg-slate-800">⧉ Kopírovať</button>
          {(menu.fromTeamId === boot.me.id || (isLeague && boot.admin)) && (
            <button onClick={() => del(menu)} className="w-full text-left px-5 py-3 hover:bg-slate-800 text-red-400">🗑 {menu.fromTeamId === boot.me.id ? "Odstrániť" : "Odstrániť (moderácia)"}</button>
          )}
        </Sheet>
      )}
    </>
  );
}

function Settings({ boot, teamMap, onClose, reload, prefs, setPrefs, pushApi }: { boot: Boot; teamMap: Map<number, TeamLite>; onClose: () => void; reload: () => Promise<void>; prefs: Prefs; setPrefs: (p: Prefs) => void; pushApi: PushApi }) {
  const push = pushApi.state;
  const [testMsg, setTestMsg] = useState("");
  const [admin, setAdmin] = useState<{ enabled: boolean; mutes: { teamId: number; until: string | null }[]; tradeRoomId: number | null; groups: { id: number; name: string | null }[] } | null>(null);
  const [tradeMsg, setTradeMsg] = useState("");
  const loadAdmin = useCallback(async () => { if (boot.admin) { const r = await fetch("/api/im/admin"); if (r.ok) setAdmin(await r.json()); } }, [boot.admin]);

  useEffect(() => {
    void loadAdmin();
  }, [loadAdmin]);

  const enablePush = () => void pushApi.enable();
  const disablePush = () => void pushApi.disable();
  async function adminPost(b: object) {
    await fetch("/api/im/admin", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(b) });
    await loadAdmin(); await reload();
  }

  const row = "px-5 py-3 flex items-center gap-3";
  return (
    <Sheet title="Nastavenia" onClose={onClose}>
      <div className={row}>
        <div className="flex-1"><div>Notifikácie na tomto zariadení</div><div className="text-xs text-slate-500">
          {push === "ios-install" ? "Na iPhone: Zdieľať → Pridať na plochu, potom otvor chat z ikony." : push === "unsupported" ? "Tento prehliadač push nepodporuje." : push === "denied" ? "Zablokované — povoľ notifikácie pre chat.unhl.eu v nastaveniach prehliadača/telefónu." : push === "novapid" ? "Server nemá nastavené kľúče pre notifikácie." : push === "on" ? "Zapnuté — správy ti prídu aj keď je appka zatvorená." : "Vypnuté — správy ti neprídu, keď je appka zatvorená."}</div></div>
        {push === "off" && <button onClick={enablePush} className="rounded-lg bg-blue-600 px-4 py-2 text-sm">Zapnúť</button>}
        {push === "on" && <button onClick={disablePush} className="rounded-lg bg-slate-700 px-4 py-2 text-sm">Vypnúť</button>}
      </div>
      {push === "on" && (
        <div className={row}>
          <div className="flex-1 text-xs text-slate-500">{testMsg || "Over, že to funguje — pošleme ti skúšobnú notifikáciu."}</div>
          <button onClick={async () => { setTestMsg("Posielam…"); const n = await pushApi.test(); setTestMsg(n ? `Poslané na ${n} zariadenie(a). Ak nič nevidíš, skontroluj nastavenia notifikácií.` : "Žiadne zariadenie nie je zaregistrované."); }} className="rounded-lg bg-slate-700 px-4 py-2 text-sm whitespace-nowrap">Skúšobná notifikácia</button>
        </div>
      )}
      <div className="px-5 pt-3 pb-1 text-xs uppercase tracking-wide text-slate-500">Vzhľad</div>
      <div className="px-5 pb-3 flex gap-2">
        {([["dark", "🌙 Tmavý"], ["light", "☀️ Svetlý"], ["auto", "📱 Podľa zariadenia"]] as [Theme, string][]).map(([t, label]) => (
          <button key={t} onClick={() => setPrefs({ ...prefs, theme: t })} className={`flex-1 rounded-xl border px-2 py-2.5 text-sm ${prefs.theme === t ? "border-blue-500 bg-blue-600/15" : "border-slate-700 hover:bg-slate-800"}`}>{label}</button>
        ))}
      </div>
      <div className="px-5 pt-1 pb-1 text-xs uppercase tracking-wide text-slate-500">Zvuk a upozornenia</div>
      <div className="px-5 pb-1 text-xs text-slate-500">Zvuk pri novej správe, keď máš chat otvorený. Notifikácie pri zatvorenej appke majú zvuk podľa nastavení telefónu.</div>
      {SOUNDS.map((so) => (
        <button key={so.id} onClick={() => { setPrefs({ ...prefs, sound: so.id as SoundId }); playSound(so.id as SoundId, prefs.volume); }} className="w-full flex items-center gap-3 px-5 py-2.5 hover:bg-slate-800 text-left">
          <span className={`w-5 h-5 rounded-full border flex items-center justify-center ${prefs.sound === so.id ? "border-blue-500" : "border-slate-600"}`}>{prefs.sound === so.id && <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />}</span>
          <span className="flex-1 text-sm">{so.label}</span>
          {so.id !== "off" && <span className="text-xs text-slate-500">▶ vypočuť</span>}
        </button>
      ))}
      <div className="px-5 py-3 flex items-center gap-3">
        <span className="text-sm w-20">Hlasitosť</span>
        <input type="range" min={0.1} max={1} step={0.1} value={prefs.volume} onChange={(e) => setPrefs({ ...prefs, volume: Number(e.target.value) })} onPointerUp={() => playSound(prefs.sound, prefs.volume)} className="flex-1" />
      </div>
      <button onClick={() => setPrefs({ ...prefs, banner: !prefs.banner })} className="w-full flex items-center gap-3 px-5 py-2.5 hover:bg-slate-800 text-left">
        <span className="flex-1 text-sm">Upozornenie na obrazovke pri novej správe</span>
        <span className={`w-11 h-6 rounded-full p-0.5 transition-colors ${prefs.banner ? "bg-blue-600" : "bg-slate-700"}`}><span className={`block w-5 h-5 rounded-full bg-white transition-transform ${prefs.banner ? "translate-x-5" : ""}`} /></span>
      </button>
      <button onClick={() => setPrefs({ ...prefs, vibrate: !prefs.vibrate })} className="w-full flex items-center gap-3 px-5 py-2.5 hover:bg-slate-800 text-left">
        <span className="flex-1 text-sm">Vibrovanie (Android)</span>
        <span className={`w-11 h-6 rounded-full p-0.5 transition-colors ${prefs.vibrate ? "bg-blue-600" : "bg-slate-700"}`}><span className={`block w-5 h-5 rounded-full bg-white transition-transform ${prefs.vibrate ? "translate-x-5" : ""}`} /></span>
      </button>
      <div className="border-t border-slate-800 my-2" />
      <PictureRow label="Moja fotka v chate" hasImage={!!boot.me.avatarUrl}
        preview={<Logo t={boot.me} size={44} />}
        onSet={async (url) => { await fetch("/api/im/profile", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ avatarUrl: url }) }); await reload(); }} />
      <div className={row}>
        <div className="flex-1 text-sm text-slate-400">Súkromné správy vidíte iba vy dvaja. Ani komisár ich nečíta.</div>
      </div>
      {boot.admin && admin && (
        <>
          <div className="px-5 pt-4 pb-1 text-xs uppercase tracking-wide text-slate-500">Moderácia (admin)</div>
          <div className={row}>
            <div className="flex-1"><div>Chat zapnutý pre všetkých GM</div><div className="text-xs text-slate-500">Vypnutý = vidí ho len admin</div></div>
            <button onClick={() => adminPost({ action: "enable", enabled: !admin.enabled })} className={`rounded-lg px-4 py-2 text-sm ${admin.enabled ? "bg-green-600" : "bg-slate-700"}`}>{admin.enabled ? "ZAP" : "VYP"}</button>
          </div>
          <PictureRow label="Obrázok ligového kanála" hasImage={!!boot.rooms.find((r) => r.kind === "league")?.imageUrl}
            preview={<RoomIcon r={boot.rooms.find((r) => r.kind === "league") ?? { kind: "league", imageUrl: null }} size={44} />}
            onSet={(url) => adminPost({ action: "leagueImage", image: url })} />
          <div className="px-5 pt-3 pb-1 text-xs uppercase tracking-wide text-slate-500">Obchody → chat</div>
          <div className="px-5 pb-2 text-xs text-slate-500">Po schválení obchodu oboma GM (pri nováčikoch aj komisiou) sa sem pošle jedna karta: kto za koho, hráči, picky, hotovosť, podmienky.</div>
          <div className="px-5 pb-2 flex gap-2">
            <select value={admin.tradeRoomId ?? ""} onChange={(e) => adminPost({ action: "tradeRoom", roomId: e.target.value ? Number(e.target.value) : null })} className="flex-1 min-w-0 rounded-xl bg-slate-800 px-3 py-2.5 text-sm outline-none">
              <option value="">Vypnuté</option>
              {boot.rooms.filter((r) => r.kind === "league").map((r) => <option key={r.id} value={r.id}>{r.name || "# Liga"} (ligový kanál)</option>)}
              {admin.groups.map((g) => <option key={g.id} value={g.id}>{g.name ?? "Skupina"}</option>)}
            </select>
            <button disabled={!admin.tradeRoomId} onClick={async () => { const r = await fetch("/api/im/admin", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "tradeTest" }) }); setTradeMsg(r.ok ? "Skúšobná karta poslaná." : "Nepodarilo sa."); }} className="rounded-xl bg-slate-700 disabled:opacity-40 px-3 text-sm whitespace-nowrap">Skúška</button>
          </div>
          {tradeMsg && <p className="px-5 pb-2 text-xs text-slate-400">{tradeMsg}</p>}
          {admin.groups.length === 0 && <p className="px-5 pb-2 text-[11px] text-slate-600">Skupinu (napr. „Trade komisia“) vytvor cez ＋ → Nová skupina a pridaj do nej členov komisie — potom ju tu vyberieš.</p>}
          <div className="px-5 py-2 text-xs text-slate-500">Umlčať GM v ligovom kanáli:</div>
          {boot.teams.filter((t) => t.id !== boot.me.id).map((t) => {
            const m = admin.mutes.find((x) => x.teamId === t.id);
            return (
              <div key={t.id} className="px-5 py-1.5 flex items-center gap-3">
                <Logo t={t} size={28} /><span className="flex-1 text-sm">{t.name}</span>
                {m ? <button onClick={() => adminPost({ action: "unmute", teamId: t.id })} className="rounded-lg bg-amber-600 px-3 py-1 text-xs">Zrušiť umlčanie</button>
                  : <button onClick={() => adminPost({ action: "mute", teamId: t.id, hours: 24 })} className="rounded-lg bg-slate-700 px-3 py-1 text-xs">Umlčať 24 h</button>}
              </div>
            );
          })}
          <p className="px-5 pt-2 text-[11px] text-slate-600">Správy v ligovom kanáli odstrániš ťuknutím na správu → Odstrániť.</p>
        </>
      )}
      <a href="/chat/install" className="block px-5 py-3 text-slate-300 hover:bg-slate-800">📲 Ako pridať chat na plochu</a>
      <button onClick={() => { window.location.href = "/"; }} className="w-full text-left px-5 py-3 mt-2 text-slate-400 hover:bg-slate-800">← Späť na stránku ligy</button>
    </Sheet>
  );
}

function TeamPick({ teams, selected, toggle }: { teams: TeamLite[]; selected: Set<number>; toggle: (id: number) => void }) {
  return (
    <>
      {teams.map((t) => (
        <button key={t.id} onClick={() => toggle(t.id)} className="w-full flex items-center gap-3 px-5 py-2 hover:bg-slate-800 text-left">
          <Logo t={t} size={32} /><span className="flex-1 text-sm">{t.name}</span>
          <span className={`w-5 h-5 rounded-md border flex items-center justify-center text-xs ${selected.has(t.id) ? "bg-blue-600 border-blue-600" : "border-slate-600"}`}>{selected.has(t.id) ? "✓" : ""}</span>
        </button>
      ))}
    </>
  );
}

function GroupCreate({ boot, onClose, onCreated }: { boot: Boot; onClose: () => void; onCreated: (roomId: number) => Promise<void> }) {
  const [name, setName] = useState("");
  const [sel, setSel] = useState<Set<number>>(new Set());
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [image, setImage] = useState<string | null>(null);
  const toggle = (id: number) => setSel((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  async function create() {
    setBusy(true); setErr("");
    const r = await fetch("/api/im/group", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, memberIds: [...sel], image }) });
    if (!r.ok) { setErr("Zadaj názov a vyber aspoň jedného GM."); setBusy(false); return; }
    await onCreated((await r.json()).roomId);
  }
  return (
    <Sheet title="Nová skupina" onClose={onClose}>
      <PictureRow label="Obrázok skupiny (nepovinné)" hasImage={!!image} preview={<RoomIcon r={{ kind: "group", imageUrl: image }} size={56} />} onSet={async (u) => setImage(u)} />
      <div className="px-5 pb-3"><input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} placeholder="Názov skupiny" className="w-full rounded-xl bg-slate-800 px-4 py-3 text-base outline-none" /></div>
      <div className="px-5 pb-1 text-xs uppercase tracking-wide text-slate-500">Členovia ({sel.size})</div>
      <TeamPick teams={boot.teams.filter((t) => t.id !== boot.me.id)} selected={sel} toggle={toggle} />
      {err && <p className="px-5 pt-2 text-sm text-red-400">{err}</p>}
      <div className="px-5 pt-3"><button onClick={create} disabled={busy} className="w-full rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 py-3 font-medium">Vytvoriť skupinu</button></div>
    </Sheet>
  );
}

// Small "change picture" row: pick → crop square + shrink in the browser → upload → onSet(url | null)
function PictureRow({ label, preview, hasImage, onSet }: { label: string; preview: React.ReactNode; hasImage: boolean; onSet: (url: string | null) => Promise<void> }) {
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  async function pick(f: File) {
    setBusy(true); setErr("");
    const up = await uploadImage(await prepareImage(f, { max: 384, square: true }));
    if ("error" in up) setErr(up.error); else await onSet(up.url);
    setBusy(false);
  }
  return (
    <div className="px-5 py-3 flex items-center gap-3">
      {preview}
      <div className="flex-1 min-w-0"><div className="text-sm">{label}</div>{err && <div className="text-xs text-red-400">{err}</div>}</div>
      <input ref={ref} type="file" accept="image/png,image/jpeg,image/webp,image/gif" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) void pick(f); }} />
      <button onClick={() => ref.current?.click()} disabled={busy} className="rounded-lg bg-blue-600 disabled:opacity-50 px-3 py-2 text-xs font-medium whitespace-nowrap">{busy ? "Nahrávam…" : "📷 Zmeniť fotku"}</button>
      {hasImage && <button onClick={() => void onSet(null)} disabled={busy} className="rounded-lg bg-slate-700 px-3 py-1.5 text-xs">Odstrániť</button>}
    </div>
  );
}

type MediaItem = { id: number; url: string; at: string; from: number; name?: string; size?: number };
type InfoData = { muted: boolean; mutedUntil: string | null; counts: { media: number; gif: number; links: number; files?: number }; preview: MediaItem[] };

// Viber-style chat info: hero picture + name, shared media / GIFs / links, participants, mute, leave/delete.
function InfoPanel({ boot, teamMap, room, title, onClose, onChanged, onCleared }: {
  boot: Boot; teamMap: Map<number, TeamLite>; room: Room; title: string; onClose: () => void;
  onChanged: (left: boolean) => Promise<void>; onCleared: (roomId: number) => Promise<void>;
}) {
  const isLeague = room.kind === "league", isGroup = room.kind === "group";
  const other = room.otherTeamId ? teamMap.get(room.otherTeamId) : null;
  const owner = isGroup && room.createdById === boot.me.id;
  const canPic = owner || (isLeague && boot.admin);
  const canName = canPic; // group founder, or the commissioner for the league channel
  const [info, setInfo] = useState<InfoData | null>(null);
  const [view, setView] = useState<null | "media" | "gif" | "links" | "files">(null);
  const [items, setItems] = useState<MediaItem[] | null>(null);
  const [zoom, setZoom] = useState<string | null>(null);
  const [name, setName] = useState(room.name ?? (isLeague ? "# Liga" : ""));
  const [editName, setEditName] = useState(false);
  const [adding, setAdding] = useState(false);
  const [sel, setSel] = useState<Set<number>>(new Set());
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const pic = useRef<HTMLInputElement>(null);
  const toggle = (id: number) => setSel((x) => { const n = new Set(x); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  useEffect(() => { void fetch(`/api/im/info?roomId=${room.id}`).then((r) => r.ok ? r.json() : null).then(setInfo); }, [room.id]);
  useEffect(() => {
    if (!view) { setItems(null); return; }
    void fetch(`/api/im/info?roomId=${room.id}&list=${view}`).then((r) => r.ok ? r.json() : { items: [] }).then((j) => setItems(j.items));
  }, [view, room.id]);

  async function patch(b: object, left = false) {
    await fetch("/api/im/group", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ roomId: room.id, ...b }) });
    await onChanged(left);
    if (left) onClose();
  }
  async function setPicture(url: string | null) {
    if (isLeague) { await fetch("/api/im/admin", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "leagueImage", image: url }) }); await onChanged(false); }
    else await patch({ image: url });
  }
  async function saveName() {
    if (isLeague) { await fetch("/api/im/admin", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "leagueName", name: name.trim() === "# Liga" ? "" : name }) }); await onChanged(false); }
    else await patch({ rename: name });
  }
  async function pickFile(f: File) {
    setBusy(true); setErr("");
    const up = await uploadImage(await prepareImage(f, { max: 512, square: true }));
    if ("error" in up) setErr(up.error); else await setPicture(up.url);
    setBusy(false);
  }
  const [muteSheet, setMuteSheet] = useState(false);
  const [bgSel, setBgSel] = useState(room.bg ?? "none");
  const [fontSel, setFontSel] = useState(room.font ?? "default");
  async function saveLook(bg: string, font: string) {
    setBgSel(bg); setFontSel(font);
    await fetch("/api/im/look", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ roomId: room.id, bg, font }) });
    await onChanged(false);
  }
  const [tradeOn, setTradeOn] = useState(boot.tradeRoomId === room.id);
  async function toggleTrade(v: boolean) {
    setTradeOn(v);
    await fetch("/api/im/admin", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "tradeRoom", roomId: v ? room.id : null }) });
    await onChanged(false);
  }
  async function mute(v: boolean, hours: number | null = null) {
    setMuteSheet(false);
    const until = v && hours ? new Date(Date.now() + hours * 3600_000).toISOString() : null;
    setInfo((x) => x && { ...x, muted: v, mutedUntil: until });
    await fetch("/api/im/mute", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ roomId: room.id, muted: v, hours }) });
    await onChanged(false);
  }
  async function clearChat() {
    if (!confirm(isGroup ? "Vymazať históriu skupiny len u teba? Ostatní ju budú mať ďalej." : "Vymazať túto konverzáciu len u teba? Druhý GM ju bude mať ďalej.")) return;
    await fetch("/api/im/clear", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ roomId: room.id }) });
    onClose(); await onCleared(room.id);
  }

  const who = (id: number) => teamMap.get(id)?.code ?? "";
  const day = (iso: string) => new Date(iso).toLocaleDateString("sk-SK", { day: "numeric", month: "short", year: "numeric" });
  const row = "w-full flex items-center px-5 py-4 border-b border-slate-800 text-left hover:bg-slate-900";
  const candidates = boot.teams.filter((t) => !room.members.includes(t.id));

  return (
    <div className="fixed inset-0 z-20 bg-black/60 flex" onClick={onClose}>
      <div className="ml-auto h-full w-full md:max-w-md bg-slate-950 overflow-y-auto" style={{ paddingBottom: "env(safe-area-inset-bottom)" }} onClick={(e) => e.stopPropagation()}>
        {view ? (
          <>
            <div className="flex items-center gap-2 px-3 py-3 border-b border-slate-800 sticky top-0 bg-slate-950 z-10">
              <button onClick={() => setView(null)} className="w-10 h-10 text-2xl text-slate-300" aria-label="Späť">‹</button>
              <h2 className="font-semibold flex-1">{view === "media" ? "Médiá" : view === "gif" ? "GIFy" : view === "files" ? "Súbory" : "Odkazy"}</h2>
            </div>
            {items == null && <p className="text-center text-slate-500 text-sm py-8">Načítavam…</p>}
            {items?.length === 0 && <p className="text-center text-slate-500 text-sm py-8">Zatiaľ nič</p>}
            {view === "files"
              ? items?.map((it) => (
                <a key={it.id} href={it.url} target="_blank" rel="noopener noreferrer" download={it.name} className="flex items-center gap-3 px-5 py-3 border-b border-slate-800 hover:bg-slate-900">
                  <span className="text-2xl">{fileIcon(it.name ?? "")}</span>
                  <span className="min-w-0 flex-1"><span className="block text-sm truncate">{it.name}</span><span className="block text-[11px] text-slate-500">{who(it.from)} · {day(it.at)} · {fmtSize(it.size ?? 0)}</span></span>
                </a>))
            : view === "links"
              ? items?.map((it) => (
                <a key={it.id} href={it.url} target="_blank" rel="noopener noreferrer" className="block px-5 py-3 border-b border-slate-800 hover:bg-slate-900">
                  <div className="text-sm text-blue-400 break-all line-clamp-2">{it.url}</div>
                  <div className="text-[11px] text-slate-500 mt-0.5">{who(it.from)} · {day(it.at)}</div>
                </a>))
              : <div className="grid grid-cols-3 gap-0.5 p-0.5">{items?.map((it) => (
                <button key={it.id} onClick={() => setZoom(it.url)} className="aspect-square bg-slate-900 overflow-hidden"><img src={it.url} alt="" loading="lazy" className="w-full h-full object-cover" /></button>))}</div>}
          </>
        ) : (
          <>
            {/* hero */}
            <div className="theme-dark-scope relative h-60 bg-gradient-to-br from-slate-700 to-slate-900 overflow-hidden text-slate-100">
              {(isLeague || isGroup) && room.imageUrl && <img src={room.imageUrl} alt="" className="absolute inset-0 w-full h-full object-cover" />}
              {room.kind === "dm" && <div className="absolute inset-0 flex items-center justify-center pb-10"><Logo t={other} size={120} /></div>}
              {!room.imageUrl && !(room.kind === "dm") && <div className="absolute inset-0 flex items-center justify-center pb-10 text-7xl opacity-60">{isLeague ? "🏒" : "👥"}</div>}
              <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-black/85 to-transparent" />
              <button onClick={onClose} className="absolute top-3 right-3 w-10 h-10 rounded-full bg-black/50 text-white text-xl" aria-label="Zavrieť">✕</button>
              {canPic && (
                <div className="absolute top-3 left-3 flex gap-2">
                  <button onClick={() => pic.current?.click()} disabled={busy} className="rounded-full bg-black/55 hover:bg-black/70 px-4 py-2 text-xs font-medium text-white">{busy ? "Nahrávam…" : "📷 Zmeniť ikonu"}</button>
                  {room.imageUrl && <button onClick={() => void setPicture(null)} disabled={busy} className="rounded-full bg-black/55 hover:bg-black/70 px-3 py-2 text-xs text-white">Odstrániť</button>}
                </div>
              )}
              <input ref={pic} type="file" accept="image/png,image/jpeg,image/webp,image/gif" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) void pickFile(f); }} />
              <div className="absolute inset-x-0 bottom-0 px-5 pb-4 flex items-center gap-2">
                {editName && canName ? (
                  <>
                    <input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} autoFocus placeholder="Názov chatu" className="flex-1 min-w-0 rounded-lg bg-black/60 px-3 py-2 text-white outline-none"
                      onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }} />
                    <button onClick={async () => { await saveName(); setEditName(false); }} disabled={!isLeague && !name.trim()} className="rounded-lg bg-blue-600 disabled:opacity-40 px-3 py-2 text-sm">Uložiť</button>
                    <button onClick={() => { setEditName(false); setName(room.name ?? (isLeague ? "# Liga" : "")); }} className="rounded-lg bg-black/50 px-3 py-2 text-sm text-white">Zrušiť</button>
                  </>
                ) : (
                  <>
                    <h2 className="flex-1 min-w-0 truncate text-xl font-semibold text-white">{title}</h2>
                    {canName && <button onClick={() => setEditName(true)} className="shrink-0 rounded-full bg-black/55 hover:bg-black/70 px-3 py-1.5 text-xs font-medium text-white">✎ Zmeniť názov</button>}
                  </>
                )}
              </div>
            </div>
            {err && <div className="bg-red-500/10 text-red-300 text-sm px-5 py-2">{err}</div>}
            {!canPic && (isGroup || isLeague) && <p className="px-5 pt-3 text-xs text-slate-500">{isLeague ? "Názov a obrázok ligového kanála mení komisár." : "Názov a obrázok skupiny mení jej zakladateľ."}</p>}

            {/* media */}
            <div className="px-5 pt-5 pb-3 flex items-center">
              <h3 className="flex-1 text-slate-400">Médiá</h3>
              {(info?.counts.media ?? 0) > 0 && <button onClick={() => setView("media")} className="text-sm text-blue-400">Zobraziť všetko</button>}
            </div>
            {info == null ? <p className="px-5 pb-4 text-sm text-slate-600">Načítavam…</p>
              : info.preview.length === 0 ? <p className="px-5 pb-4 text-sm text-slate-600">Zatiaľ žiadne fotky</p>
              : <div className="flex gap-2 overflow-x-auto px-5 pb-4">{info.preview.map((m) => <button key={m.id} onClick={() => setZoom(m.url)} className="shrink-0 w-20 h-20 rounded-xl overflow-hidden bg-slate-900"><img src={m.url} alt="" loading="lazy" className="w-full h-full object-cover" /></button>)}</div>}
            <button onClick={() => setView("gif")} className={`${row} border-t`}><span className="flex-1 text-slate-300">GIFy</span><span className="text-slate-400">{info?.counts.gif ?? "…"}</span></button>
            <button onClick={() => setView("files")} className={row}><span className="flex-1 text-slate-300">Súbory</span><span className="text-slate-400">{info?.counts.files ?? "…"}</span></button>
            <button onClick={() => setView("links")} className={row}><span className="flex-1 text-slate-300">Odkazy</span><span className="text-slate-400">{info?.counts.links ?? "…"}</span></button>

            {/* participants */}
            <div className="px-5 pt-5 pb-2 flex items-center">
              <h3 className="flex-1 text-slate-400">Účastníci {isLeague ? boot.teams.length : isGroup ? room.members.length : 2}</h3>
              {owner && candidates.length > 0 && <button onClick={() => setAdding((v) => !v)} className="text-sm text-blue-400">{adding ? "Zrušiť" : "＋ Pridať"}</button>}
            </div>
            {adding && (
              <div className="border-y border-slate-800 bg-slate-900/40 pb-3">
                <TeamPick teams={candidates} selected={sel} toggle={toggle} />
                <div className="px-5 pt-2"><button onClick={async () => { await patch({ add: [...sel] }); setSel(new Set()); setAdding(false); }} disabled={!sel.size} className="w-full rounded-xl bg-blue-600 disabled:opacity-40 py-2.5">Pridať ({sel.size})</button></div>
              </div>
            )}
            {(isLeague ? boot.teams : isGroup ? room.members.map((id) => teamMap.get(id)).filter((t): t is TeamLite => !!t) : [boot.me, ...(other ? [other] : [])]).map((t) => (
              <div key={t.id} className="px-5 py-2 flex items-center gap-3">
                <Logo t={t} size={36} />
                <div className="flex-1 min-w-0"><div className="text-sm truncate">{t.name}{t.id === boot.me.id && <span className="text-slate-500"> (ty)</span>}</div><div className="text-xs text-slate-500">{t.gmNickname}</div></div>
                {isGroup && t.id === room.createdById && <span className="text-[10px] text-amber-400">správca</span>}
                {owner && t.id !== boot.me.id && <button onClick={() => patch({ remove: t.id })} className="text-xs text-red-400 rounded-lg bg-slate-800 px-3 py-1">Odobrať</button>}
              </div>
            ))}

            {room.kind !== "dm" && (boot.admin || owner) && (
              <div className="mt-3 px-5 py-4 border-t border-slate-800">
                <div className="text-slate-200 mb-1">🎨 Vzhľad chatu</div>
                <div className="text-xs text-slate-500 mb-3">Pozadie a písmo vidia všetci v tomto chate.</div>
                <div className="flex flex-wrap gap-2 mb-3">
                  {Object.entries(BACKGROUNDS).map(([k, v]) => (
                    <button key={k} title={v.label} aria-label={v.label} onClick={() => void saveLook(k, fontSel)} className={`w-11 h-11 rounded-full ${bgSel === k ? "ring-2 ring-offset-2 ring-blue-500 ring-offset-slate-950" : "border border-slate-600"}`} style={{ background: v.swatch }} />
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {Object.entries(FONTS).map(([k, v]) => (
                    <button key={k} onClick={() => void saveLook(bgSel, k)} className={`rounded-xl border px-3 py-2.5 text-left ${fontSel === k ? "border-blue-500 bg-blue-600/15" : "border-slate-700 hover:bg-slate-800"}`}>
                      <div className="text-lg leading-tight" style={{ fontFamily: v.title || undefined }}>{v.label}</div>
                      <div className="text-sm text-slate-400" style={{ fontFamily: v.body || undefined }}>Ahoj, čau!</div>
                    </button>
                  ))}
                </div>
              </div>
            )}
            {/* mute */}
            <button onClick={() => setMuteSheet(true)} className="mt-3 w-full px-5 py-4 border-y border-slate-800 flex items-center gap-3 text-left hover:bg-slate-900">
              <div className="flex-1"><div className="text-slate-200">{info?.muted ? "🔕 Stlmené" : "Stlmiť chat"}</div><div className="text-xs text-slate-500">{info?.muted ? `Notifikácie vypnuté ${muteLabel(info.mutedUntil)}. Ťukni pre zmenu.` : "Vypni notifikácie z tohto chatu na hodinu, deň alebo navždy"}</div></div>
              <span className="text-slate-500">›</span>
            </button>
            {boot.admin && room.kind !== "dm" && (
              <div className="px-5 py-4 border-b border-slate-800 flex items-center gap-3">
                <div className="flex-1"><div className="text-slate-200">🔄 Posielať sem schválené obchody</div><div className="text-xs text-slate-500">Keď sa obchod vykoná (oba tímy súhlasili, pri nováčikoch aj komisia), príde sem jedna karta: kto za koho.{boot.tradeRoomId != null && !tradeOn ? " Zapnutím sa presunie z iného chatu." : ""}</div></div>
                <button onClick={() => void toggleTrade(!tradeOn)} aria-pressed={tradeOn} className={`w-12 h-7 rounded-full p-0.5 transition-colors ${tradeOn ? "bg-amber-500" : "bg-slate-700"}`}><span className={`block w-6 h-6 rounded-full bg-white transition-transform ${tradeOn ? "translate-x-5" : ""}`} /></button>
              </div>
            )}
            {muteSheet && (
              <Sheet title="Stlmiť chat" onClose={() => setMuteSheet(false)}>
                <p className="px-5 pt-1 pb-2 text-xs text-slate-500">Správy sa ďalej ukladajú a počítajú, ale bez zvuku, bannera a push notifikácie.</p>
                {MUTE_OPTIONS.map((o) => <button key={o.label} onClick={() => void mute(true, o.hours)} className="w-full text-left px-5 py-3.5 hover:bg-slate-800">{o.hours ? `Na ${o.label}` : "Navždy"}</button>)}
                {info?.muted && <button onClick={() => void mute(false)} className="w-full text-left px-5 py-3.5 hover:bg-slate-800 text-blue-400">🔔 Zrušiť stlmenie</button>}
              </Sheet>
            )}

            {isGroup && <button onClick={() => { if (confirm("Naozaj opustiť skupinu?")) void patch({ leave: true }, true); }} className={`${row} text-red-400`}>Opustiť skupinu</button>}
            {!isLeague && <button onClick={clearChat} className={`${row} text-red-400`}>🗑 {isGroup ? "Vymazať históriu (len u mňa)" : "Vymazať konverzáciu (len u mňa)"}</button>}
          </>
        )}
      </div>
      {zoom && <Lightbox src={zoom} onClose={() => setZoom(null)} />}
    </div>
  );
}

function PollCard({ m, me, teamMap, onVote, onClose }: { m: Msg; me: number; teamMap: Map<number, TeamLite>; onVote: (optionId: number) => void; onClose: () => void }) {
  const p = m.poll!;
  const total = new Set(p.options.flatMap((o) => o.voters)).size;
  return (
    <div className="min-w-[230px] sm:min-w-[280px]">
      <div className="font-semibold text-[15px] mb-0.5">📊 {p.question}</div>
      <div className="text-[11px] opacity-70 mb-2">{p.closed ? "Anketa je uzavretá" : p.multi ? "Môžeš vybrať viac možností" : "Vyber jednu možnosť"}</div>
      <div className="space-y-1.5">
        {p.options.map((o) => {
          const pct = total ? Math.round((o.voters.length / total) * 100) : 0;
          const mine = o.voters.includes(me);
          return (
            <button key={o.id} disabled={p.closed} onClick={(e) => { e.stopPropagation(); onVote(o.id); }} className="relative w-full text-left rounded-lg overflow-hidden bg-black/20 px-3 py-2 disabled:cursor-default">
              <span className="absolute inset-y-0 left-0 bg-white/25 transition-all" style={{ width: `${pct}%` }} />
              <span className="relative flex items-center gap-2">
                <span className={`w-4 h-4 shrink-0 ${p.multi ? "rounded" : "rounded-full"} border border-white/60 flex items-center justify-center text-[10px] ${mine ? "bg-white text-black" : ""}`}>{mine ? "✓" : ""}</span>
                <span className="flex-1 text-sm break-words">{o.text}</span>
                <span className="text-xs opacity-80">{o.voters.length}</span>
              </span>
              {o.voters.length > 0 && <span className="relative block text-[10px] opacity-60 mt-0.5 pl-6">{o.voters.map((id) => teamMap.get(id)?.code).filter(Boolean).join(", ")}</span>}
            </button>
          );
        })}
      </div>
      <div className="flex items-center text-[11px] opacity-70 mt-2">
        <span className="flex-1">{total} {total === 1 ? "hlasujúci" : "hlasujúcich"}</span>
        {!p.closed && m.fromTeamId === me && <span onClick={(e) => { e.stopPropagation(); onClose(); }} className="underline cursor-pointer">Uzavrieť</span>}
      </div>
    </div>
  );
}

function PollCreate({ onClose, onCreate }: { onClose: () => void; onCreate: (q: string, options: string[], multi: boolean) => Promise<boolean> }) {
  const [q, setQ] = useState("");
  const [opts, setOpts] = useState(["", ""]);
  const [multi, setMulti] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const filled = opts.map((o) => o.trim()).filter(Boolean);
  async function go() {
    setBusy(true); setErr("");
    if (await onCreate(q, filled, multi)) onClose(); else { setErr("Zadaj otázku a aspoň dve možnosti."); setBusy(false); }
  }
  const inp = "w-full rounded-xl bg-slate-800 px-4 py-2.5 text-base outline-none";
  return (
    <Sheet title="Nová anketa" onClose={onClose}>
      <div className="px-5 py-3 space-y-2">
        <input value={q} onChange={(e) => setQ(e.target.value)} maxLength={200} placeholder="Otázka" className={inp} />
        {opts.map((o, i) => (
          <div key={i} className="flex gap-2">
            <input value={o} onChange={(e) => setOpts((a) => a.map((x, j) => (j === i ? e.target.value : x)))} maxLength={80} placeholder={`Možnosť ${i + 1}`} className={inp} />
            {opts.length > 2 && <button onClick={() => setOpts((a) => a.filter((_, j) => j !== i))} aria-label="Odstrániť" className="w-10 text-slate-500">✕</button>}
          </div>
        ))}
        {opts.length < 10 && <button onClick={() => setOpts((a) => [...a, ""])} className="text-sm text-blue-400 py-1">＋ Pridať možnosť</button>}
      </div>
      <button onClick={() => setMulti((v) => !v)} className="w-full flex items-center gap-3 px-5 py-3 hover:bg-slate-800 text-left">
        <span className="flex-1 text-sm">Povoliť viac odpovedí</span>
        <span className={`w-11 h-6 rounded-full p-0.5 transition-colors ${multi ? "bg-blue-600" : "bg-slate-700"}`}><span className={`block w-5 h-5 rounded-full bg-white transition-transform ${multi ? "translate-x-5" : ""}`} /></span>
      </button>
      {err && <p className="px-5 text-sm text-red-400">{err}</p>}
      <div className="px-5 pt-3"><button onClick={go} disabled={busy || !q.trim() || filled.length < 2} className="w-full rounded-xl bg-blue-600 disabled:opacity-40 py-3 font-medium">Vytvoriť anketu</button></div>
    </Sheet>
  );
}
