"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { createArticle, updateArticle } from "@/app/news/actions";

function EditorButton({ onClick, children, title }: { onClick: () => void; children: React.ReactNode; title: string }) {
  return (
    <button type="button" title={title} onMouseDown={(e) => { e.preventDefault(); onClick(); }}
      className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 border border-slate-700 text-sm text-slate-200">{children}</button>
  );
}

export default function NewsEditor({ initial }: { initial?: { id: number; title: string; bodyHtml: string } }) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const bodyRef = useRef<HTMLDivElement>(null);
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  // Prefill the editable body once on mount — a contentEditable div can't take
  // its initial content as a React prop (it's not a controlled input), so this
  // is the one time its innerHTML gets set directly rather than through state.
  useEffect(() => { if (initial && bodyRef.current) bodyRef.current.innerHTML = initial.bodyHtml; }, [initial]);

  const cmd = (command: string, value?: string) => {
    bodyRef.current?.focus();
    document.execCommand(command, false, value);
  };

  const insertImage = (file: File) => {
    if (!/^image\/(png|jpeg|gif|webp)$/.test(file.type)) { setErr("Use a PNG, JPG, GIF or WEBP image."); return; }
    if (file.size > 4_000_000) { setErr("Image is too large (max 4 MB)."); return; }
    const reader = new FileReader();
    reader.onload = () => { bodyRef.current?.focus(); document.execCommand("insertImage", false, String(reader.result)); };
    reader.readAsDataURL(file);
  };

  // Marks where the homepage preview cuts off — everything before this line is
  // the perex shown on the home feed, everything after only shows once a reader
  // clicks through to the full article.
  const insertCut = () => { bodyRef.current?.focus(); document.execCommand("insertHTML", false, '<hr class="article-cut">'); };

  const submit = () => start(async () => {
    setErr(null);
    const html = bodyRef.current?.innerHTML ?? "";
    if (!title.trim()) { setErr("Add a title."); return; }
    if (!html.replace(/<[^>]+>/g, "").trim() && !/<img/.test(html)) { setErr("Write something."); return; }
    try {
      if (initial) await updateArticle(initial.id, title, html);
      else await createArticle(title, html);
    } catch (e) { setErr((e as Error).message); }
  });

  return (
    <div className="max-w-3xl mx-auto px-4">
      <h1 className="text-2xl font-bold mb-4">{initial ? "Edit Article" : "Write an Article"}</h1>

      <label className="block text-xs uppercase tracking-wide text-slate-500 mb-1">Headline</label>
      <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Article title…"
        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-3 text-lg font-bold mb-4" />

      <label className="block text-xs uppercase tracking-wide text-slate-500 mb-1">Body</label>
      <div className="flex flex-wrap items-center gap-1.5 bg-slate-900/60 border border-slate-700 rounded-t-lg px-2 py-2">
        <EditorButton onClick={() => cmd("bold")} title="Bold"><b>B</b></EditorButton>
        <EditorButton onClick={() => cmd("italic")} title="Italic"><i>I</i></EditorButton>
        <EditorButton onClick={() => cmd("underline")} title="Underline"><u>U</u></EditorButton>
        <span className="w-px h-5 bg-slate-700 mx-1" />
        <EditorButton onClick={() => cmd("formatBlock", "H2")} title="Large heading">H1</EditorButton>
        <EditorButton onClick={() => cmd("formatBlock", "H3")} title="Small heading">H2</EditorButton>
        <EditorButton onClick={() => cmd("formatBlock", "P")} title="Normal text">P</EditorButton>
        <span className="w-px h-5 bg-slate-700 mx-1" />
        <EditorButton onClick={() => cmd("fontSize", "5")} title="Bigger text">A+</EditorButton>
        <EditorButton onClick={() => cmd("fontSize", "2")} title="Smaller text">A−</EditorButton>
        <EditorButton onClick={() => cmd("insertUnorderedList")} title="Bullet list">• List</EditorButton>
        <span className="w-px h-5 bg-slate-700 mx-1" />
        <EditorButton onClick={insertCut} title="Insert a cut line — text above becomes the homepage preview, text below only shows after Read more">✂️ Perex cut</EditorButton>
        <span className="w-px h-5 bg-slate-700 mx-1" />
        <label className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 border border-slate-700 text-sm text-slate-200 cursor-pointer">
          🖼 Image
          <input type="file" accept="image/png,image/jpeg,image/gif,image/webp" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) insertImage(f); e.target.value = ""; }} />
        </label>
      </div>
      <div ref={bodyRef} contentEditable suppressContentEditableWarning
        className="news-body min-h-[280px] bg-slate-900 border border-t-0 border-slate-700 rounded-b-lg px-4 py-3 focus:outline-none prose-invert"
        style={{ maxWidth: "100%" }} />

      <div className="flex items-center gap-3 mt-4">
        <button onClick={submit} disabled={pending}
          className="px-5 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 font-semibold text-sm disabled:opacity-50">
          {pending ? (initial ? "Saving…" : "Publishing…") : (initial ? "Save changes" : "Publish")}
        </button>
        {err && <span className="text-red-400 text-sm">{err}</span>}
        <span className="text-xs text-slate-500">Images are embedded in the article. Keep them reasonably small.</span>
      </div>
    </div>
  );
}
