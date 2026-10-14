"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type TeamLite = { id: number; code: string | null; name: string; logoUrl: string | null; gmNickname: string | null };
type Msg = { id: number; roomId: number; fromTeamId: number; body: string; at: string; deleted: boolean; replyTo: { id: number; fromTeamId: number; body: string } | null };
type Room = { id: number; kind: string; otherTeamId: number | null; unread: number; last: Msg | null };
type Boot = { me: TeamLite; admin: boolean; enabled: boolean; muted: boolean; leagueRoomId: number; teams: TeamLite[]; rooms: Room[]; vapid: string | null };

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
      {t?.logoUrl ? <img src={t.logoUrl} alt="" className="w-[75%] h-[75%] object-contain" /> : <span className="text-xs font-bold text-slate-400">{t?.code ?? "?"}</span>}
    </div>
  );
}

export default function ChatApp() {
  const [boot, setBoot] = useState<Boot | null>(null);
  const [err, setErr] = useState("");
  const [active, setActive] = useState<number | null>(null); // roomId; null = list (mobile)
  const [pendingDm, setPendingDm] = useState<number | null>(null); // teamId of a DM with no room yet
  const [msgs, setMsgs] = useState<Record<number, Msg[]>>({});
  const [peerRead, setPeerRead] = useState<Record<number, number>>({});
  const [picker, setPicker] = useState(false);
  const [settings, setSettings] = useState(false);
  const activeRef = useRef<number | null>(null);
  activeRef.current = active;

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
    document.querySelectorAll('link[rel="manifest"]').forEach((l) => { if (!(l as HTMLLinkElement).href.includes("/chat/")) l.remove(); });
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/chat-sw.js", { scope: "/chat" }).catch(() => {});
  }, []);

  const loadRoom = useCallback(async (roomId: number) => {
    const r = await fetch(`/api/im/messages?roomId=${roomId}`);
    if (!r.ok) return;
    const j = await r.json();
    setMsgs((m) => ({ ...m, [roomId]: j.messages }));
    setPeerRead((p) => ({ ...p, [roomId]: j.peerRead }));
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
            const mineMsg = m.fromTeamId === b.me.id;
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
      es.addEventListener("reads", (e) => {
        const rs = JSON.parse((e as MessageEvent).data) as { roomId: number; lastReadId: number }[];
        setPeerRead((p) => { const n = { ...p }; rs.forEach((r) => (n[r.roomId] = r.lastReadId)); return n; });
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

  if (err) return <div className="h-full flex items-center justify-center text-slate-400 p-6 text-center">{err}</div>;
  if (!boot) return <div className="h-full flex items-center justify-center text-slate-500">Načítavam…</div>;

  const sortedRooms = [...boot.rooms].sort((a, b) => {
    if (a.kind === "league" && b.kind !== "league") return -1;
    if (b.kind === "league" && a.kind !== "league") return 1;
    return (b.last?.id ?? 0) - (a.last?.id ?? 0);
  }).filter((r) => r.kind === "league" || r.last);

  const roomTitle = (r: Room) => (r.kind === "league" ? "# Liga" : teamMap.get(r.otherTeamId ?? 0)?.name ?? "GM");
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
        {!boot.enabled && <div className="bg-amber-500/10 text-amber-300 text-xs px-4 py-2">Chat je pre ostatných GM zatiaľ vypnutý (vidíš ho ako admin).</div>}
        <div className="flex-1 overflow-y-auto">
          {sortedRooms.map((r) => {
            const other = r.otherTeamId ? teamMap.get(r.otherTeamId) : null;
            const lastMine = r.last?.fromTeamId === boot.me.id;
            return (
              <button key={r.id} onClick={() => { setPendingDm(null); setActive(r.id); }}
                className={`w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-slate-900 ${active === r.id ? "bg-slate-900" : ""}`}>
                {r.kind === "league" ? <div className="w-12 h-12 shrink-0 rounded-full bg-blue-600/20 flex items-center justify-center text-xl">🏒</div> : <Logo t={other} size={48} />}
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2">
                    <span className="font-medium truncate flex-1">{roomTitle(r)}</span>
                    {r.last && <span className="text-[11px] text-slate-500">{hm(r.last.at)}</span>}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-sm truncate flex-1 ${r.unread ? "text-slate-200" : "text-slate-500"}`}>
                      {r.last ? (r.last.deleted ? "🚫 Správa bola odstránená" : `${lastMine ? "Ty: " : r.kind === "league" ? `${teamMap.get(r.last.fromTeamId)?.code ?? ""}: ` : ""}${r.last.body}`) : "Ešte tu nikto nenapísal"}
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
            peerRead={active != null ? peerRead[active] ?? 0 : 0}
            title={activeRoom ? roomTitle(activeRoom) : teamMap.get(pendingDm ?? 0)?.name ?? ""}
            onBack={() => { setActive(null); setPendingDm(null); }}
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
      {settings && <Settings boot={boot} teamMap={teamMap} onClose={() => setSettings(false)} reload={load} />}
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
  peerRead: number; title: string; onBack: () => void; onSent: (roomId: number, m: Msg) => void;
}) {
  const { boot, teamMap, room, dmTeamId, messages, peerRead, title, onBack, onSent } = props;
  const [text, setText] = useState("");
  const [reply, setReply] = useState<Msg | null>(null);
  const [menu, setMenu] = useState<Msg | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const endRef = useRef<HTMLDivElement>(null);
  const isLeague = room?.kind === "league";
  const other = dmTeamId ? teamMap.get(dmTeamId) : null;
  const canWrite = !(isLeague && boot.muted);

  useEffect(() => { endRef.current?.scrollIntoView({ block: "end" }); }, [messages?.length]);

  async function send() {
    const body = text.trim();
    if (!body || sending) return;
    setSending(true); setError("");
    const r = await fetch("/api/im/send", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...(room ? { roomId: room.id } : { toTeamId: dmTeamId }), body, replyToId: reply?.id }),
    });
    setSending(false);
    if (!r.ok) { setError(r.status === 403 ? "Nemáš oprávnenie písať." : "Nepodarilo sa odoslať."); return; }
    const j = await r.json();
    setText(""); setReply(null);
    onSent(j.roomId, j.message);
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
        {isLeague ? <div className="w-10 h-10 rounded-full bg-blue-600/20 flex items-center justify-center text-lg">🏒</div> : <Logo t={other} size={40} />}
        <div className="min-w-0"><div className="font-semibold truncate">{title}</div><div className="text-xs text-slate-500">{isLeague ? "Verejný kanál celej ligy" : other?.gmNickname ?? "Súkromná konverzácia"}</div></div>
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
          const showName = isLeague && !mine && (!prev || prev.fromTeamId !== m.fromTeamId || showDay);
          return (
            <div key={m.id}>
              {showDay && <div className="text-center my-3"><span className="text-[11px] text-slate-400 bg-slate-800/70 rounded-full px-3 py-1">{day}</span></div>}
              <div className={`flex gap-2 ${mine ? "justify-end" : "justify-start"}`}>
                {isLeague && !mine && (showName ? <Logo t={t} size={28} /> : <div className="w-7 shrink-0" />)}
                <button onClick={() => !m.deleted && setMenu(m)}
                  className={`max-w-[80%] text-left rounded-2xl px-3 py-2 ${mine ? "bg-blue-600 rounded-br-md" : "bg-slate-800 rounded-bl-md"} ${m.deleted ? "opacity-60 italic" : ""}`}>
                  {showName && <div className="text-[11px] font-semibold text-blue-300 mb-0.5">{t?.gmNickname ?? t?.code ?? "GM"} · {t?.code}</div>}
                  {m.replyTo && !m.deleted && (
                    <div className="border-l-2 border-white/40 pl-2 mb-1 text-xs opacity-80">
                      <div className="font-semibold">{m.replyTo.fromTeamId === boot.me.id ? "Ty" : teamMap.get(m.replyTo.fromTeamId)?.code}</div>
                      <div className="line-clamp-2">{m.replyTo.body || "🚫 odstránená"}</div>
                    </div>
                  )}
                  <div className="whitespace-pre-wrap break-words text-[15px]">{m.deleted ? "🚫 Správa bola odstránená" : m.body}</div>
                  <div className="text-[10px] opacity-60 text-right mt-0.5">
                    {hm(m.at)}{mine && !isLeague && !m.deleted && <span className={m.id <= peerRead ? "text-sky-300 opacity-100" : ""}> {m.id <= peerRead ? "✓✓" : "✓"}</span>}
                  </div>
                </button>
              </div>
            </div>
          );
        })}
        <div ref={endRef} />
      </div>

      {error && <div className="bg-red-500/10 text-red-300 text-sm px-4 py-2">{error}</div>}
      {reply && (
        <div className="flex items-center gap-2 px-4 py-2 bg-slate-900 border-t border-slate-800 text-sm">
          <div className="flex-1 min-w-0 border-l-2 border-blue-500 pl-2"><div className="text-xs text-blue-300">Odpoveď</div><div className="truncate text-slate-400">{reply.body}</div></div>
          <button onClick={() => setReply(null)} className="text-slate-400">✕</button>
        </div>
      )}
      {canWrite ? (
        <div className="flex items-end gap-2 p-3 border-t border-slate-800 bg-slate-900">
          <textarea value={text} onChange={(e) => setText(e.target.value)} rows={1} maxLength={2000} placeholder="Správa"
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && window.matchMedia("(pointer:fine)").matches) { e.preventDefault(); void send(); } }}
            className="flex-1 resize-none max-h-32 rounded-2xl bg-slate-800 px-4 py-2.5 text-base outline-none" />
          <button onClick={send} disabled={!text.trim() || sending} className="w-11 h-11 rounded-full bg-blue-600 disabled:opacity-40 text-lg" aria-label="Odoslať">➤</button>
        </div>
      ) : <div className="p-4 text-center text-sm text-amber-300 bg-slate-900 border-t border-slate-800">Komisár ti dočasne zakázal písať do ligového kanála.</div>}

      {menu && (
        <Sheet title="Správa" onClose={() => setMenu(null)}>
          <div className="px-5 py-3 text-sm text-slate-400 line-clamp-3">{menu.body}</div>
          <button onClick={() => { setReply(menu); setMenu(null); }} className="w-full text-left px-5 py-3 hover:bg-slate-800">↩︎ Odpovedať</button>
          <button onClick={() => { void navigator.clipboard?.writeText(menu.body); setMenu(null); }} className="w-full text-left px-5 py-3 hover:bg-slate-800">⧉ Kopírovať</button>
          {(menu.fromTeamId === boot.me.id || (isLeague && boot.admin)) && (
            <button onClick={() => del(menu)} className="w-full text-left px-5 py-3 hover:bg-slate-800 text-red-400">🗑 {menu.fromTeamId === boot.me.id ? "Odstrániť" : "Odstrániť (moderácia)"}</button>
          )}
        </Sheet>
      )}
    </>
  );
}

function Settings({ boot, teamMap, onClose, reload }: { boot: Boot; teamMap: Map<number, TeamLite>; onClose: () => void; reload: () => Promise<void> }) {
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
      <button onClick={() => { window.location.href = "/"; }} className="w-full text-left px-5 py-3 mt-2 text-slate-400 hover:bg-slate-800">← Späť na stránku ligy</button>
    </Sheet>
  );
}
