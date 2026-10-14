"use client";

import InstallBanner from "./InstallBanner";
import { DEFAULT_PREFS, SOUNDS, loadPrefs, playSound, savePrefs, unlockAudio, type Prefs, type SoundId } from "./sound";
import { EmojiPicker, GifPicker, Lightbox, isBigEmoji, prepareImage, uploadImage } from "./media";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type TeamLite = { id: number; code: string | null; name: string; logoUrl: string | null; gmNickname: string | null; avatarUrl: string | null };
type Msg = { kind: string; imageUrl: string | null; edited: boolean; id: number; roomId: number; fromTeamId: number; body: string; at: string; deleted: boolean; replyTo: { id: number; fromTeamId: number; body: string } | null };
type Room = { id: number; kind: string; otherTeamId: number | null; unread: number; last: Msg | null; muted: boolean; name: string | null; imageUrl: string | null; createdById: number | null; members: number[] };
type Boot = { me: TeamLite; admin: boolean; enabled: boolean; muted: boolean; leagueRoomId: number; teams: TeamLite[]; rooms: Room[]; vapid: string | null; gif: boolean };

const hm = (iso: string) => new Date(iso).toLocaleTimeString("sk-SK", { hour: "2-digit", minute: "2-digit" });
function dayLabel(iso: string) {
  const d = new Date(iso), n = new Date();
  const same = (a: Date, b: Date) => a.toDateString() === b.toDateString();
  if (same(d, n)) return "Dnes";
  const y = new Date(n); y.setDate(n.getDate() - 1);
  return same(d, y) ? "Včera" : d.toLocaleDateString("sk-SK", { day: "numeric", month: "long" });
}
function b64ToU8(s: string) {
  const pad = "=".repeat((4 - (s.length % 4)) % 4);
  const raw = atob((s + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
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

export default function ChatApp() {
  const [boot, setBoot] = useState<Boot | null>(null);
  const [err, setErr] = useState("");
  const [active, setActive] = useState<number | null>(null); // roomId; null = list (mobile)
  const [pendingDm, setPendingDm] = useState<number | null>(null); // teamId of a DM with no room yet
  const [msgs, setMsgs] = useState<Record<number, Msg[]>>({});
  const [reads, setReads] = useState<Record<number, Record<number, number>>>({}); // roomId -> teamId -> lastReadId
  const [picker, setPicker] = useState(false);
  const [groupNew, setGroupNew] = useState(false);
  const [settings, setSettings] = useState(false);
  const activeRef = useRef<number | null>(null);
  activeRef.current = active;
  const [prefs, setPrefsState] = useState<Prefs>(DEFAULT_PREFS);
  const prefsRef = useRef<Prefs>(DEFAULT_PREFS);
  const bootRef = useRef<Boot | null>(null);
  bootRef.current = boot;
  const [banner, setBanner] = useState<{ roomId: number; title: string; text: string; team: TeamLite | null; kind: string } | null>(null);
  const bannerTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const setPrefs = (p: Prefs) => { prefsRef.current = p; setPrefsState(p); savePrefs(p); };
  useEffect(() => {
    const p = loadPrefs(); prefsRef.current = p; setPrefsState(p);
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
    setBoot((b) => b && { ...b, rooms: b.rooms.map((x) => (x.id === roomId ? { ...x, unread: 0 } : x)) });
  }, []);

  useEffect(() => {
    if (active == null) return;
    void loadRoom(active);
  }, [active, loadRoom]);
  useEffect(() => {
    if (active != null && msgs[active]) markRead(active, msgs[active]);
  }, [active, msgs, markRead]);

  // live stream (auto-reconnect by EventSource; server recycles every ~55 s)
  const lastSeen = useRef(0);
  useEffect(() => {
    if (!boot) return;
    let es: EventSource | null = null, dead = false;
    const open = () => {
      if (dead) return;
      es = new EventSource(`/api/im/stream${lastSeen.current ? `?after=${lastSeen.current}` : ""}`);
      es.addEventListener("messages", (e) => {
        const list = JSON.parse((e as MessageEvent).data) as Msg[];
        lastSeen.current = Math.max(lastSeen.current, ...list.map((m) => m.id));
        // live alert for messages from others: sound + in-app banner (not for muted chats / own / system lines)
        const b0 = bootRef.current;
        if (b0 && document.visibilityState === "visible") {
          const incoming = list.filter((m) => m.kind !== "system" && m.fromTeamId !== b0.me.id && !(b0.rooms.find((r) => r.id === m.roomId)?.muted));
          const m = incoming[incoming.length - 1];
          if (m) {
            const pr = prefsRef.current;
            playSound(pr.sound, pr.volume);
            if (pr.vibrate) navigator.vibrate?.(120);
            const viewing = activeRef.current === m.roomId;
            if (pr.banner && !viewing) {
              const room = b0.rooms.find((r) => r.id === m.roomId);
              const from = b0.teams.find((t) => t.id === m.fromTeamId) ?? null;
              const title = room?.kind === "league" ? `${room.name || "# Liga"} · ${from?.code ?? ""}` : room?.kind === "group" ? `${room.name ?? "Skupina"} · ${from?.code ?? ""}` : from?.name ?? "GM";
              const text = m.body || (m.imageUrl ? (/\.gif|giphy/i.test(m.imageUrl) ? "GIF" : "📷 Fotka") : "");
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
            rooms = rooms.map((r) => r.id === m.roomId ? { ...r, last: m, unread: mineMsg || activeRef.current === m.roomId ? r.unread : r.unread + 1 } : r);
          }
          return { ...b, rooms };
        });
        if (unknownRoom) void load();
      });
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
      es.addEventListener("reads", (e) => {
        const rs = JSON.parse((e as MessageEvent).data) as { roomId: number; teamId: number; lastReadId: number }[];
        setReads((p) => { const n = { ...p }; rs.forEach((r) => (n[r.roomId] = { ...(n[r.roomId] ?? {}), [r.teamId]: r.lastReadId })); return n; });
      });
    };
    open();
    const onVis = () => { if (document.visibilityState === "visible") { void load(); if (activeRef.current) void loadRoom(activeRef.current); } };
    document.addEventListener("visibilitychange", onVis);
    return () => { dead = true; es?.close(); document.removeEventListener("visibilitychange", onVis); };
  }, [boot?.me.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // app-icon badge with total unread
  const totalUnread = (boot?.rooms ?? []).reduce((s, r) => s + r.unread, 0);
  useEffect(() => {
    document.title = totalUnread ? `(${totalUnread}) UNHL Chat` : "UNHL Chat";
    const nav = navigator as Navigator & { setAppBadge?: (n: number) => Promise<void>; clearAppBadge?: () => Promise<void> };
    if (totalUnread) nav.setAppBadge?.(totalUnread).catch(() => {}); else nav.clearAppBadge?.().catch(() => {});
  }, [totalUnread]);

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
    <div className="h-full flex" style={{ paddingTop: "env(safe-area-inset-top)", paddingBottom: "env(safe-area-inset-bottom)" }}>
      {/* LEFT — conversation list */}
      <aside className={`${showThread ? "hidden md:flex" : "flex"} w-full md:w-[360px] md:border-r border-slate-800 flex-col min-h-0`}>
        <header className="flex items-center gap-3 px-4 py-3 border-b border-slate-800">
          <Logo t={boot.me} size={36} />
          <div className="flex-1 min-w-0">
            <div className="font-semibold leading-tight">UNHL Chat</div>
            <div className="text-xs text-slate-500 truncate">{boot.me.gmNickname ?? boot.me.name}</div>
          </div>
          <button onClick={() => setPicker(true)} aria-label="Nový chat" className="w-10 h-10 rounded-full bg-blue-600 hover:bg-blue-500 text-xl">＋</button>
          <button onClick={() => setSettings(true)} aria-label="Nastavenia" className="w-10 h-10 rounded-full bg-slate-800 hover:bg-slate-700">⚙︎</button>
        </header>
        <InstallBanner />
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
                      {r.last ? (r.last.deleted ? "🚫 Správa bola odstránená" : !r.last.body && r.last.imageUrl ? `${lastMine ? "Ty: " : ""}${/\.gif/i.test(r.last.imageUrl) ? "GIF" : "📷 Fotka"}` : `${lastMine ? "Ty: " : r.kind !== "dm" && r.last.kind !== "system" ? `${teamMap.get(r.last.fromTeamId)?.code ?? ""}: ` : ""}${r.last.body}`) : "Ešte tu nikto nenapísal"}
                    </span>
                    {r.unread > 0 && <span className="min-w-5 h-5 px-1.5 rounded-full bg-blue-600 text-[11px] font-bold flex items-center justify-center">{r.unread}</span>}
                  </div>
                </div>
              </button>
            );
          })}
          {sortedRooms.length <= 1 && <p className="text-center text-slate-600 text-sm p-8">Klikni na ＋ a napíš niektorému GM.</p>}
        </div>
      </aside>

      {/* RIGHT — thread */}
      <section className={`${showThread ? "flex" : "hidden md:flex"} flex-1 min-w-0 min-h-0 flex-col`}>
        {showThread ? (
          <Thread
            key={active ?? `dm-${pendingDm}`}
            boot={boot} teamMap={teamMap}
            room={activeRoom} dmTeamId={activeRoom ? activeRoom.otherTeamId : pendingDm}
            messages={active != null ? msgs[active] ?? null : []}
            reads={active != null ? reads[active] ?? {} : {}}
            title={activeRoom ? roomTitle(activeRoom) : teamMap.get(pendingDm ?? 0)?.name ?? ""}
            onBack={() => { setActive(null); setPendingDm(null); }}
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
      {settings && <Settings boot={boot} teamMap={teamMap} onClose={() => setSettings(false)} reload={load} prefs={prefs} setPrefs={setPrefs} />}
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
}) {
  const { boot, teamMap, room, dmTeamId, messages, reads, title, onBack, onSent, onGroupChanged, onCleared } = props;
  const [info, setInfo] = useState(false);
  const [tray, setTray] = useState<null | "emoji" | "gif">(null);
  const [editing, setEditing] = useState<Msg | null>(null);
  const [flash, setFlash] = useState<number | null>(null);
  const [zoom, setZoom] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
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

  // who must have read a message of mine: the peer (DM) or every other current member (group)
  const audience: number[] = isGroup ? room!.members.filter((id) => id !== boot.me.id) : dmTeamId ? [dmTeamId] : [];
  const readBy = (m: Msg) => audience.filter((t) => (reads[t] ?? 0) >= m.id);
  const allRead = (m: Msg) => audience.length > 0 && readBy(m).length === audience.length;

  async function send(imageUrl?: string) {
    const body = imageUrl ? "" : text.trim();
    if ((!body && !imageUrl) || sending) return;
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
      body: JSON.stringify({ ...(room ? { roomId: room.id } : { toTeamId: dmTeamId }), body, imageUrl, replyToId: reply?.id }),
    });
    setSending(false);
    if (!r.ok) { setError(r.status === 403 ? "Nemáš oprávnenie písať." : "Nepodarilo sa odoslať."); return; }
    const j = await r.json();
    if (!imageUrl) setText("");
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
          <div className="min-w-0"><div className="font-semibold truncate">{title}</div><div className="text-xs text-slate-500 truncate">{isLeague ? "Verejný kanál celej ligy" : isGroup ? `${room!.members.length} členov · ${room!.members.map((id) => teamMap.get(id)?.code).filter(Boolean).join(", ")}` : other?.gmNickname ?? "Súkromná konverzácia"}</div></div>
        </button>
        {room && <button onClick={() => setInfo(true)} aria-label="Informácie" className="w-10 h-10 rounded-full text-xl text-blue-400 hover:bg-slate-800">ⓘ</button>}
      </header>

      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-1 bg-slate-950">
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
              {m.kind === "system" ? (
                <div className="text-center my-2"><span className="text-[11px] text-slate-400 bg-slate-800/60 rounded-full px-3 py-1 inline-block max-w-[90%]">{m.body}</span></div>
              ) : (
              <div id={`msg-${m.id}`} className={`group flex gap-2 items-center rounded-xl transition-colors duration-500 ${flash === m.id ? "bg-blue-500/20" : ""} ${mine ? "justify-end" : "justify-start"}`}
                onTouchStart={(e) => { swipe.current = { x: e.touches[0].clientX, y: e.touches[0].clientY, id: m.id }; }}
                onTouchEnd={(e) => { const s0 = swipe.current; swipe.current = null; if (!s0 || m.deleted) return; const dx = e.changedTouches[0].clientX - s0.x, dy = Math.abs(e.changedTouches[0].clientY - s0.y); if (dx > 70 && dy < 40) { setReply(m); setEditing(null); taRef.current?.focus(); } }}>
                {multi && !mine && (showName ? <Logo t={t} size={28} /> : <div className="w-7 shrink-0" />)}
                <button onClick={() => !m.deleted && setMenu(m)}
                  className={`max-w-[80%] text-left rounded-2xl px-3 py-2 ${mine ? "bg-blue-600 rounded-br-md" : "bg-slate-800 rounded-bl-md"} ${m.deleted ? "opacity-60 italic" : ""}`}>
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
                  {(m.deleted || m.body) && <div className={`whitespace-pre-wrap break-words ${!m.deleted && isBigEmoji(m.body) ? "text-5xl leading-tight" : "text-[15px]"}`}>{m.deleted ? "🚫 Správa bola odstránená" : m.body}</div>}
                  <div className="text-[10px] opacity-60 text-right mt-0.5">
                    {m.edited && !m.deleted && <span>upravené · </span>}{hm(m.at)}{mine && !isLeague && !m.deleted && <span className={allRead(m) ? "text-sky-300 opacity-100" : ""}> {allRead(m) ? "✓✓" : "✓"}</span>}
                  </div>
                </button>
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
          {uploading && <div className="px-4 pt-2 text-xs text-slate-400">Nahrávam obrázok…</div>}
          <div className="flex items-end gap-1.5 p-3">
            <button onClick={() => setTray(tray === "emoji" ? null : "emoji")} aria-label="Emoji" className={`w-10 h-11 text-2xl ${tray === "emoji" ? "text-blue-400" : "text-slate-400"}`}>☺︎</button>
            <button onClick={() => { if (fileRef.current) fileRef.current.accept = "image/png,image/jpeg,image/webp,image/gif"; fileRef.current?.click(); }} aria-label="Fotka" className="w-10 h-11 text-xl text-slate-400">🖼</button>
            {<button onClick={() => setTray(tray === "gif" ? null : "gif")} aria-label="GIF" className={`h-11 px-1.5 text-xs font-bold ${tray === "gif" ? "text-blue-400" : "text-slate-400"}`}>GIF</button>}
            <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif" className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; e.target.accept = "image/png,image/jpeg,image/webp,image/gif"; if (f) void sendFile(f); }} />
            <textarea ref={taRef} value={text} onChange={(e) => setText(e.target.value)} rows={1} maxLength={2000} placeholder="Správa" onFocus={() => setTray(null)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && window.matchMedia("(pointer:fine)").matches) { e.preventDefault(); void send(); } }}
              className="flex-1 min-w-0 resize-none max-h-32 rounded-2xl bg-slate-800 px-4 py-2.5 text-base outline-none" />
            <button onClick={() => send()} disabled={!text.trim() || sending} className="w-11 h-11 rounded-full bg-blue-600 disabled:opacity-40 text-lg" aria-label="Odoslať">➤</button>
          </div>
          {tray === "emoji" && <div className="border-t border-slate-800"><EmojiPicker onPick={insertEmoji} /></div>}
          {tray === "gif" && <div className="border-t border-slate-800 pt-2 max-h-[240px] overflow-y-auto"><GifPicker search={boot.gif} roomId={room?.id ?? null} onPick={(u) => void send(u)} onUpload={() => { if (fileRef.current) { fileRef.current.accept = "image/gif"; fileRef.current.click(); } }} /></div>}
        </div>
      ) : <div className="p-4 text-center text-sm text-amber-300 bg-slate-900 border-t border-slate-800">Komisár ti dočasne zakázal písať do ligového kanála.</div>}

      {zoom && <Lightbox src={zoom} onClose={() => setZoom(null)} />}
      {info && room && <InfoPanel boot={boot} teamMap={teamMap} room={room} title={title} onClose={() => setInfo(false)} onChanged={onGroupChanged} onCleared={onCleared} />}
      {menu && (
        <Sheet title="Správa" onClose={() => setMenu(null)}>
          <div className="px-5 py-3 text-sm text-slate-400 line-clamp-3">{menu.body}</div>
          {isGroup && menu.fromTeamId === boot.me.id && (
            <div className="px-5 pb-3 text-xs space-y-1">
              <div><span className="text-sky-300">✓✓ Prečítali:</span> <span className="text-slate-300">{readBy(menu).map((t) => teamMap.get(t)?.code).join(", ") || "zatiaľ nikto"}</span></div>
              {audience.length > readBy(menu).length && <div><span className="text-slate-500">✓ Ešte nečítali:</span> <span className="text-slate-400">{audience.filter((t) => !readBy(menu).includes(t)).map((t) => teamMap.get(t)?.code).join(", ")}</span></div>}
            </div>
          )}
          <button onClick={() => { setReply(menu); setEditing(null); setMenu(null); requestAnimationFrame(() => taRef.current?.focus()); }} className="w-full text-left px-5 py-3 hover:bg-slate-800">↩︎ Odpovedať (citovať)</button>
          {menu.fromTeamId === boot.me.id && menu.body && <button onClick={() => startEdit(menu)} className="w-full text-left px-5 py-3 hover:bg-slate-800">✏️ Upraviť</button>}
          <button onClick={() => { void navigator.clipboard?.writeText(menu.body); setMenu(null); }} className="w-full text-left px-5 py-3 hover:bg-slate-800">⧉ Kopírovať</button>
          {(menu.fromTeamId === boot.me.id || (isLeague && boot.admin)) && (
            <button onClick={() => del(menu)} className="w-full text-left px-5 py-3 hover:bg-slate-800 text-red-400">🗑 {menu.fromTeamId === boot.me.id ? "Odstrániť" : "Odstrániť (moderácia)"}</button>
          )}
        </Sheet>
      )}
    </>
  );
}

