"use client";

import { createContext, useContext } from "react";
import { t, type Lang } from "@/lib/i18n";

const LangCtx = createContext<Lang>("en");

/** Provides the current language to client components. Fed by the root layout. */
export function LangProvider({ lang, children }: { lang: Lang; children: React.ReactNode }) {
  return <LangCtx.Provider value={lang}>{children}</LangCtx.Provider>;
}

/** Current language in a client component. */
export function useLang(): Lang {
  return useContext(LangCtx);
}

/** Translate helper bound to the current language: `const tr = useT(); tr("menu.home")`. */
export function useT(): (key: string) => string {
  const lang = useContext(LangCtx);
  return (key: string) => t(lang, key);
}
