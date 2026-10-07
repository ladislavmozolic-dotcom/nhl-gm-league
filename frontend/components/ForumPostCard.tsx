"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import ForumReactions from "@/components/ForumReactions";
import ForumPostContent from "@/components/forum/ForumPostContent";
import { editPost, deletePost } from "@/app/forum/actions";
import { friendlyActionError } from "@/lib/client/action-error";

export type PostReact = { emoji: string; count: number; mine: boolean };

export type ForumPostView = {
  id: number;
  body: string;
  when: string;
  fullDate?: string;
  edited: boolean;
  isOP: boolean;
  postNumber: number;
  authorName: string;
  authorSlug: string | null;
  authorLogo: string | null;
  authorRole?: string;
  authorRoleBadge?: { label: string; bg: string; text: string; border: string };
  authorTeamCode?: string | null;
  authorTeamName?: string | null;
  authorPostsCount?: number;
  authorIsOnline?: boolean;
  isNewPost?: boolean;
  canModify: boolean;
  reacts: PostReact[];
};

export default function ForumPostCard({
  post,
  canReact,
}: {
  post: ForumPostView;
  canReact: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(post.body);
  const [confirmDel, setConfirmDel] = useState(false);
  const [err, setErr] = useState("");

  const quote = () => {
    // Generate phpBB / markdown quote
    const snippet = post.body.length > 300 ? post.body.slice(0, 300) + "…" : post.body;
    const q = `[quote="${post.authorName}"]\n${snippet}\n[/quote]\n\n`;
    window.dispatchEvent(new CustomEvent("forum-quote", { detail: q }));
  };

  const saveEdit = () => {
    if (!draft.trim()) return;
    start(async () => {
      try {
        const r = await editPost(post.id, draft);
        if (!r.ok) {
          setErr(r.error);
          return;
        }
        setEditing(false);
        setErr("");
        router.refresh();
      } catch (e) {
        setErr(friendlyActionError(e));
      }
    });
  };

  const doDelete = () =>
    start(async () => {
      try {
        const r = await deletePost(post.id);
        if (!r.ok) {
          setErr(r.error);
          return;
        }
        if (r.threadDeleted) {
          router.push(r.category ? `/forum/c/${r.category}` : "/forum");
        } else {
          router.refresh();
        }
      } catch (e) {
        setErr(friendlyActionError(e));
      }
    });

  const btn =
    "text-[12px] font-semibold px-2.5 py-1 rounded bg-slate-800/80 border border-slate-700/70 hover:bg-slate-700 text-slate-300 hover:text-white transition-all shadow-sm flex items-center gap-1";

  const badge = post.authorRoleBadge ?? {
    label: "General Manager",
    bg: "bg-slate-800",
    text: "text-slate-300",
    border: "border-slate-700",
  };

  return (
    <div
      id={`post-${post.id}`}
      className={`rounded-xl border border-slate-800/90 ${
        post.isNewPost
          ? "border-l-4 border-l-rose-500 bg-rose-950/15"
          : "bg-slate-900/80"
      } shadow-lg shadow-black/25 overflow-hidden transition-colors`}
    >
      <div className="flex flex-col md:flex-row">
        {/* Left Column: phpBB User Profile Box (Postbit) */}
        <aside className="w-full md:w-56 shrink-0 bg-slate-950/60 p-4 border-b md:border-b-0 md:border-r border-slate-800/80 flex flex-row md:flex-col items-center md:items-center text-center gap-3 md:gap-2">
          {/* Avatar / Logo with online status indicator */}
          <div className="relative shrink-0">
            {post.authorLogo ? (
              <img
                src={post.authorLogo}
                alt=""
                className="w-14 h-14 md:w-16 md:h-16 object-contain p-1 rounded-xl bg-slate-900 border border-slate-800 shadow-md"
              />
            ) : (
              <div className="w-14 h-14 md:w-16 md:h-16 rounded-xl bg-slate-800 border border-slate-700 grid place-items-center text-base font-bold text-slate-300 shadow-md">
                {(post.authorTeamCode || post.authorName).slice(0, 3)}
              </div>
            )}
            {post.authorIsOnline && (
              <span
                title="Online"
                className="absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full bg-emerald-500 border-2 border-slate-950 ring-1 ring-emerald-400/50"
              />
            )}
          </div>

          {/* User details */}
          <div className="min-w-0 flex-1 md:w-full text-left md:text-center space-y-1">
            <div className="flex md:flex-col items-center md:justify-center gap-1.5 flex-wrap">
              {post.authorSlug ? (
                <Link
                  href={`/teams/${post.authorSlug}`}
                  className="font-bold text-slate-100 hover:text-blue-400 text-sm md:text-base leading-tight truncate block max-w-full"
                >
                  {post.authorName}
                </Link>
              ) : (
                <span className="font-bold text-slate-100 text-sm md:text-base leading-tight truncate block max-w-full">
                  {post.authorName}
                </span>
              )}
              {post.isOP && (
                <span
                  title="Thread starter (Original Poster)"
                  className="text-[10px] font-black uppercase tracking-wider px-1.5 py-0.2 rounded bg-blue-600/25 border border-blue-500/40 text-blue-300"
                >
                  OP
                </span>
              )}
            </div>

            {/* Role badge */}
            <div className="pt-0.5">
              <span
                className={`inline-block text-[10px] font-semibold px-2 py-0.5 rounded-md border ${badge.bg} ${badge.text} ${badge.border}`}
              >
                {badge.label}
              </span>
            </div>

            {/* Team name & info */}
            {post.authorTeamName && (
              <div className="text-[11px] text-slate-400 truncate hidden md:block">
                {post.authorTeamName}
              </div>
            )}

            {/* Post stats counter */}
            <div className="text-[11px] text-slate-500 pt-1 border-t border-slate-800/60 hidden md:flex items-center justify-center gap-1.5">
              <span>Posts:</span>
              <span className="font-bold text-slate-300 tabular-nums">
                {post.authorPostsCount ?? "—"}
              </span>
            </div>
          </div>
        </aside>

        {/* Right Column: Post Body & Header & Controls */}
        <div className="flex-1 min-w-0 flex flex-col justify-between p-4 sm:p-5">
          <div>
            {/* Post Header Bar */}
            <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-800/80 text-xs text-slate-400">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-slate-500">🕐</span>
                <span title={post.fullDate || post.when} className="text-slate-300 font-medium">
                  {post.fullDate || post.when}
                </span>
                {post.isNewPost && (
                  <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-rose-500 text-white shadow-sm flex items-center gap-1 animate-pulse">
                    <span className="w-1.5 h-1.5 rounded-full bg-white" />
                    <span>NEW POST</span>
                  </span>
                )}
                {post.edited && (
                  <span className="text-[10px] text-slate-500 italic bg-slate-800/50 px-1.5 py-0.5 rounded border border-slate-800">
                    edited
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <a
                  href={`#post-${post.id}`}
                  className="font-mono text-[11px] font-semibold text-slate-500 hover:text-blue-400 hover:underline"
                >
                  #{post.postNumber}
                </a>
              </div>
            </div>

            {/* Post Content */}
            {editing ? (
              <div className="space-y-3">
                <textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  rows={6}
                  className="w-full resize-y bg-slate-950 border border-slate-700 rounded-lg p-3 text-[14px] leading-relaxed text-slate-100 focus:outline-none focus:border-blue-500 shadow-inner"
                />
                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => {
                      setEditing(false);
                      setDraft(post.body);
                      setErr("");
                    }}
                    className="px-3.5 py-1.5 rounded-lg border border-slate-700 text-slate-300 text-xs font-semibold hover:bg-slate-800"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={saveEdit}
                    disabled={pending || !draft.trim()}
                    className="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-xs font-bold shadow"
                  >
                    Save changes
                  </button>
                </div>
              </div>
            ) : (
              <ForumPostContent content={post.body} />
            )}

            {err && <p className="text-xs text-red-400 mt-2">{err}</p>}
          </div>

          {/* Post Footer: Reactions & Actions */}
          <div className="mt-5 pt-3 border-t border-slate-800/80 flex items-center justify-between flex-wrap gap-2">
            <ForumReactions postId={post.id} initial={post.reacts} canReact={canReact} />

            <div className="flex items-center gap-1.5 ml-auto">
              {canReact && !editing && (
                <button
                  onClick={quote}
                  className={`${btn} hover:text-blue-400 hover:border-blue-500/50`}
                  title="Quote this post in a reply"
                >
                  <span>❝</span>
                  <span>Quote</span>
                </button>
              )}
              {post.canModify && !editing && (
                <>
                  <button
                    onClick={() => {
                      setEditing(true);
                      setConfirmDel(false);
                    }}
                    className={`${btn} hover:text-amber-300 hover:border-amber-500/50`}
                    title="Edit post"
                  >
                    <span>✎</span>
                    <span>Edit</span>
                  </button>
                  {confirmDel ? (
                    <span className="flex items-center gap-1 bg-rose-950/40 p-0.5 rounded border border-rose-500/40">
                      <button
                        onClick={doDelete}
                        disabled={pending}
                        className="text-[11px] font-bold px-2 py-0.5 rounded bg-rose-600 hover:bg-rose-500 text-white"
                      >
                        Really delete?
                      </button>
                      <button
                        onClick={() => setConfirmDel(false)}
                        className="text-[11px] px-1.5 py-0.5 text-slate-400 hover:text-white"
                      >
                        Nie
                      </button>
                    </span>
                  ) : (
                    <button
                      onClick={() => setConfirmDel(true)}
                      className={`${btn} hover:text-rose-400 hover:border-rose-500/50`}
                      title="Delete post"
                    >
                      <span>🗑</span>
                      <span>Delete</span>
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
