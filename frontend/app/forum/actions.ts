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

/** Edit a post — author or a league admin only. */
export async function editPost(postId: number, body: string) {
  const me = await getTeamSession();
  if (!me) return { ok: false as const, error: "Sign in as a GM." };
  const text = body.trim();
  if (!text) return { ok: false as const, error: "Empty post." };
  const post = await prisma.forumPost.findUnique({ where: { id: postId }, select: { teamId: true, threadId: true } });
  if (!post) return { ok: false as const, error: "Post not found." };
  if (post.teamId !== me && !(await isAdmin())) return { ok: false as const, error: "Not your post." };
  await prisma.forumPost.update({ where: { id: postId }, data: { body: text.slice(0, 5000), editedAt: new Date() } });
  revalidatePath(`/forum/${post.threadId}`);
  return { ok: true as const };
}

/** Delete a post — author or admin. If it was the thread's last post, remove the thread too. */
export async function deletePost(postId: number) {
  const me = await getTeamSession();
  if (!me) return { ok: false as const, error: "Sign in as a GM." };
  const post = await prisma.forumPost.findUnique({ where: { id: postId }, select: { teamId: true, threadId: true } });
  if (!post) return { ok: false as const, error: "Post not found." };
  if (post.teamId !== me && !(await isAdmin())) return { ok: false as const, error: "Not your post." };
  await prisma.forumPost.delete({ where: { id: postId } });
  const left = await prisma.forumPost.count({ where: { threadId: post.threadId } });
  if (left === 0) {
    const thr = await prisma.forumThread.findUnique({ where: { id: post.threadId }, select: { category: true } });
    await prisma.forumThread.delete({ where: { id: post.threadId } }).catch(() => {});
    revalidatePath("/forum");
    return { ok: true as const, threadDeleted: true, category: thr?.category ?? null };
  }
  revalidatePath(`/forum/${post.threadId}`);
  return { ok: true as const, threadDeleted: false };
}

/** Mark the forum as "seen" for the signed-in GM (clears the new-posts menu badge). */
export async function markForumSeen() {
  const me = await getTeamSession();
  if (!me) return;
  await prisma.team.update({ where: { id: me }, data: { forumSeenAt: new Date() } }).catch(() => {});
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
