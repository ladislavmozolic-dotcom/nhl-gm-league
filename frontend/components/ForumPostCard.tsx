"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui";
import ForumReactions from "@/components/ForumReactions";
import { editPost, deletePost } from "@/app/forum/actions";
import { friendlyActionError } from "@/lib/client/action-error";

export type PostReact = { emoji: string; count: number; mine: boolean };
export type ForumPostView = {
  id: number; body: string; when: string; edited: boolean; isOP: boolean;
  authorName: string; authorSlug: string | null; authorLogo: string | null;
  canModify: boolean; reacts: PostReact[];
};

export default function ForumPostCard({ post, canReact }: { post: ForumPostView; canReact: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(post.body);
  const [confirmDel, setConfirmDel] = useState(false);
  const [err, setErr] = useState("");

  const quote = () => {
    const snippet = post.body.length > 200 ? post.body.slice(0, 200) + "…" : post.body;
    const q = `> ${post.authorName}: ${snippet.replace(/\n/g, " ")}\n\n`;
    window.dispatchEvent(new CustomEvent("forum-quote", { detail: q }));
  };
  const saveEdit = () => {
    if (!draft.trim()) return;
    start(async () => {
      try {
        const r = await editPost(post.id, draft);
        if (!r.ok) { setErr(r.error); return; }
        setEditing(false); setErr(""); router.refresh();
      } catch (e) { setErr(friendlyActionError(e)); }
    });
  };
  const doDelete = () => start(async () => {
    try {
      const r = await deletePost(post.id);
      if (!r.ok) { setErr(r.error); return; }
      if (r.threadDeleted) router.push(r.category ? `/forum/c/${r.category}` : "/forum");
      else router.refresh();
    } catch (e) { setErr(friendlyActionError(e)); }
  });

  const btn = "text-[11px] font-semibold px-2 py-1 rounded hover:bg-slate-800 transition-colors";

  return (
    <Card bodyClassName="p-4 sm:p-5">
      <div className="flex items-center gap-2.5 mb-2.5">
        {post.authorLogo && <img src={post.authorLogo} alt="" className="w-8 h-8 object-contain" />}
        {post.authorSlug
          ? <Link href={`/teams/${post.authorSlug}`} className="text-sm font-semibold text-slate-100 hover:text-blue-400">{post.authorName}</Link>
          : <span className="text-sm font-semibold text-slate-100">{post.authorName}</span>}
        {post.isOP && <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-600/20 text-blue-300 font-semibold">OP</span>}
        <span className="text-[11px] text-slate-500 ml-auto">{post.when}{post.edited && <span className="text-slate-600 italic"> · upravené</span>}</span>
      </div>

      {editing ? (
        <div className="space-y-2">
          <textarea value={draft} onChange={(e) => setDraft(e.target.value)} rows={5}
            className="w-full resize-y bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-[15px] leading-relaxed text-slate-100 focus:outline-none focus:border-blue-500" />
          <div className="flex justify-end gap-2">
            <button onClick={() => { setEditing(false); setDraft(post.body); setErr(""); }} className="px-3 py-1.5 rounded-lg border border-slate-700 text-slate-300 text-sm hover:bg-slate-800">Zrušiť</button>
            <button onClick={saveEdit} disabled={pending || !draft.trim()} className="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-sm font-semibold">Uložiť</button>
          </div>
        </div>
      ) : (
        <p className="text-[15px] leading-relaxed text-slate-100 whitespace-pre-wrap break-words">{post.body}</p>
      )}

      {err && <p className="text-xs text-red-400 mt-2">{err}</p>}

      <div className="flex items-center gap-1 mt-3 pt-2.5 border-t border-slate-800/60 flex-wrap">
        <ForumReactions postId={post.id} initial={post.reacts} canReact={canReact} />
        <span className="flex-1" />
        {canReact && !editing && <button onClick={quote} className={`${btn} text-slate-400 hover:text-blue-300`}>↩︎ Odpovedať</button>}
        {post.canModify && !editing && (
          <>
            <button onClick={() => { setEditing(true); setConfirmDel(false); }} className={`${btn} text-slate-400 hover:text-amber-300`}>✎ Upraviť</button>
            {confirmDel ? (
              <span className="flex items-center gap-1">
                <button onClick={doDelete} disabled={pending} className={`${btn} text-white bg-rose-600 hover:bg-rose-500`}>Zmazať?</button>
                <button onClick={() => setConfirmDel(false)} className={`${btn} text-slate-400`}>nie</button>
              </span>
            ) : (
              <button onClick={() => setConfirmDel(true)} className={`${btn} text-slate-400 hover:text-rose-300`}>🗑 Zmazať</button>
            )}
          </>
        )}
      </div>
    </Card>
  );
}
