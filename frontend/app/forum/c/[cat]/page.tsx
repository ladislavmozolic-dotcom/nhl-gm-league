import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Card, BackPill } from "@/components/ui";
import { getTeamSession, isAdmin } from "@/lib/auth";
import { CATEGORIES, CAT_META, type Category } from "../../categories";
import ForumBreadcrumbs from "@/components/forum/ForumBreadcrumbs";
import NewThreadForm from "@/components/forum/NewThreadForm";
import MarkAllReadButton from "@/components/forum/MarkAllReadButton";

export const dynamic = "force-dynamic";

const ago = (d: Date) => {
  const s = Math.floor((Date.now() - d.getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  const days = Math.floor(s / 86400);
  if (days === 1) return "yesterday";
  if (days < 30) return `${days}d ago`;
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
};

export default async function CategoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ cat: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { cat } = await params;
  const { error } = await searchParams;
  if (!(CATEGORIES as readonly string[]).includes(cat)) notFound();
  const category = cat as Category;
  const m = CAT_META[category];

  const me = await getTeamSession();
  const [admin, myTeam, threads] = await Promise.all([
    isAdmin(),
    me
      ? prisma.team.findUnique({
          where: { id: me },
          select: { code: true, forumSeenAt: true },
        })
      : null,
    prisma.forumThread.findMany({
      where: { category },
      orderBy: [{ pinned: "desc" }, { lastPostAt: "desc" }],
      take: 200,
      select: {
        id: true,
        title: true,
        pinned: true,
        createdAt: true,
        lastPostAt: true,
        team: {
          select: {
            code: true,
            name: true,
            logoUrl: true,
            gmNickname: true,
            slug: true,
          },
        },
        posts: {
          orderBy: { id: "desc" },
          take: 1,
          select: {
            createdAt: true,
            team: {
              select: {
                code: true,
                name: true,
                logoUrl: true,
                gmNickname: true,
              },
            },
          },
        },
        _count: { select: { posts: true } },
      },
    }),
  ]);

  const lastSeen = myTeam?.forumSeenAt ?? new Date(0);
  const canPost = me != null && (!m.adminOnly || admin);

  const pinnedThreads = threads.filter((t) => t.pinned);
  const normalThreads = threads.filter((t) => !t.pinned);

  const renderThreadRow = (t: (typeof threads)[0]) => {
    const lastPost = t.posts[0];
    const repliesCount = Math.max(0, t._count.posts - 1);
    const isHot = repliesCount >= 10;
    const isUnread =
      me != null &&
      lastPost != null &&
      lastPost.team.code !== myTeam?.code &&
      lastPost.createdAt > lastSeen;

    return (
      <div
        key={t.id}
        className={`group flex flex-col sm:flex-row sm:items-center justify-between p-3.5 sm:p-4 gap-3 transition-colors ${
          isUnread
            ? "bg-rose-950/20 border-l-4 border-l-rose-500 hover:bg-rose-950/30"
            : t.pinned
            ? "bg-amber-950/10 hover:bg-amber-950/20 border-l-4 border-l-amber-500/50"
            : "hover:bg-slate-800/40"
        } border-b border-slate-800/60 last:border-b-0`}
      >
        {/* Left: Icon & Title & Author */}
        <div className="flex items-start sm:items-center gap-3.5 min-w-0 flex-1">
          <div className="relative shrink-0 mt-0.5 sm:mt-0">
            {t.pinned ? (
              <div
                title="Pinned thread"
                className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-400 grid place-items-center text-sm shadow-sm"
              >
                📌
              </div>
            ) : isUnread ? (
              <div
                title="New unread post"
                className="w-9 h-9 rounded-xl bg-rose-500/20 border border-rose-500/50 text-rose-300 grid place-items-center text-sm shadow-[0_0_12px_-2px_rgba(244,63,94,0.4)] ring-1 ring-rose-500/40"
              >
                💬
              </div>
            ) : isHot ? (
              <div
                title="Hot topic (> 10 replies)"
                className="w-9 h-9 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-400 grid place-items-center text-sm shadow-sm"
              >
                🔥
              </div>
            ) : (
              <div
                title="Discussion thread"
                className="w-9 h-9 rounded-xl bg-slate-800 border border-slate-700/60 text-slate-400 grid place-items-center text-sm shadow-sm"
              >
                💬
              </div>
            )}
            {isUnread && (
              <span
                title="New posts"
                className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-rose-500 border-2 border-slate-950 animate-pulse"
              />
            )}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              {t.pinned && (
                <span className="text-[10px] font-black uppercase tracking-wider px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 shrink-0">
                  Pinned
                </span>
              )}
              {isUnread && (
                <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-rose-500 text-white shadow-sm shrink-0 flex items-center gap-1 animate-pulse">
                  <span>NEW</span>
                </span>
              )}
              <Link
                href={`/forum/${t.id}`}
                className={`text-sm sm:text-base font-bold transition-colors truncate block ${
                  isUnread
                    ? "text-white font-black group-hover:text-blue-300"
                    : "text-slate-100 group-hover:text-blue-400"
                }`}
              >
                {t.title}
              </Link>
            </div>
            <div className="text-xs text-slate-500 mt-0.5 flex items-center gap-1.5 flex-wrap">
              <span>Started by</span>
              <span className="font-medium text-slate-400">
                {t.team.gmNickname || t.team.code || t.team.name}
              </span>
              <span>•</span>
              <span>{ago(t.createdAt)}</span>
            </div>
          </div>
        </div>

        {/* Center / Stats (Replies & Posts) */}
        <div className="flex items-center justify-between sm:justify-center gap-6 shrink-0 sm:w-36 pl-12 sm:pl-0">
          <div className="text-center">
            <div className="text-sm font-black text-slate-200 tabular-nums leading-none">
              {repliesCount}
            </div>
            <div className="text-[10px] uppercase tracking-wider text-slate-500 mt-0.5">
              Replies
            </div>
          </div>
          <div className="text-center">
            <div className="text-sm font-black text-slate-400 tabular-nums leading-none">
              {t._count.posts}
            </div>
            <div className="text-[10px] uppercase tracking-wider text-slate-500 mt-0.5">
              Posts
            </div>
          </div>
        </div>

        {/* Right: Last Post by info */}
        <div className="shrink-0 sm:w-64 pl-12 sm:pl-0 sm:border-l border-slate-800/60 sm:pl-4">
          {lastPost ? (
            <div className="flex items-center gap-2.5">
              {lastPost.team.logoUrl ? (
                <img
                  src={lastPost.team.logoUrl}
                  alt=""
                  className="w-7 h-7 object-contain shrink-0 rounded-md bg-slate-900/60 p-0.5 border border-slate-800"
                />
              ) : (
                <div className="w-7 h-7 rounded-lg bg-slate-800 grid place-items-center text-[10px] text-slate-400 shrink-0">
                  {(lastPost.team.gmNickname || lastPost.team.code || "?").slice(0, 2)}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-xs font-semibold text-slate-300 truncate">
                    {lastPost.team.gmNickname || lastPost.team.code}
                  </span>
                  {isUnread && (
                    <span className="text-[9px] font-black uppercase tracking-wider px-1 py-0.2 rounded bg-rose-500/20 text-rose-400 border border-rose-500/30">
                      NEW
                    </span>
                  )}
                </div>
                <div className="text-[11px] text-slate-500">
                  {ago(lastPost.createdAt)}
                </div>
              </div>
              <Link
                href={`/forum/${t.id}#post-${lastPost.team.code}`}
                className="text-slate-500 group-hover:text-blue-400 transition-colors text-sm px-1"
                title="Go to thread"
              >
                →
              </Link>
            </div>
          ) : (
            <div className="text-xs text-slate-600 italic">No replies</div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4 py-2 w-full">
      {/* Breadcrumbs Navigation */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <ForumBreadcrumbs
          crumbs={[{ label: m.label, icon: m.icon }]}
        />
        <div className="flex items-center gap-2">
          {me && <MarkAllReadButton />}
          <BackPill href="/forum">Board index</BackPill>
        </div>
      </div>

      {/* Category Banner */}
      <div
        className={`rounded-2xl border ${m.ring} bg-gradient-to-r ${m.glow} via-slate-900 to-slate-950 p-5 sm:p-6 shadow-xl relative overflow-hidden`}
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10">
          <div className="flex items-center gap-4">
            <div className="shrink-0 w-14 h-14 rounded-2xl bg-slate-800/80 border border-slate-700/80 grid place-items-center text-3xl shadow-inner">
              {m.icon}
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className={`text-2xl font-black tracking-tight ${m.color}`}>
                  {m.label}
                </h1>
                {m.adminOnly && (
                  <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400 bg-amber-500/15 border border-amber-500/30 rounded px-2 py-0.5">
                    commissioner only
                  </span>
                )}
              </div>
              <p className="text-sm text-slate-300 mt-1">{m.desc}</p>
            </div>
          </div>

          <div className="flex items-center gap-3 self-start sm:self-center">
            <div className="rounded-xl bg-slate-900/80 border border-slate-800 px-3.5 py-1.5 text-center">
              <span className="text-lg font-black text-white tabular-nums leading-none">
                {threads.length}
              </span>
              <span className="block text-[10px] uppercase tracking-wider text-slate-400">
                Threads
              </span>
            </div>
          </div>
        </div>
      </div>

      {error === "admin" && (
        <Card>
          <p className="text-center text-amber-400 text-sm py-2">
            Only the league commissioner can start threads in this sub-forum.
          </p>
        </Card>
      )}
      {error === "empty" && (
        <Card>
          <p className="text-center text-rose-400 text-sm py-2">
            The thread must have both a title and text.
          </p>
        </Card>
      )}

      {/* New Thread Form if eligible */}
      {canPost && <NewThreadForm category={category} />}

      {me != null && m.adminOnly && !admin && (
        <Card>
          <p className="text-center text-slate-400 text-xs py-2">
            ℹ️ Only league management can start new threads in Comish Corner. Every GM can still join the discussion and reply.
          </p>
        </Card>
      )}

      {/* Pinned Topics Section */}
      {pinnedThreads.length > 0 && (
        <div className="rounded-2xl border border-amber-500/30 bg-slate-900/90 shadow-xl overflow-hidden">
          <div className="bg-amber-950/30 px-4 py-2.5 border-b border-amber-500/30 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-amber-400 font-bold">📌</span>
              <span className="text-xs font-black uppercase tracking-wider text-amber-300">
                Pinned threads and announcements
              </span>
            </div>
            <span className="text-xs font-semibold text-amber-400/80 tabular-nums">
              {pinnedThreads.length}
            </span>
          </div>

          {/* Table Header */}
          <div className="hidden sm:flex items-center justify-between px-4 py-2 bg-slate-950/60 border-b border-slate-800 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
            <div className="flex-1">Thread / Author</div>
            <div className="w-36 text-center">Stats</div>
            <div className="w-64 pl-4">Latest post</div>
          </div>

          <div className="divide-y divide-slate-800/60">
            {pinnedThreads.map(renderThreadRow)}
          </div>
        </div>
      )}

      {/* Normal Topics Section */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/90 shadow-xl overflow-hidden">
        <div className="bg-slate-800/40 px-4 py-2.5 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-blue-400 font-bold">💬</span>
            <span className="text-xs font-black uppercase tracking-wider text-slate-300">
              Discussion threads
            </span>
          </div>
          <span className="text-xs font-semibold text-slate-400 tabular-nums">
            {normalThreads.length}
          </span>
        </div>

        {/* Table Header */}
        <div className="hidden sm:flex items-center justify-between px-4 py-2 bg-slate-950/60 border-b border-slate-800 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
          <div className="flex-1">Thread / Author</div>
          <div className="w-36 text-center">Stats</div>
          <div className="w-64 pl-4">Latest post</div>
        </div>

        {normalThreads.length === 0 && pinnedThreads.length === 0 ? (
          <div className="text-center py-14 px-4 space-y-2">
            <div className="text-3xl">📭</div>
            <div className="text-slate-200 font-bold text-base">No threads yet</div>
            <p className="text-slate-400 text-xs max-w-sm mx-auto">
              Nobody has started a discussion in this sub-forum yet. {canPost ? "Use the button above and be the first!" : ""}
            </p>
          </div>
        ) : normalThreads.length === 0 ? (
          <div className="text-center py-8 text-slate-500 text-xs italic">
            All threads in this category are pinned above.
          </div>
        ) : (
          <div className="divide-y divide-slate-800/60">
            {normalThreads.map(renderThreadRow)}
          </div>
        )}
      </div>

      {/* Bottom Breadcrumbs */}
      <div className="pt-2">
        <ForumBreadcrumbs
          crumbs={[{ label: m.label, icon: m.icon }]}
        />
      </div>
    </div>
  );
}
