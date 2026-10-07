import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Card, BackPill } from "@/components/ui";
import { getTeamSession, isAdmin } from "@/lib/auth";
import ForumReply from "@/components/ForumReply";
import ForumPostCard, { type ForumPostView } from "@/components/ForumPostCard";
import ForumBreadcrumbs from "@/components/forum/ForumBreadcrumbs";
import ForumPinToggle from "@/components/forum/ForumPinToggle";
import { markForumSeen } from "../actions";
import { catOk, CAT_META } from "../categories";

export const dynamic = "force-dynamic";

const formatPostDate = (d: Date) => {
  const now = new Date();
  const isToday =
    d.getDate() === now.getDate() &&
    d.getMonth() === now.getMonth() &&
    d.getFullYear() === now.getFullYear();

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday =
    d.getDate() === yesterday.getDate() &&
    d.getMonth() === yesterday.getMonth() &&
    d.getFullYear() === yesterday.getFullYear();

  const timeStr = d.toLocaleTimeString("sk-SK", { hour: "2-digit", minute: "2-digit" });

  if (isToday) return `Dnes o ${timeStr}`;
  if (isYesterday) return `Včera o ${timeStr}`;
  return d.toLocaleString("sk-SK", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

export default async function ThreadPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const tid = Number(id);
  const [me, admin] = await Promise.all([getTeamSession(), isAdmin()]);
  const myTeam = me
    ? await prisma.team.findUnique({
        where: { id: me },
        select: { forumSeenAt: true },
      })
    : null;
  const lastSeen = myTeam?.forumSeenAt ?? new Date(0);

  const thread = await prisma.forumThread.findUnique({
    where: { id: tid },
    select: {
      id: true,
      title: true,
      category: true,
      pinned: true,
      createdAt: true,
      posts: {
        orderBy: { id: "asc" },
        select: {
          id: true,
          body: true,
          createdAt: true,
          editedAt: true,
          teamId: true,
          team: {
            select: {
              id: true,
              code: true,
              name: true,
              logoUrl: true,
              gmNickname: true,
              slug: true,
              isAdmin: true,
              gmRole: true,
              rookieGm: true,
              lastLoginAt: true,
              _count: { select: { forumPosts: true } },
            },
          },
          reactions: { select: { emoji: true, teamId: true } },
        },
      },
    },
  });

  if (!thread) notFound();
  const cat = catOk(thread.category);
  const m = CAT_META[cat];

  const nowMs = Date.now();

  const posts: ForumPostView[] = thread.posts.map((p, i) => {
    const byEmoji = new Map<string, { count: number; mine: boolean }>();
    for (const r of p.reactions) {
      const cur = byEmoji.get(r.emoji) ?? { count: 0, mine: false };
      byEmoji.set(r.emoji, { count: cur.count + 1, mine: cur.mine || r.teamId === me });
    }

    // Role badge determination
    let roleBadge = {
      label: "Generálny Manažér",
      bg: "bg-slate-800/80",
      text: "text-slate-300",
      border: "border-slate-700/80",
    };
    if (p.team.gmRole === "comish" || p.team.gmRole === "co_comish") {
      roleBadge = {
        label: "👑 Komisár ligy",
        bg: "bg-amber-500/15",
        text: "text-amber-300",
        border: "border-amber-500/40",
      };
    } else if (p.team.isAdmin) {
      roleBadge = {
        label: "🛡️ Administrátor",
        bg: "bg-purple-500/15",
        text: "text-purple-300",
        border: "border-purple-500/40",
      };
    } else if (p.team.gmRole === "agent") {
      roleBadge = {
        label: "🤝 Agent ligy",
        bg: "bg-emerald-500/15",
        text: "text-emerald-300",
        border: "border-emerald-500/40",
      };
    } else if (p.team.rookieGm) {
      roleBadge = {
        label: "🌱 Nováčik",
        bg: "bg-sky-500/15",
        text: "text-sky-300",
        border: "border-sky-500/40",
      };
    }

    const isOnline = p.team.lastLoginAt
      ? nowMs - p.team.lastLoginAt.getTime() < 30 * 60 * 1000
      : false;

    return {
      id: p.id,
      body: p.body,
      when: formatPostDate(p.createdAt),
      fullDate: p.createdAt.toLocaleString("sk-SK", {
        day: "numeric",
        month: "long",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      }),
      edited: p.editedAt != null,
      isOP: i === 0,
      postNumber: i + 1,
      authorName: p.team.gmNickname || p.team.code || p.team.name,
      authorSlug: p.team.slug,
      authorLogo: p.team.logoUrl,
      authorRoleBadge: roleBadge,
      authorTeamCode: p.team.code,
      authorTeamName: p.team.name,
      authorPostsCount: p.team._count.forumPosts,
      authorIsOnline: isOnline,
      isNewPost: me != null && p.teamId !== me && p.createdAt > lastSeen,
      canModify: me != null && (p.teamId === me || admin),
      reacts: [...byEmoji.entries()].map(([emoji, v]) => ({ emoji, count: v.count, mine: v.mine })),
    };
  });

  // After determining which posts are new for this GM, mark the forum as seen
  await markForumSeen();

  return (
    <div className="space-y-4 py-2 w-full">
      {/* Top Breadcrumb Navigation */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <ForumBreadcrumbs
          crumbs={[
            { label: m.label, href: `/forum/c/${cat}`, icon: m.icon },
            { label: thread.title },
          ]}
        />
        <BackPill href={`/forum/c/${cat}`}>{m.label}</BackPill>
      </div>

      {/* Thread Title Header Box */}
      <div className="rounded-2xl border border-slate-800 bg-gradient-to-r from-slate-900 via-slate-900/90 to-slate-950 p-4 sm:p-5 shadow-lg shadow-black/20">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-1.5 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${m.chip}`}>
                {m.icon} {m.label}
              </span>
              {thread.pinned && (
                <span className="text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center gap-1">
                  <span>📌</span>
                  <span>Pripnutá téma</span>
                </span>
              )}
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight break-words">
              {thread.title}
            </h1>
            <div className="text-xs text-slate-400 flex items-center gap-2 flex-wrap">
              <span>Založené {formatPostDate(thread.createdAt)}</span>
              <span>•</span>
              <span className="font-semibold text-slate-300 tabular-nums">
                {posts.length} {posts.length === 1 ? "príspevok" : posts.length < 5 ? "príspevky" : "príspevkov"}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0 self-start sm:self-center">
            {admin && (
              <ForumPinToggle threadId={thread.id} isPinned={thread.pinned} />
            )}
            {me && (
              <a
                href="#forum-reply-box"
                className="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-all shadow shadow-blue-900/40 flex items-center gap-1.5"
              >
                <span>💬</span>
                <span>Odpovedať</span>
              </a>
            )}
          </div>
        </div>
      </div>

      {/* Post List */}
      <div className="space-y-4">
        {posts.map((p) => (
          <ForumPostCard key={p.id} post={p} canReact={me != null} />
        ))}
      </div>

      {/* Bottom Breadcrumbs & Quick Reply */}
      <div className="pt-2">
        <ForumBreadcrumbs
          crumbs={[
            { label: m.label, href: `/forum/c/${cat}`, icon: m.icon },
            { label: thread.title },
          ]}
        />
      </div>

      {me ? (
        <Card
          title="Rýchla odpoveď (Quick Reply)"
          accent="text-blue-400"
          className="border-slate-800 shadow-xl"
        >
          <ForumReply threadId={thread.id} />
        </Card>
      ) : (
        <Card>
          <div className="text-center py-6 px-4 space-y-2">
            <p className="text-slate-300 text-sm font-medium">
              Pre pridanie odpovede do tejto diskusie sa musíš prihlásiť ako GM.
            </p>
            <div>
              <Link
                href="/login"
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-colors"
              >
                Prihlásiť sa do ligy →
              </Link>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
