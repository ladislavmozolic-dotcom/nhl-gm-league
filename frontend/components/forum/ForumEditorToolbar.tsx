"use client";

import React from "react";

interface Props {
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  onInsert?: (newText: string) => void;
}

export default function ForumEditorToolbar({ textareaRef, onInsert }: Props) {
  const applyWrap = (before: string, after: string = "", placeholder: string = "") => {
    const el = textareaRef.current;
    if (!el) return;

    const start = el.selectionStart ?? 0;
    const end = el.selectionEnd ?? 0;
    const value = el.value;

    const selectedText = value.substring(start, end) || placeholder;
    const replacement = `${before}${selectedText}${after}`;

    const newValue = value.substring(0, start) + replacement + value.substring(end);
    el.value = newValue;

    if (onInsert) onInsert(newValue);

    el.focus();
    const newCursorPos = start + before.length + selectedText.length;
    el.setSelectionRange(newCursorPos, newCursorPos);
  };

  const insertLinePrefix = (prefix: string) => {
    const el = textareaRef.current;
    if (!el) return;

    const start = el.selectionStart ?? 0;
    const value = el.value;
    const beforeCursor = value.substring(0, start);
    const afterCursor = value.substring(start);

    // If not starting on a new line, add newline
    const needsNewline = beforeCursor.length > 0 && !beforeCursor.endsWith("\n");
    const replacement = `${needsNewline ? "\n" : ""}${prefix} `;

    const newValue = beforeCursor + replacement + afterCursor;
    el.value = newValue;
    if (onInsert) onInsert(newValue);

    el.focus();
    const newPos = start + replacement.length;
    el.setSelectionRange(newPos, newPos);
  };

  const insertLink = () => {
    const url = prompt("Zadaj URL adresu odkazu (napr. https://...):");
    if (!url) return;
    const el = textareaRef.current;
    if (!el) return;

    const start = el.selectionStart ?? 0;
    const end = el.selectionEnd ?? 0;
    const selectedText = el.value.substring(start, end);

    if (selectedText) {
      applyWrap(`[${selectedText}](`, `${url})`);
    } else {
      const title = prompt("Zadaj text odkazu:") || url;
      applyWrap(`[${title}](`, `${url})`);
    }
  };

  const btnClass =
    "px-2 py-1 text-xs font-semibold rounded bg-slate-800/90 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700/70 transition-colors flex items-center justify-center min-w-[28px] h-7 shadow-sm";

  return (
    <div className="flex items-center gap-1.5 p-1.5 bg-slate-900/90 border border-b-0 border-slate-700 rounded-t-lg flex-wrap">
      <button
        type="button"
        onClick={() => applyWrap("**", "**", "bold text")}
        className={btnClass}
        title="Bold (Ctrl+B)"
      >
        <span className="font-bold">B</span>
      </button>
      <button
        type="button"
        onClick={() => applyWrap("*", "*", "italic")}
        className={btnClass}
        title="Italic (Ctrl+I)"
      >
        <span className="italic font-serif">I</span>
      </button>
      <button
        type="button"
        onClick={() => applyWrap("~~", "~~", "strikethrough")}
        className={btnClass}
        title="Strikethrough"
      >
        <span className="line-through">S</span>
      </button>

      <span className="h-4 w-px bg-slate-700/80 mx-0.5" />

      <button
        type="button"
        onClick={() => applyWrap('[quote="GM"]\n', "\n[/quote]", "Quoted text")}
        className={btnClass}
        title="Insert quote [quote]"
      >
        <span className="text-amber-400 font-serif">❝❞</span>
      </button>
      <button
        type="button"
        onClick={insertLink}
        className={btnClass}
        title="Insert link"
      >
        <span>🔗</span>
      </button>
      <button
        type="button"
        onClick={() => applyWrap("`", "`", "code")}
        className={btnClass}
        title="Code"
      >
        <span className="font-mono text-emerald-400 text-[11px]">&lt;/&gt;</span>
      </button>
      <button
        type="button"
        onClick={() => insertLinePrefix("•")}
        className={btnClass}
        title="Bullet list"
      >
        <span>• ≡</span>
      </button>

      <span className="ml-auto text-[10px] text-slate-500 hidden sm:inline-block pr-1 font-mono">
        BBCode / Markdown
      </span>
    </div>
  );
}
