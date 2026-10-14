"use client";

import { useState } from "react";
import { directLogin } from "@/app/login/actions";
import { REMEMBER_TOKEN_KEY } from "@/lib/session-resume-shared";

// Same GM sign-in as the site (email/nickname + password), but lands back in /chat.
export default function ChatLogin() {
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(fd: FormData) {
    setBusy(true); setErr("");
    const r = await directLogin(fd);
    if (!r.ok) { setErr("Nesprávne meno alebo heslo."); setBusy(false); return; }
    try { localStorage.setItem(REMEMBER_TOKEN_KEY, r.rememberToken); } catch { /* private mode */ }
    window.location.href = "/chat"; // real navigation so iOS commits the cookie
  }
  const inp = "w-full rounded-xl bg-slate-900 border border-slate-700 px-4 py-3 text-base outline-none focus:border-blue-500";
  return (
    <form action={submit} className="w-full max-w-xs space-y-3">
      <input name="identifier" placeholder="E-mail alebo prezývka" autoCapitalize="none" autoComplete="username" className={inp} required />
      <input name="password" type="password" placeholder="Heslo" autoComplete="current-password" className={inp} required />
      {err && <p className="text-red-400 text-sm">{err}</p>}
      <button disabled={busy} className="w-full rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 px-6 py-3 font-medium">{busy ? "Prihlasujem…" : "Prihlásiť sa"}</button>
    </form>
  );
}
