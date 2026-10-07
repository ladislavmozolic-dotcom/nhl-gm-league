"use client";

import { useState, useTransition, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { replyToThread } from "@/app/forum/actions";
import { friendlyActionError } from "@/lib/client/action-error";
import ForumEditorToolbar from "@/components/forum/ForumEditorToolbar";

export default function ForumReply({ threadId }: { threadId: number }) {
  const [text, setText] = useState("");
  const [err, setErr] = useState("");
  const [pending, start] = useTransition();
  const router = useRouter();
  const ref = useRef<HTMLTextAreaElement>(null);

  // a "Reply" or "Quote" click on a post dispatches this event with a quote to append here
  useEffect(() => {
    const onQuote = (e: Event) => {
      const q = (e as CustomEvent<string>).detail || "";
      setText((t) => (t ? t + "\n" + q : q));
      const el = ref.current;
      if (el) {
        el.focus();
        el.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    };
    window.addEventListener("forum-quote", onQuote as EventListener);
    return () => window.removeEventListener("forum-quote", onQuote as EventListener);
  }, []);

  const submit = () => {
    if (!text.trim()) return;
    start(async () => {
      try {
        const r = await replyToThread(threadId, text);
        if (!r.ok) {
          setErr(r.error);
          return;
        }
        setText("");
        setErr("");
        router.refresh();
      } catch (e) {
        setErr(friendlyActionError(e));
      }
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      e.preventDefault();
      submit();
    }
  };

  return (
    <div className="space-y-3">
      <div className="overflow-hidden rounded-xl border border-slate-700 bg-slate-950 shadow-md">
        <ForumEditorToolbar textareaRef={ref} onInsert={(val) => setText(val)} />
        <textarea
          ref={ref}
          id="forum-reply-box"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          rows={6}
          placeholder="Napíš odpoveď do diskusie... (podporuje BBCode a Markdown, Ctrl+Enter pre odoslanie)"
          className="w-full resize-y bg-transparent p-3.5 text-[14px] leading-relaxed text-slate-100 placeholder:text-slate-500 focus:outline-none"
        />
      </div>

      {err && <p className="text-xs text-rose-400 font-medium px-1">{err}</p>}

      <div className="flex items-center justify-between pt-1">
        <span className="text-[11px] text-slate-500 hidden sm:inline-block">
          Tip: Použi tlačidlá na formátovanie alebo <span className="font-mono bg-slate-800 px-1 py-0.5 rounded text-slate-400">Ctrl+Enter</span> pre rýchle odoslanie.
        </span>
        <div className="flex items-center gap-2 ml-auto">
          {text.trim() && (
            <button
              type="button"
              onClick={() => setText("")}
              className="px-3 py-2 text-xs text-slate-400 hover:text-slate-200 transition-colors"
            >
              Vymazať
            </button>
          )}
          <button
            onClick={submit}
            disabled={pending || !text.trim()}
            className="px-5 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-sm font-bold transition-all shadow-md shadow-blue-900/30 flex items-center gap-2 cursor-pointer disabled:cursor-not-allowed"
          >
            {pending ? (
              <>
                <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>Odosielam…</span>
              </>
            ) : (
              <>
                <span>💬</span>
                <span>Odoslať odpoveď</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
