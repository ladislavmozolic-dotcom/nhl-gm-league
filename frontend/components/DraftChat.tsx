"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { postChatAction } from "@/app/draft/room/actions";

type Msg = { id: number; teamId: number; code: string | null; name: string; logoUrl: string | null; text: string; at: string };

const EMOJIS = ["😀", "😁", "😂", "🤣", "😅", "😎", "😍", "🤔", "😐", "🙄", "😤", "😡", "🥳", "🎉", "🔥", "💯", "👀", "👍", "👎", "🙌", "🤝", "🙏", "💪", "💰", "🏒", "🥅", "🚨", "⭐", "🤞", "😬", "🤷", "🫡"];

export default function DraftChat({ canChat, myTeamId, channel = "draft" }: { canChat: boolean; myTeamId: number | null; channel?: string }) {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [showEmoji, setShowEmoji] = useState(false);
  const sinceRef = useRef(0);
  const boxRef = useRef<HTMLDivElement>(null);

  async function poll() {
    try {
      const r = await fetch(`/api/chat?channel=${channel}&since=${sinceRef.current}`, { cache: "no-store" });
      const j = await r.json();
      if (j.messages?.length) {
        setMsgs((prev) => {
          const ids = new Set(prev.map((m) => m.id));
          const fresh = (j.messages as Msg[]).filter((m) => !ids.has(m.id));
          return fresh.length ? [...prev, ...fresh].slice(-200) : prev;
        });
        sinceRef.current = Math.max(sinceRef.current, ...j.messages.map((m: Msg) => m.id));
      }
    } catch { /* ignore transient errors */ }
  }

  useEffect(() => {
    poll();
    const t = setInterval(poll, 4000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { boxRef.current?.scrollTo({ top: boxRef.current.scrollHeight }); }, [msgs]);

  const send = async () => {
    const t = text.trim();
    if (!t || sending) return;
    setSending(true);
    const r = await postChatAction(t, channel);
    setSending(false);
    if (r.ok) { setText(""); poll(); }
  };

  const time = (iso: string) => new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });

  return (
    <div className="flex flex-col h-[560px] rounded-xl border border-slate-800 bg-slate-900/50">
      <div className="px-4 py-2.5 border-b border-slate-800 flex items-center gap-2">
        <span className="text-sm font-semibold text-slate-200">💬 GM Live Chat</span>
        <span className="text-[10px] text-slate-500">arrange trades · talk draft</span>
      </div>

      <div ref={boxRef} className="flex-1 overflow-y-auto px-3 py-2 space-y-2">
        {msgs.length === 0 && <p className="text-center text-slate-600 text-sm py-8">No messages yet — say hello.</p>}
        {msgs.map((m) => {
          const mine = m.teamId === myTeamId;
          return (
            <div key={m.id} className={`flex gap-2 ${mine ? "flex-row-reverse" : ""}`}>
              {m.logoUrl ? <img src={m.logoUrl} alt="" className="w-6 h-6 object-contain shrink-0 mt-0.5" /> : <div className="w-6 h-6 rounded bg-slate-800 shrink-0" />}
              <div className={`max-w-[78%] ${mine ? "text-right" : ""}`}>
                <div className="text-[10px] text-slate-500">{m.code ?? m.name} · {time(m.at)}</div>
                <div className={`inline-block px-2.5 py-1.5 rounded-lg text-sm ${mine ? "bg-blue-600/80 text-white" : "bg-slate-800 text-slate-200"} break-words`}>{m.text}</div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="p-2.5 border-t border-slate-800">
        {canChat ? (
          <div className="relative flex gap-2">
            {showEmoji && (
              <div className="absolute bottom-12 left-0 z-10 grid grid-cols-8 gap-0.5 p-2 rounded-lg border border-slate-700 bg-slate-900 shadow-xl">
                {EMOJIS.map((e) => (
                  <button key={e} onClick={() => { setText((t) => t + e); setShowEmoji(false); }} className="text-lg hover:bg-slate-800 rounded w-8 h-8">{e}</button>
                ))}
              </div>
            )}
            <button onClick={() => setShowEmoji((v) => !v)} className="rounded-lg border border-slate-700 hover:bg-slate-800 px-2.5 text-lg" title="Emoji">😀</button>
            <input
              value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") send(); }}
              placeholder="Message the league…" maxLength={500}
              className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder:text-slate-600 focus:border-blue-500 outline-none"
            />
            <button onClick={send} disabled={sending || !text.trim()} className="rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-sm font-medium px-4">Send</button>
          </div>
        ) : (
          <p className="text-xs text-slate-500 text-center py-1"><Link href="/login" className="text-blue-400 hover:underline">Sign in as a GM</Link> to join the chat.</p>
        )}
      </div>
    </div>
  );
}
