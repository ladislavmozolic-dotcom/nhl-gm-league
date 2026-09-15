"use server";

import { prisma } from "@/lib/prisma";
import { getTeamSession, canManageTeam } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { articlePlainText, sanitizeArticleHtml } from "@/lib/news-html";

const MAX_TITLE = 160;
// A 4 MB image grows by roughly one third when encoded as a data URL.
const MAX_HTML = 6_000_000;

function cleanArticle(title: string, bodyHtml: string) {
  const cleanTitle = title.trim().slice(0, MAX_TITLE);
  if (!cleanTitle) throw new Error("Add a title.");
  if (bodyHtml.length > MAX_HTML) throw new Error("Article is too large.");
  const cleanBody = sanitizeArticleHtml(bodyHtml);
  if (!articlePlainText(cleanBody) && !/<img\b/i.test(cleanBody)) throw new Error("Write something.");
  return { title: cleanTitle, bodyHtml: cleanBody };
}

export async function createArticle(title: string, bodyHtml: string) {
  const session = await getTeamSession();
  if (!session) throw new Error("Sign in as a GM to post news.");
  const clean = cleanArticle(title, bodyHtml);
  const article = await prisma.newsArticle.create({ data: { authorTeamId: session, ...clean } });
  revalidatePath("/"); revalidatePath("/news");
  redirect(`/news/${article.id}`);
}

export async function updateArticle(id: number, title: string, bodyHtml: string) {
  const article = await prisma.newsArticle.findUnique({ where: { id }, select: { authorTeamId: true } });
  if (!article) throw new Error("Article not found.");
  if (!(await canManageTeam(article.authorTeamId))) throw new Error("You can only edit your own club's articles.");
  const clean = cleanArticle(title, bodyHtml);
  await prisma.newsArticle.update({ where: { id }, data: clean });
  revalidatePath("/"); revalidatePath("/news"); revalidatePath(`/news/${id}`);
  redirect(`/news/${id}`);
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
