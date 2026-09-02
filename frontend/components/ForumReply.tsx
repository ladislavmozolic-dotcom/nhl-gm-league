"use client";

import { useState, useTransition, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { replyToThread } from "@/app/forum/actions";
import { friendlyActionError } from "@/lib/client/action-error";

export default function ForumReply({ threadId }: { threadId: number }) {
  const [text, setText] = useState("");
  const [err, setErr] = useState("");
  const [pending, start] = useTransition();
  const router = useRouter();
  const ref = useRef<HTMLTextAreaElement>(null);

  // a "Reply" click on a post dispatches this event with a quote to prepend here
  useEffect(() => {
    const onQuote = (e: Event) => {
      const q = (e as CustomEvent<string>).detail || "";
      setText((t) => (t ? t + "\n" + q : q));
      const el = ref.current;
      if (el) { el.focus(); el.scrollIntoView({ behavior: "smooth", block: "center" }); }
    };
    window.addEventListener("forum-quote", onQuote as EventListener);
    return () => window.removeEventListener("forum-quote", onQuote as EventListener);
  }, []);

  const submit = () => {
    if (!text.trim()) return;
    start(async () => {
      try {
        const r = await replyToThread(threadId, text);
        if (!r.ok) { setErr(r.error); return; }
        setText(""); setErr(""); router.refresh();
      } catch (e) { setErr(friendlyActionError(e)); }
    });
  };

  return (
    <div className="space-y-2">
      <textarea ref={ref} id="forum-reply-box" value={text} onChange={(e) => setText(e.target.value)} rows={5} placeholder="Napíš odpoveď…"
        className="w-full resize-y bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-[15px] leading-relaxed text-slate-100 focus:outline-none focus:border-blue-500" />
      {err && <p className="text-xs text-red-400">{err}</p>}
      <div className="flex justify-end">
        <button onClick={submit} disabled={pending || !text.trim()} className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-sm font-semibold">{pending ? "Posting…" : "Reply"}</button>
      </div>
    </div>
  );
}
