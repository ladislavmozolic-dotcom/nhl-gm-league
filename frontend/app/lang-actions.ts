"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { LANG_COOKIE, normalizeLang } from "@/lib/i18n";

/** Set the UI language cookie (1 year). Anyone may set their own preference. */
export async function setLang(lang: string) {
  (await cookies()).set(LANG_COOKIE, normalizeLang(lang), { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
  revalidatePath("/", "layout");
}
