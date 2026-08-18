"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { replyToThread } from "@/app/forum/actions";

export default function ForumReply({ threadId }: { threadId: number }) {
  const [text, setText] = useState("");
  const [err, setErr] = useState("");
  const [pending, start] = useTransition();
  const router = useRouter();

  const submit = () => {
    if (!text.trim()) return;
    start(async () => {
      const r = await replyToThread(threadId, text);
      if (!r.ok) { setErr(r.error); return; }
      setText(""); setErr(""); router.refresh();
    });
  };

  return (
    <div className="space-y-2">
      <textarea value={text} onChange={(e) => setText(e.target.value)} rows={3} placeholder="Write a reply…"
        className="w-full resize-none bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-blue-500" />
      {err && <p className="text-xs text-red-400">{err}</p>}
      <div className="flex justify-end">
        <button onClick={submit} disabled={pending || !text.trim()} className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-sm font-semibold">{pending ? "Posting…" : "Reply"}</button>
      </div>
    </div>
  );
}