function Settings({ boot, teamMap, onClose, reload, prefs, setPrefs }: { boot: Boot; teamMap: Map<number, TeamLite>; onClose: () => void; reload: () => Promise<void>; prefs: Prefs; setPrefs: (p: Prefs) => void }) {
  const [push, setPush] = useState<"unknown" | "on" | "off" | "unsupported" | "ios-install">("unknown");
  const [admin, setAdmin] = useState<{ enabled: boolean; mutes: { teamId: number; until: string | null }[] } | null>(null);
  const loadAdmin = useCallback(async () => { if (boot.admin) { const r = await fetch("/api/im/admin"); if (r.ok) setAdmin(await r.json()); } }, [boot.admin]);

  useEffect(() => {
    void loadAdmin();
    (async () => {
      const standalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone;
      const ios = /iphone|ipad/i.test(navigator.userAgent);
      if (!("serviceWorker" in navigator) || !("PushManager" in window)) return setPush(ios && !standalone ? "ios-install" : "unsupported");
      const reg = await navigator.serviceWorker.getRegistration("/chat");
      const sub = await reg?.pushManager.getSubscription();
      setPush(sub ? "on" : "off");
    })();
  }, [loadAdmin]);

  async function enablePush() {
    if (!boot.vapid) return;
    if ((await Notification.requestPermission()) !== "granted") return;
    const reg = (await navigator.serviceWorker.getRegistration("/chat")) ?? (await navigator.serviceWorker.register("/chat-sw.js", { scope: "/chat" }));
    await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToU8(boot.vapid) });
    await fetch("/api/im/push", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(sub.toJSON()) });
    setPush("on");
  }
  async function disablePush() {
    const reg = await navigator.serviceWorker.getRegistration("/chat");
    const sub = await reg?.pushManager.getSubscription();
    if (sub) { await fetch("/api/im/push", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ endpoint: sub.endpoint }) }); await sub.unsubscribe(); }
    setPush("off");
  }
  async function adminPost(b: object) {
    await fetch("/api/im/admin", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(b) });
    await loadAdmin(); await reload();
  }

  const row = "px-5 py-3 flex items-center gap-3";
  return (
    <Sheet title="Nastavenia" onClose={onClose}>
      <div className={row}>
        <div className="flex-1"><div>Notifikácie</div><div className="text-xs text-slate-500">
          {push === "ios-install" ? "Na iPhone: Zdieľať → Pridať na plochu, potom otvor chat z ikony." : push === "unsupported" ? "Tento prehliadač push nepodporuje." : "Upozornenie aj keď je appka zatvorená."}</div></div>
        {push === "off" && <button onClick={enablePush} className="rounded-lg bg-blue-600 px-4 py-2 text-sm">Zapnúť</button>}
        {push === "on" && <button onClick={disablePush} className="rounded-lg bg-slate-700 px-4 py-2 text-sm">Vypnúť</button>}
      </div>
      <div className="px-5 pt-3 pb-1 text-xs uppercase tracking-wide text-slate-500">Zvuk a upozornenia</div>
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

type MediaItem = { id: number; url: string; at: string; from: number };
type InfoData = { muted: boolean; counts: { media: number; gif: number; links: number }; preview: MediaItem[] };

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
  const [view, setView] = useState<null | "media" | "gif" | "links">(null);
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
  async function mute(v: boolean) {
    setInfo((x) => x && { ...x, muted: v });
    await fetch("/api/im/mute", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ roomId: room.id, muted: v }) });
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
              <h2 className="font-semibold flex-1">{view === "media" ? "Médiá" : view === "gif" ? "GIFy" : "Odkazy"}</h2>
            </div>
            {items == null && <p className="text-center text-slate-500 text-sm py-8">Načítavam…</p>}
            {items?.length === 0 && <p className="text-center text-slate-500 text-sm py-8">Zatiaľ nič</p>}
            {view === "links"
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
            <div className="relative h-60 bg-gradient-to-br from-slate-800 to-slate-900 overflow-hidden">
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

            {/* mute */}
            <div className="mt-3 px-5 py-4 border-y border-slate-800 flex items-center gap-3">
              <div className="flex-1"><div className="text-slate-200">Stlmiť chat</div><div className="text-xs text-slate-500">Žiadne notifikácie z tohto chatu</div></div>
              <button onClick={() => mute(!info?.muted)} aria-pressed={!!info?.muted} className={`w-12 h-7 rounded-full p-0.5 transition-colors ${info?.muted ? "bg-blue-600" : "bg-slate-700"}`}><span className={`block w-6 h-6 rounded-full bg-white transition-transform ${info?.muted ? "translate-x-5" : ""}`} /></button>
            </div>

            {isGroup && <button onClick={() => { if (confirm("Naozaj opustiť skupinu?")) void patch({ leave: true }, true); }} className={`${row} text-red-400`}>Opustiť skupinu</button>}
            {!isLeague && <button onClick={clearChat} className={`${row} text-red-400`}>🗑 {isGroup ? "Vymazať históriu (len u mňa)" : "Vymazať konverzáciu (len u mňa)"}</button>}
          </>
        )}
      </div>
      {zoom && <Lightbox src={zoom} onClose={() => setZoom(null)} />}
    </div>
  );
}
