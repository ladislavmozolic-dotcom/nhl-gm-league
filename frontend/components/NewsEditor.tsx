"use client";

import { useRef, useState, useTransition } from "react";
import { createArticle } from "@/app/news/actions";

export default function NewsEditor() {
  const [title, setTitle] = useState("");
  const bodyRef = useRef<HTMLDivElement>(null);
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  const cmd = (command: string, value?: string) => {
    bodyRef.current?.focus();
    document.execCommand(command, false, value);
  };

  const insertImage = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => { bodyRef.current?.focus(); document.execCommand("insertImage", false, String(reader.result)); };
    reader.readAsDataURL(file);
  };

  const submit = () => start(async () => {
    setErr(null);
    const html = bodyRef.current?.innerHTML ?? "";
    if (!title.trim()) { setErr("Add a title."); return; }
    if (!html.replace(/<[^>]+>/g, "").trim() && !/<img/.test(html)) { setErr("Write something."); return; }
    try { await createArticle(title, html); } catch (e) { setErr((e as Error).message); }
  });

  const Btn = ({ onClick, children, title }: { onClick: () => void; children: React.ReactNode; title: string }) => (
    <button type="button" title={title} onMouseDown={(e) => { e.preventDefault(); onClick(); }}
      className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 border border-slate-700 text-sm text-slate-200">{children}</button>
  );

  return (
    <div className="max-w-3xl mx-auto px-4">
      <h1 className="text-2xl font-bold mb-4">Write an Article</h1>

      <label className="block text-xs uppercase tracking-wide text-slate-500 mb-1">Headline</label>
      <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Article title…"
        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-3 text-lg font-bold mb-4" />

      <label className="block text-xs uppercase tracking-wide text-slate-500 mb-1">Body</label>
      <div className="flex flex-wrap items-center gap-1.5 bg-slate-900/60 border border-slate-700 rounded-t-lg px-2 py-2">
        <Btn onClick={() => cmd("bold")} title="Bold"><b>B</b></Btn>
        <Btn onClick={() => cmd("italic")} title="Italic"><i>I</i></Btn>
        <Btn onClick={() => cmd("underline")} title="Underline"><u>U</u></Btn>
        <span className="w-px h-5 bg-slate-700 mx-1" />
        <Btn onClick={() => cmd("formatBlock", "H2")} title="Large heading">H1</Btn>
        <Btn onClick={() => cmd("formatBlock", "H3")} title="Small heading">H2</Btn>
        <Btn onClick={() => cmd("formatBlock", "P")} title="Normal text">P</Btn>
        <span className="w-px h-5 bg-slate-700 mx-1" />
        <Btn onClick={() => cmd("fontSize", "5")} title="Bigger text">A+</Btn>
        <Btn onClick={() => cmd("fontSize", "2")} title="Smaller text">A−</Btn>
        <Btn onClick={() => cmd("insertUnorderedList")} title="Bullet list">• List</Btn>
        <span className="w-px h-5 bg-slate-700 mx-1" />
        <label className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 border border-slate-700 text-sm text-slate-200 cursor-pointer">
          🖼 Image
          <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) insertImage(f); e.target.value = ""; }} />
        </label>
      </div>
      <div ref={bodyRef} contentEditable suppressContentEditableWarning
        className="news-body min-h-[280px] bg-slate-900 border border-t-0 border-slate-700 rounded-b-lg px-4 py-3 focus:outline-none prose-invert"
        style={{ maxWidth: "100%" }} />

      <div className="flex items-center gap-3 mt-4">
        <button onClick={submit} disabled={pending}
          className="px-5 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 font-semibold text-sm disabled:opacity-50">
          {pending ? "Publishing…" : "Publish"}
        </button>
        {err && <span className="text-red-400 text-sm">{err}</span>}
        <span className="text-xs text-slate-500">Images are embedded in the article. Keep them reasonably small.</span>
      </div>
    </div>
  );
}
