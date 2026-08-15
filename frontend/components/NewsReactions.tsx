"use client";

import { useState, useTransition } from "react";
import { reactToArticle, commentOnArticle } from "@/app/news/actions";

const REACTIONS: Array<{ kind: string; emoji: string }> = [
  { kind: "like", emoji: "👍" }, { kind: "dislike", emoji: "👎" }, { kind: "laugh", emoji: "😄" }, { kind: "heart", emoji: "❤️" },
];

export function ReactionBar({ articleId, counts, mine, canReact }: {
  articleId: number; counts: Record<string, number>; mine: string | null; canReact: boolean;
}) {
  const [pending, start] = useTransition();
  return (
    <div className="flex items-center gap-2 flex-wrap">
      {REACTIONS.map((r) => (
        <button key={r.kind} disabled={!canReact || pending}
          onClick={() => start(() => reactToArticle(articleId, r.kind))}
          className={`px-3 py-1.5 rounded-full border text-sm flex items-center gap-1.5 transition-colors ${mine === r.kind ? "bg-blue-600/30 border-blue-500 text-white" : "border-slate-700 hover:bg-slate-800 text-slate-300"} disabled:opacity-50`}
          title={canReact ? "" : "Sign in as a GM to react"}>
          <span>{r.emoji}</span><span className="tabular-nums">{counts[r.kind] ?? 0}</span>
        </button>
      ))}
    </div>
  );
}

export function CommentBox({ articleId }: { articleId: number }) {
  const [body, setBody] = useState("");
  const [pending, start] = useTransition();
  const submit = () => start(async () => { if (body.trim()) { await commentOnArticle(articleId, body); setBody(""); } });
  return (
    <div className="flex items-start gap-2">
      <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={2} placeholder="Add a comment…"
        className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm" />
      <button onClick={submit} disabled={pending || !body.trim()}
        className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 font-semibold text-sm disabled:opacity-50">Post</button>
    </div>
  );
}
