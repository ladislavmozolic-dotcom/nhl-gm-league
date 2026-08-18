"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import Link from "next/link";
import { sendDm, getConversation, listConversations, type ConversationMsg, type ConvTeam } from "@/app/messages/actions";

const EMOJIS = ["👍", "😂", "🔥", "🏒", "🥅", "💰", "🤝", "🤔", "😅", "😎", "👀", "🙌", "❌", "✅", "😱", "🎯", "💪", "🍺", "🫡", "🤯"];

export default function Messenger({ initialTeams, initialActive }: { initialTeams: ConvTeam[]; initialActive: number | null }) {
  const [teams, setTeams] = useState<ConvTeam[]>(initialTeams);
  const [active, setActive] = useState<number | null>(initialActive);
  const [msgs, setMsgs] = useState<ConversationMsg[]>([]);
  const [text, setText] = useState("");
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  const activeTeam = teams.find((t) => t.id === active) ?? null;

  const loadConvo = useCallback(async (id: number) => {
    const r = await getConversation(id);
    if (r.ok) setMsgs(r.messages);
  }, []);

  const refreshList = useCallback(async () => {
    const r = await listConversations();
    if (r.ok) setTeams(r.teams);
  }, []);

  // poll the open conversation + the list every 5s
  useEffect(() => {
    if (active == null) return;
    loadConvo(active);
    const t = setInterval(() => { loadConvo(active); refreshList(); }, 5000);
    return () => clearInterval(t);
  }, [active, loadConvo, refreshList]);

  useEffect(() => { endRef.current?.scrollIntoView({ block: "end" }); }, [msgs]);

  const open = (id: number) => {
    setActive(id);
    setTeams((ts) => ts.map((t) => (t.id === id ? { ...t, unread: 0 } : t)));
  };

  const send = async (body?: string, tradeUrl?: string) => {
    if (active == null) return;
    const b = (body ?? text).trim();
    if (!b) return;
    setSending(true);
    const r = await sendDm(active, b, tradeUrl);
    setSending(false);
    if (r.ok) { setText(""); setEmojiOpen(false); await loadConvo(active); }
  };

  const fmtTime = (iso: string) => new Date(iso).toLocaleString("sk-SK", { day: "numeric", month: "numeric", hour: "2-digit", minute: "2-digit" });

  return (
    <div className="grid grid-cols-1 md:grid-cols-[260px_1fr] gap-4 h-[70vh] min-h-[460px]">
      {/* conversation list */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/50 overflow-y-auto">
        <div className="px-4 py-2.5 text-xs uppercase tracking-wider text-slate-500 border-b border-slate-800 sticky top-0 bg-slate-900">GMs</div>
        {teams.map((t) => (
          <button key={t.id} onClick={() => open(t.id)}
            className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-left border-b border-slate-800/50 transition-colors ${active === t.id ? "bg-blue-600/15" : "hover:bg-slate-800/40"}`}>
            {t.logoUrl && <img src={t.logoUrl} alt="" className="w-7 h-7 object-contain shrink-0" />}
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium text-slate-200 truncate">{t.code ?? t.name}</div>
              <div className="text-[11px] text-slate-500 truncate">{t.hasGm ? (t.gm || "GM") : "no GM yet"}</div>
            </div>
            {t.unread > 0 && <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-red-600 text-white text-[10px] font-bold grid place-items-center shrink-0">{t.unread}</span>}
          </button>
        ))}
      </div>

      {/* active conversation */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/50 flex flex-col overflow-hidden">
        {activeTeam ? (
          <>
            <div className="flex items-center gap-2.5 px-4 py-2.5 border-b border-slate-800 bg-slate-900/70">
              {activeTeam.logoUrl && <img src={activeTeam.logoUrl} alt="" className="w-7 h-7 object-contain" />}
              <div className="font-semibold text-slate-100 flex-1 truncate">{activeTeam.name}</div>
              <Link href={`/trades/build?opp=${activeTeam.id}`} className="px-3 py-1.5 rounded-lg bg-emerald-600/80 hover:bg-emerald-500 text-white text-xs font-semibold whitespace-nowrap">🔁 Propose trade</Link>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
              {msgs.length === 0 && <p className="text-center text-slate-600 text-sm py-8">No messages yet — say hi 👋</p>}
              {msgs.map((m) => (
                <div key={m.id} className={`flex ${m.mine ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[75%] rounded-2xl px-3.5 py-2 text-sm ${m.mine ? "bg-blue-600 text-white" : "bg-slate-800 text-slate-100"}`}>
                    <div className="whitespace-pre-wrap break-words">{m.body}</div>
                    {m.tradeUrl && <Link href={m.tradeUrl} className={`mt-1 inline-block text-xs font-semibold underline ${m.mine ? "text-blue-100" : "text-emerald-400"}`}>🔁 View trade proposal →</Link>}
                    <div className={`mt-0.5 text-[10px] flex items-center gap-1 justify-end ${m.mine ? "text-blue-200/80" : "text-slate-500"}`}>
                      {fmtTime(m.at)}
                      {m.mine && <span title={m.read ? "Read" : "Delivered"}>{m.read ? "✓✓" : "✓"}</span>}
                    </div>
                  </div>
                </div>
              ))}
              <div ref={endRef} />
            </div>

            <div className="border-t border-slate-800 p-3 relative">
              {emojiOpen && (
                <div className="absolute bottom-16 left-3 bg-[#0e1e35] border border-slate-700 rounded-xl p-2 grid grid-cols-8 gap-1 shadow-xl z-10">
                  {EMOJIS.map((e) => <button key={e} onClick={() => setText((t) => t + e)} className="text-xl hover:bg-slate-800 rounded p-1">{e}</button>)}
                </div>
              )}
              <div className="flex items-end gap-2">
                <button onClick={() => setEmojiOpen((o) => !o)} className="text-xl px-2 py-1.5 rounded-lg hover:bg-slate-800" title="Emoji">😊</button>
                <textarea value={text} onChange={(e) => setText(e.target.value)} rows={1} placeholder="Message…"
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
                  className="flex-1 resize-none bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-blue-500 max-h-32" />
                <button onClick={() => send()} disabled={sending || !text.trim()}
                  className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-sm font-semibold">Send</button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 grid place-items-center text-slate-500 text-sm">Select a GM to start chatting.</div>
        )}
      </div>
    </div>
  );
}
