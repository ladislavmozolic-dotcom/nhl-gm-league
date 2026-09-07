"use client";

import { useState, useTransition } from "react";
import { directLogin } from "@/app/login/actions";

/** Same GM sign-in form as before, just no longer a plain `<form action={directLogin}>` —
 *  see directLogin's own comment for why: on success this does a real
 *  `window.location.href` instead of letting the framework's client-side route
 *  transition carry the just-set session cookie forward, which some mobile
 *  browsers don't reliably honor. */
export default function LoginForm({ initialError }: { initialError?: string }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState(initialError === "bad");

  const submit = (formData: FormData) => start(async () => {
    setError(false);
    const r = await directLogin(formData);
    if (r.ok) window.location.href = r.redirectTo;
    else setError(true);
  });

  return (
    <form action={submit} className="space-y-3 bg-slate-900/50 border border-slate-800 rounded-2xl p-6 max-w-sm shadow-lg shadow-black/20">
      <label className="block text-sm"><span className="text-slate-300">Email alebo prezývka</span>
        <input name="identifier" autoFocus autoComplete="username" required
          className="mt-1 w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 focus:border-blue-500 outline-none" /></label>
      <label className="block text-sm"><span className="text-slate-300">Heslo</span>
        <input type="password" name="password" autoComplete="current-password" required
          className="mt-1 w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 focus:border-blue-500 outline-none" /></label>
      {error && <p className="text-sm text-red-400">Nesprávny email/prezývka alebo heslo.</p>}
      <button disabled={pending} className="w-full py-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 font-semibold text-sm">
        {pending ? "…" : "Prihlásiť sa"}
      </button>
    </form>
  );
}
