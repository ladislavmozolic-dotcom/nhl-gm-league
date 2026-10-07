"use client";

import { useState, useRef } from "react";
import ForumEditorToolbar from "@/components/forum/ForumEditorToolbar";
import { createThread } from "@/app/forum/actions";

export default function NewThreadForm({
  category,
}: {
  category: string;
}) {
  const [open, setOpen] = useState(false);
  const [bodyText, setBodyText] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/90 overflow-hidden shadow-lg shadow-black/20">
      <div className="flex items-center justify-between p-3.5 sm:px-4 bg-slate-800/40 border-b border-slate-800/80">
        <div className="flex items-center gap-2">
          <span className="text-base text-emerald-400">✏️</span>
          <h2 className="text-sm font-bold text-slate-100 uppercase tracking-wide">
            Start a new thread
          </h2>
        </div>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white transition-all shadow-sm flex items-center gap-1.5 cursor-pointer"
        >
          <span>{open ? "Close form ✕" : "+ New thread"}</span>
        </button>
      </div>

      {open && (
        <form action={createThread} className="p-4 sm:p-5 space-y-3.5 bg-slate-950/40">
          <input type="hidden" name="category" value={category} />

          <div>
            <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
              Thread title <span className="text-rose-400">*</span>
            </label>
            <input
              name="title"
              required
              maxLength={140}
              placeholder="Enter a concise title for the new thread…"
              className="w-full bg-slate-900 border border-slate-700/80 rounded-lg px-3.5 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-blue-500 shadow-inner"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
              First post text <span className="text-rose-400">*</span>
            </label>
            <div className="rounded-lg border border-slate-700/80 overflow-hidden bg-slate-900 shadow-inner">
              <ForumEditorToolbar
                textareaRef={textareaRef}
                onInsert={(val) => setBodyText(val)}
              />
              <textarea
                ref={textareaRef}
                name="body"
                value={bodyText}
                onChange={(e) => setBodyText(e.target.value)}
                required
                rows={6}
                maxLength={5000}
                placeholder="Thread details, a question, a trade proposal or an announcement… (supports BBCode and Markdown)"
                className="w-full resize-y bg-transparent p-3.5 text-sm leading-relaxed text-slate-100 placeholder:text-slate-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="flex items-center justify-between pt-1">
            <span className="text-[11px] text-slate-500">
              The thread will be published immediately after submitting.
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="px-4 py-2 rounded-lg border border-slate-700 text-xs font-semibold text-slate-300 hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-md shadow-emerald-950/40 cursor-pointer"
              >
                Create thread
              </button>
            </div>
          </div>
        </form>
      )}
    </div>
  );
}
