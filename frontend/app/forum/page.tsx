import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getTeamSession } from "@/lib/auth";
import { CATEGORIES, CAT_META } from "./categories";
import MarkAllReadButton from "@/components/forum/MarkAllReadButton";

export const dynamic = "force-dynamic";

const ago = (d: Date) => {
  const s = Math.floor((Date.now() - d.getTime()) / 1000);
  if (s < 60) return "práve teraz";
  if (s < 3600) return `pred ${Math.floor(s / 60)}m`;
  if (s < 86400) return `pred ${Math.floor(s / 3600)}h`;
  const days = Math.floor(s / 86400);
  if (days === 1) return "včera";
  if (days < 30) return `pred ${days}d`;
  return d.toLocaleDateString("sk-SK", { day: "numeric", month: "short" });
};

export default async function ForumPage() {
  const me = await getTeamSession();
  const myTeam = me
    ? await prisma.team.findUnique({
        where: { id: me },
        select: { code: true, forumSeenAt: true },
      })
    : null;

  const lastSeen = myTeam?.forumSeenAt ?? new Date(0);

  // Load category details, counts, unread posts and latest posts
  const [cats, totalTeams, activeTeams, latestPostOverall] = await Promise.all([
    Promise.all(
      CATEGORIES.map(async (cat) => {
        const [topics, posts, unreadCount, last] = await Promise.all([
          prisma.forumThread.count({ where: { category: cat } }),
          prisma.forumPost.count({ where: { thread: { category: cat } } }),
          me
            ? prisma.forumPost.count({
                where: {
                  thread: { category: cat },
                  teamId: { not: me },
                  createdAt: { gt: lastSeen },
                },
              })
            : 0,
          prisma.forumPost.findFirst({
            where: { thread: { category: cat } },
            orderBy: { id: "desc" },
            select: {
              createdAt: true,
              thread: { select: { id: true, title: true } },
              team: { select: { code: true, logoUrl: true, gmNickname: true, name: true } },
            },
          }),
        ]);
        return { cat, topics, posts, unreadCount, last };
      })
    ),
    prisma.team.count(),
    prisma.team.findMany({
      where: { lastLoginAt: { not: null } },
      orderBy: { lastLoginAt: "desc" },
      take: 8,
      select: {
        id: true,
        code: true,
        gmNickname: true,
        name: true,
        slug: true,
        isAdmin: true,
        gmRole: true,
        lastLoginAt: true,
      },
    }),
    prisma.forumPost.findFirst({
      orderBy: { id: "desc" },
      select: {
        createdAt: true,
        thread: { select: { id: true, title: true } },
        team: { select: { gmNickname: true, code: true } },
      },
    }),
  ]);

  const totalTopics = cats.reduce((n, c) => n + c.topics, 0);
  const totalPosts = cats.reduce((n, c) => n + c.posts, 0);
  const totalUnread = cats.reduce((n, c) => n + c.unreadCount, 0);

  const nowFormatted = new Date().toLocaleString("sk-SK", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className="space-y-6 py-2 w-full">
      {/* Top phpBB Board Header */}
      <div className="rounded-2xl border border-slate-800 bg-gradient-to-r from-slate-900 via-slate-900/90 to-slate-950 p-5 shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5">
              <span className="text-2xl">🏛️</span>
              <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                UNHL Diskusné Fórum
              </h1>
              {totalUnread > 0 && (
                <span className="px-2.5 py-0.5 rounded-full text-xs font-black uppercase tracking-wider bg-rose-500 text-white shadow-md shadow-rose-900/50 animate-pulse">
                  {totalUnread} {totalUnread === 1 ? "nová správa" : "nových správ"}
                </span>
              )}
            </div>
            <p className="text-xs sm:text-sm text-slate-400">
              Hlavný rozcestník ligových diskusií, vyjednávaní a oficiálnych oznamov.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-slate-800/60 border border-slate-700/60 px-4 py-2 text-center min-w-[80px]">
              <div className="text-xl sm:text-2xl font-black text-white tabular-nums leading-none">
                {totalTopics}
              </div>
              <div className="text-[10px] uppercase tracking-wider text-slate-400 mt-1 font-semibold">
                Tém
              </div>
            </div>
            <div className="rounded-xl bg-slate-800/60 border border-slate-700/60 px-4 py-2 text-center min-w-[80px]">
              <div className="text-xl sm:text-2xl font-black text-white tabular-nums leading-none">
                {totalPosts}
              </div>
              <div className="text-[10px] uppercase tracking-wider text-slate-400 mt-1 font-semibold">
                Príspevkov
              </div>
            </div>
          </div>
        </div>

        <div className="mt-4 pt-3 border-t border-slate-800/70 flex items-center justify-between text-[11px] text-slate-500 flex-wrap gap-2">
          <div className="flex items-center gap-1.5">
            <span>🕒</span>
            <span>Aktuálny čas na serveri:</span>
            <span className="text-slate-400 font-medium">{nowFormatted}</span>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            {latestPostOverall && (
              <div className="flex items-center gap-1.5 truncate">
                <span>Posledný príspevok v lige:</span>
                <Link
                  href={`/forum/${latestPostOverall.thread.id}`}
                  className="text-blue-400 hover:underline font-medium truncate max-w-[200px]"
                >
                  {latestPostOverall.thread.title}
                </Link>
                <span className="text-slate-600">({ago(latestPostOverall.createdAt)})</span>
              </div>
            )}
            {me && <MarkAllReadButton />}
          </div>
        </div>
      </div>

      {/* Main Categories phpBB Table Container */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/90 shadow-2xl overflow-hidden">
        {/* Category Header */}
        <div className="bg-slate-800/60 px-5 py-3 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm font-black uppercase tracking-wider text-slate-200">
              🏒 Ligové sekcie a podfóra
            </span>
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-400 font-medium">
            <span>Board Index</span>
          </div>
        </div>

        {/* Table Column Headers */}
        <div className="hidden sm:flex items-center justify-between px-5 py-2.5 bg-slate-950/70 border-b border-slate-800/80 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
          <div className="flex-1">Podfórum / Popis</div>
          <div className="w-32 text-center">Štatistika</div>
          <div className="w-72 pl-5">Posledný príspevok</div>
        </div>

        {/* Category Rows */}
        <div className="divide-y divide-slate-800/70">
          {cats.map(({ cat, topics, posts, unreadCount, last }) => {
            const m = CAT_META[cat];
            const hasNew = unreadCount > 0;
            const isLastPostNew =
              last != null &&
              me != null &&
              last.createdAt > lastSeen &&
              last.team.code !== myTeam?.code;

            return (
              <div
                key={cat}
                className={`group flex flex-col sm:flex-row sm:items-center justify-between p-4 sm:p-5 gap-3 transition-all ${
                  hasNew
                    ? "bg-rose-950/15 border-l-4 border-l-rose-500 hover:bg-rose-950/25"
                    : "hover:bg-slate-800/40"
                }`}
              >
                {/* Left: Icon & Subforum Info */}
                <div className="flex items-start sm:items-center gap-4 min-w-0 flex-1">
                  <div className="relative shrink-0">
                    <Link
                      href={`/forum/c/${cat}`}
                      className={`block w-12 h-12 rounded-xl border grid place-items-center text-2xl shadow-sm transition-transform group-hover:scale-105 ${
                        hasNew
                          ? "bg-rose-900/30 border-rose-500/60 ring-2 ring-rose-500/50 shadow-[0_0_15px_-2px_rgba(244,63,94,0.4)] text-rose-300"
                          : "bg-slate-800 border-slate-700/80 text-slate-300"
                      }`}
                    >
                      {m.icon}
                    </Link>
                    {hasNew && (
                      <span
                        title={`${unreadCount} nových príspevkov`}
                        className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-rose-500 border-2 border-slate-950 ring-1 ring-rose-400 shadow animate-pulse"
                      />
                    )}
                  </div>

                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Link
                        href={`/forum/c/${cat}`}
                        className={`text-base font-bold tracking-tight ${
                          hasNew ? "text-white font-black" : m.color
                        } group-hover:text-blue-300 transition-colors flex items-center gap-2`}
                      >
                        <span>{m.label}</span>
                      </Link>

                      {hasNew && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-rose-500 text-white shadow-sm flex items-center gap-1 animate-pulse">
                          <span>NOVÉ</span>
                          <span>({unreadCount})</span>
                        </span>
                      )}

                      {m.adminOnly && (
                        <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400 bg-amber-500/15 border border-amber-500/30 rounded px-1.5 py-0.5">
                          len komisár
                        </span>
                      )}
                    </div>
                    <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
                      {m.desc}
                    </p>
                  </div>
                </div>

                {/* Center: Topics & Posts Counters */}
                <div className="flex items-center justify-between sm:justify-center gap-6 shrink-0 sm:w-32 pl-16 sm:pl-0">
                  <div className="text-center">
                    <div className="text-base font-black text-slate-200 tabular-nums leading-none">
                      {topics}
                    </div>
                    <div className="text-[10px] uppercase tracking-wider text-slate-500 mt-1 font-semibold">
                      Tém
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="text-base font-black text-slate-400 tabular-nums leading-none">
                      {posts}
                    </div>
                    <div className="text-[10px] uppercase tracking-wider text-slate-500 mt-1 font-semibold">
                      Správ
                    </div>
                  </div>
                </div>

                {/* Right: Last Post Information */}
                <div className="shrink-0 sm:w-72 pl-16 sm:pl-0 sm:border-l border-slate-800/80 sm:pl-5">
                  {last ? (
                    <div className="flex items-center gap-3">
                      {last.team.logoUrl ? (
                        <img
                          src={last.team.logoUrl}
                          alt=""
                          className="w-8 h-8 object-contain shrink-0 rounded-md bg-slate-900/50 p-0.5 border border-slate-800"
                        />
                      ) : (
                        <div className="w-8 h-8 rounded-lg bg-slate-800 grid place-items-center text-[10px] text-slate-400 shrink-0 font-bold">
                          {(last.team.gmNickname || last.team.code || "?").slice(0, 2)}
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <Link
                            href={`/forum/${last.thread.id}`}
                            className={`text-xs font-bold truncate group-hover:text-blue-400 transition-colors block max-w-[170px] ${
                              isLastPostNew ? "text-rose-300 font-extrabold" : "text-slate-200"
                            }`}
                          >
                            {last.thread.title}
                          </Link>
                          {isLastPostNew && (
                            <span className="text-[9px] font-black uppercase tracking-wider px-1.5 py-0.2 rounded bg-rose-500/20 text-rose-400 border border-rose-500/40">
                              NOVÝ
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5">
                          od{" "}
                          <span className="text-slate-400 font-medium">
                            {last.team.gmNickname || last.team.code || "GM"}
                          </span>{" "}
                          • {ago(last.createdAt)}
                        </div>
                      </div>
                      <Link
                        href={`/forum/${last.thread.id}`}
                        className="text-slate-600 group-hover:text-blue-400 transition-colors text-base px-1"
                        title="Zobraziť tému"
                      >
                        →
                      </Link>
                    </div>
                  ) : (
                    <div className="text-xs text-slate-600 italic">
                      Zatiaľ žiadne príspevky.
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Board Statistics & Who Is Online Panel */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Forum Stats */}
        <div className="md:col-span-2 rounded-2xl border border-slate-800 bg-slate-900/80 p-5 shadow-xl space-y-3">
          <div className="flex items-center justify-between pb-2.5 border-b border-slate-800">
            <h2 className="text-xs font-black uppercase tracking-wider text-slate-300 flex items-center gap-2">
              <span>📊</span>
              <span>Štatistiky fóra</span>
            </h2>
            <span className="text-[11px] text-slate-500">
              Celkovo {totalTeams} klubov v lige
            </span>
          </div>

          <div className="grid grid-cols-3 gap-3 text-center py-1">
            <div className="p-2.5 rounded-xl bg-slate-950/50 border border-slate-800/80">
              <div className="text-xl font-black text-white tabular-nums">{totalPosts}</div>
              <div className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold mt-0.5">
                Príspevkov
              </div>
            </div>
            <div className="p-2.5 rounded-xl bg-slate-950/50 border border-slate-800/80">
              <div className="text-xl font-black text-white tabular-nums">{totalTopics}</div>
              <div className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold mt-0.5">
                Vlákien
              </div>
            </div>
            <div className="p-2.5 rounded-xl bg-slate-950/50 border border-slate-800/80">
              <div className="text-xl font-black text-emerald-400 tabular-nums">
                {activeTeams.length}
              </div>
              <div className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold mt-0.5">
                Aktívnych GM
              </div>
            </div>
          </div>

          {/* Active GMs List */}
          <div className="pt-2 text-xs text-slate-400 space-y-1.5">
            <div className="font-semibold text-slate-300 text-[11px] uppercase tracking-wider flex items-center gap-1.5">
              <span>🟢</span>
              <span>Nedávno aktívni GM:</span>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {activeTeams.map((t) => {
                const isComish = t.gmRole === "comish" || t.gmRole === "co_comish";
                const isAdmin = t.isAdmin;
                return (
                  <Link
                    key={t.id}
                    href={`/teams/${t.slug}`}
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-semibold border transition-colors ${
                      isComish
                        ? "bg-amber-500/10 text-amber-300 border-amber-500/30 hover:bg-amber-500/20"
                        : isAdmin
                        ? "bg-purple-500/10 text-purple-300 border-purple-500/30 hover:bg-purple-500/20"
                        : "bg-slate-800 text-slate-300 border-slate-700 hover:text-white"
                    }`}
                  >
                    <span>{t.gmNickname || t.code || t.name}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        </div>

        {/* Legend of Icons */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5 shadow-xl space-y-3">
          <div className="pb-2.5 border-b border-slate-800">
            <h2 className="text-xs font-black uppercase tracking-wider text-slate-300 flex items-center gap-2">
              <span>ℹ️</span>
              <span>Legenda fóra</span>
            </h2>
          </div>

          <div className="space-y-2 text-xs text-slate-400 pt-1">
            <div className="flex items-center gap-2.5">
              <span className="w-6 text-center text-sm">🔴</span>
              <span className="text-rose-300 font-semibold">Nové neprečítané príspevky</span>
            </div>
            <div className="flex items-center gap-2.5">
              <span className="w-6 text-center text-sm">💬</span>
              <span>Všetky príspevky prečítané</span>
            </div>
            <div className="flex items-center gap-2.5">
              <span className="w-6 text-center text-sm">📌</span>
              <span>Pripnuté oznámenie / pravidlá</span>
            </div>
            <div className="flex items-center gap-2.5">
              <span className="w-6 text-center text-sm">🔥</span>
              <span>Horúca téma (&gt; 10 odpovedí)</span>
            </div>
            <div className="flex items-center gap-2.5">
              <span className="w-6 text-center text-sm">👑</span>
              <span className="text-amber-300">Vedenie ligy / Komisár</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
