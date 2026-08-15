"use server";

import { prisma } from "@/lib/prisma";
import { getTeamSession } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function createArticle(title: string, bodyHtml: string) {
  const session = await getTeamSession();
  if (!session) throw new Error("Sign in as a GM to post news.");
  if (!title.trim()) throw new Error("Add a title.");
  const article = await prisma.newsArticle.create({ data: { authorTeamId: session, title: title.trim(), bodyHtml } });
  revalidatePath("/"); revalidatePath("/news");
  redirect(`/news/${article.id}`);
}

const KINDS = ["like", "dislike", "laugh", "heart"] as const;

export async function reactToArticle(articleId: number, kind: string) {
  const session = await getTeamSession();
  if (!session) throw new Error("Sign in as a GM to react.");
  if (!KINDS.includes(kind as (typeof KINDS)[number])) throw new Error("Bad reaction.");
  const existing = await prisma.newsReaction.findUnique({ where: { articleId_teamId: { articleId, teamId: session } } });
  if (existing && existing.kind === kind) {
    await prisma.newsReaction.delete({ where: { id: existing.id } }); // toggle off
  } else if (existing) {
    await prisma.newsReaction.update({ where: { id: existing.id }, data: { kind } });
  } else {
    await prisma.newsReaction.create({ data: { articleId, teamId: session, kind } });
  }
  revalidatePath(`/news/${articleId}`); revalidatePath("/");
}

export async function commentOnArticle(articleId: number, body: string) {
  const session = await getTeamSession();
  if (!session) throw new Error("Sign in as a GM to comment.");
  if (!body.trim()) return;
  await prisma.newsComment.create({ data: { articleId, teamId: session, body: body.trim() } });
  revalidatePath(`/news/${articleId}`);
}
