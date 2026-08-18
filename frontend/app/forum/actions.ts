"use server";

import { prisma } from "@/lib/prisma";
import { getTeamSession, isAdmin } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { catOk, CAT_META } from "./categories";

/** Start a new thread (with its opening post). */
export async function createThread(formData: FormData) {
  const me = await getTeamSession();
  if (!me) return;
  const title = String(formData.get("title") ?? "").trim().slice(0, 140);
  const body = String(formData.get("body") ?? "").trim().slice(0, 5000);
  const category = catOk(String(formData.get("category") ?? "discussion"));
  if (CAT_META[category].adminOnly && !(await isAdmin())) redirect(`/forum/c/${category}?error=admin`);
  if (!title || !body) redirect(`/forum/c/${category}?error=empty`);
  const thread = await prisma.forumThread.create({ data: { teamId: me, title, category, posts: { create: { teamId: me, body } } } });
  redirect(`/forum/${thread.id}`);
}

/** Reply to a thread. */
export async function replyToThread(threadId: number, body: string) {
  const me = await getTeamSession();
  if (!me) return { ok: false as const, error: "Sign in as a GM to post." };
  const text = body.trim();
  if (!text) return { ok: false as const, error: "Empty post." };
  await prisma.$transaction([
    prisma.forumPost.create({ data: { threadId, teamId: me, body: text.slice(0, 5000) } }),
    prisma.forumThread.update({ where: { id: threadId }, data: { lastPostAt: new Date() } }),
  ]);
  revalidatePath(`/forum/${threadId}`);
  return { ok: true as const };
}

/** Toggle an emoji reaction on a post (add if absent, remove if present). */
export async function toggleReaction(postId: number, emoji: string) {
  const me = await getTeamSession();
  if (!me) return { ok: false as const };
  // race-safe toggle: remove if present; if nothing was removed, add it (a concurrent
  // double-click can lose the create to the unique constraint — swallow that P2002).
  const removed = await prisma.forumReaction.deleteMany({ where: { postId, teamId: me, emoji } });
  if (removed.count === 0) {
    try { await prisma.forumReaction.create({ data: { postId, teamId: me, emoji } }); }
    catch { /* concurrent create already won — leave it reacted */ }
  }
  const post = await prisma.forumPost.findUnique({ where: { id: postId }, select: { threadId: true } });
  if (post) revalidatePath(`/forum/${post.threadId}`);
  return { ok: true as const };
}
