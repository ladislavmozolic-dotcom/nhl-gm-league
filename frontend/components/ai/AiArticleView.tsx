"use client";

import React, { useMemo, useState } from "react";

interface AiArticleViewProps {
  content: string;
  category?: string;
  model?: string | null;
  onCopy?: () => void;
  lang?: string;
}

// Helper to parse inline markdown: bold, italic, code
function renderInline(text: string): React.ReactNode {
  if (!text) return null;
  // Clean up any rogue leading markdown symbols that might slip in
  const clean = text.replace(/^#+\s*/, "");

  // Split by bold (**...**)
  const parts = clean.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={i} className="font-semibold text-white tracking-wide">
          {part.slice(2, -2)}
        </strong>
      );
    }
    // Handle italic (*...*)
    const subparts = part.split(/(\*[^*]+\*)/g);
    return subparts.map((sub, j) => {
      if (sub.startsWith("*") && sub.endsWith("*")) {
        return (
          <em key={`${i}-${j}`} className="italic text-slate-300">
            {sub.slice(1, -1)}
          </em>
        );
      }
      return sub;
    });
  });
}

// Icon and color badge resolver for items
function resolveItemTheme(label: string): {
  icon: string;
  badgeBg: string;
  badgeText: string;
  borderLeft: string;
} {
  const l = label.toLowerCase();
  if (l.includes("hit") || l.includes("bodycheck") || l.includes("collision")) {
    return {
      icon: "💥",
      badgeBg: "bg-amber-500/10 border-amber-500/30",
      badgeText: "text-amber-400",
      borderLeft: "border-l-amber-500",
    };
  }
  if (l.includes("injury") || l.includes("zranen") || l.includes("ward")) {
    return {
      icon: "🚑",
      badgeBg: "bg-rose-500/10 border-rose-500/30",
      badgeText: "text-rose-400",
      borderLeft: "border-l-rose-500",
    };
  }
  if (l.includes("hot") || l.includes("streak") || l.includes("vlne") || l.includes("fire")) {
    return {
      icon: "🔥",
      badgeBg: "bg-emerald-500/10 border-emerald-500/30",
      badgeText: "text-emerald-400",
      borderLeft: "border-l-emerald-500",
    };
  }
  if (l.includes("cold") || l.includes("slump") || l.includes("kríz") || l.includes("ice")) {
    return {
      icon: "❄️",
      badgeBg: "bg-cyan-500/10 border-cyan-500/30",
      badgeText: "text-cyan-400",
      borderLeft: "border-l-cyan-500",
    };
  }
  if (l.includes("strength") || l.includes("siln") || l.includes("prednosť")) {
    return {
      icon: "✅",
      badgeBg: "bg-emerald-500/10 border-emerald-500/30",
      badgeText: "text-emerald-400",
      borderLeft: "border-l-emerald-500",
    };
  }
  if (l.includes("weak") || l.includes("slabin") || l.includes("nedostat") || l.includes("kritick")) {
    return {
      icon: "⚠️",
      badgeBg: "bg-amber-500/10 border-amber-500/30",
      badgeText: "text-amber-400",
      borderLeft: "border-l-amber-500",
    };
  }
  if (l.includes("comparable") || l.includes("prirovnan") || l.includes("star")) {
    return {
      icon: "⭐",
      badgeBg: "bg-purple-500/10 border-purple-500/30",
      badgeText: "text-purple-300",
      borderLeft: "border-l-purple-500",
    };
  }
  if (l.includes("verdict") || l.includes("verdikt") || l.includes("takeaway") || l.includes("ponaučenie")) {
    return {
      icon: "⚖️",
      badgeBg: "bg-blue-500/10 border-blue-500/30",
      badgeText: "text-blue-300",
      borderLeft: "border-l-blue-500",
    };
  }
  if (l.includes("cap") || l.includes("plat") || l.includes("zmluv") || l.includes("contract")) {
    return {
      icon: "💼",
      badgeBg: "bg-indigo-500/10 border-indigo-500/30",
      badgeText: "text-indigo-300",
      borderLeft: "border-l-indigo-500",
    };
  }
  if (l.includes("taktik") || l.includes("tactic") || l.includes("coach") || l.includes("tréner")) {
    return {
      icon: "🏒",
      badgeBg: "bg-sky-500/10 border-sky-500/30",
      badgeText: "text-sky-300",
      borderLeft: "border-l-sky-500",
    };
  }
  return {
    icon: "📌",
    badgeBg: "bg-slate-800 border-slate-700",
    badgeText: "text-slate-300",
    borderLeft: "border-l-slate-600",
  };
}

type ArticleSection =
  | { type: "h2"; text: string }
  | { type: "h3"; text: string }
  | { type: "lead"; text: string }
  | { type: "paragraph"; text: string }
  | { type: "numberedStep"; num: string; label: string; text: string }
  | { type: "bulletList"; items: Array<{ label?: string; text: string }> }
  | { type: "highlightGrid"; items: Array<{ label: string; text: string }> }
  | { type: "quote"; text: string }
  | { type: "divider" };

export default function AiArticleView({
  content,
  category = "UNHL EDITORIAL",
  model,
  onCopy,
  lang = "en",
}: AiArticleViewProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    if (onCopy) onCopy();
    else navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Structured parser
  const parsed = useMemo(() => {
    const rawLines = (content || "").replace(/\r\n/g, "\n").split("\n");
    let mainTitle = "";
    let subTitle = "";
    const sections: ArticleSection[] = [];

    let currentBullets: Array<{ label?: string; text: string }> = [];
    let isFirstParagraph = true;

    const flushBullets = () => {
      if (currentBullets.length === 0) return;

      // Check if these bullets qualify as bite-sized highlight cards (e.g., short highlights with labels)
      const allHaveLabels = currentBullets.every((b) => Boolean(b.label && b.label.length > 0));
      const allShort = currentBullets.every((b) => (b.text || "").length < 160);

      if (currentBullets.length >= 2 && allHaveLabels && allShort) {
        sections.push({
          type: "highlightGrid",
          items: currentBullets.map((b) => ({ label: b.label || "", text: b.text })),
        });
      } else {
        sections.push({
          type: "bulletList",
          items: [...currentBullets],
        });
      }
      currentBullets = [];
    };

    for (let i = 0; i < rawLines.length; i++) {
      const line = rawLines[i].trim();
      if (!line) continue;

      // Top level header: # Title
      if (line.startsWith("# ") && !mainTitle) {
        flushBullets();
        mainTitle = line.replace(/^#+\s*/, "").replace(/\*\*/g, "").trim();
        continue;
      }

      // Any other header: # Header, ## Header, ### Header
      if (line.startsWith("## ") || (line.startsWith("# ") && mainTitle)) {
        flushBullets();
        const text = line.replace(/^#+\s*/, "").replace(/\*\*/g, "").trim();
        if (!mainTitle) {
          mainTitle = text;
        } else if (!subTitle && sections.length === 0) {
          subTitle = text;
        } else {
          sections.push({ type: "h2", text });
        }
        continue;
      }

      // H3 subheader: ### Section or #### Section
      if (line.startsWith("### ") || line.startsWith("#### ")) {
        flushBullets();
        const text = line.replace(/^#+\s*/, "").replace(/\*\*/g, "").trim();
        sections.push({ type: "h3", text });
        continue;
      }

      // Standalone bold heading on its own line: e.g. **1. 📊 Diagnóza a stav tímu** or **Kľúčové zistenia:**
      const boldHeadingMatch = line.match(/^\*\*(\d+\.?[^*]+|\b[A-ZÀ-Ž][^*:]+)\*\*[:\s]*$/);
      if (boldHeadingMatch) {
        flushBullets();
        const headerText = boldHeadingMatch[1].trim();
        sections.push({ type: "h2", text: headerText });
        continue;
      }

      // Divider: ---
      if (/^(-{3,}|\*{3,})$/.test(line)) {
        flushBullets();
        sections.push({ type: "divider" });
        continue;
      }

      // Blockquote: > ...
      if (line.startsWith(">")) {
        flushBullets();
        sections.push({ type: "quote", text: line.replace(/^>\s?/, "").trim() });
        continue;
      }

      // Numbered step: 1. **Label:** text or 1. Label - text or 1. text
      const numberedMatch = line.match(/^(\d+)\.\s+(?:\*\*([^*]+)\*\*[:\s]*|\b([A-ZÀ-Ž][^:\-–]{2,40})[:\-–]\s*)(.*)$/);
      if (numberedMatch) {
        flushBullets();
        const num = numberedMatch[1];
        const label = (numberedMatch[2] || numberedMatch[3] || "").trim();
        const body = (numberedMatch[4] || "").trim();

        // If body has content, render as a clean full-width numbered strategic section
        if (body.length > 0) {
          sections.push({
            type: "numberedStep",
            num,
            label,
            text: body,
          });
          continue;
        } else {
          // It's a heading like "1. 📊 Diagnóza a stav tímu"
          sections.push({
            type: "h2",
            text: `${num}. ${label}`,
          });
          continue;
        }
      }

      // Simple numbered list item: 1. Description
      const plainNumMatch = line.match(/^(\d+)\.\s+(.*)$/);
      if (plainNumMatch) {
        flushBullets();
        sections.push({
          type: "numberedStep",
          num: plainNumMatch[1],
          label: "",
          text: plainNumMatch[2].trim(),
        });
        continue;
      }

      // Bullet items: * **Label:** Description or - **Label:** Description
      const bulletWithLabel = line.match(/^[-*•]\s+(?:\*\*([^*]+)\*\*[:\s]*)(.*)$/);
      if (bulletWithLabel) {
        currentBullets.push({
          label: bulletWithLabel[1].trim(),
          text: bulletWithLabel[2].trim(),
        });
        continue;
      }

      // Plain bullet item: * Description or - Description
      const plainBullet = line.match(/^[-*•]\s+(.*)$/);
      if (plainBullet) {
        currentBullets.push({
          label: "",
          text: plainBullet[1].trim(),
        });
        continue;
      }

      // Plain paragraph
      flushBullets();
      if (isFirstParagraph) {
        sections.push({ type: "lead", text: line });
        isFirstParagraph = false;
      } else {
        sections.push({ type: "paragraph", text: line });
      }
    }

    flushBullets();

    // Fallback if no # header was used (e.g. first line was a bold title)
    if (!mainTitle && sections.length > 0 && sections[0].type === "lead") {
      const first = sections[0].text || "";
      if (first.startsWith("**") && first.endsWith("**")) {
        mainTitle = first.replace(/\*\*/g, "");
        sections.shift();
      }
    }

    return { mainTitle, subTitle, sections };
  }, [content]);

  // Estimate reading time (~180 words per min)
  const readTime = useMemo(() => {
    const words = (content || "").split(/\s+/).length;
    return Math.max(1, Math.round(words / 180));
  }, [content]);

  return (
    <article className="rounded-2xl bg-gradient-to-br from-slate-950 via-slate-900/95 to-slate-950 border border-slate-800/90 shadow-2xl overflow-hidden relative">
      {/* Subtle ice glow decoration */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-bl from-blue-500/10 via-indigo-500/5 to-transparent pointer-events-none blur-3xl" />
      <div className="absolute bottom-0 left-0 w-80 h-80 bg-gradient-to-tr from-sky-500/5 via-cyan-500/5 to-transparent pointer-events-none blur-3xl" />

      {/* Editorial Masthead / Header Bar */}
      <div className="border-b border-slate-800/80 px-6 py-4 flex flex-wrap items-center justify-between gap-3 bg-slate-950/70 backdrop-blur-sm relative z-10">
        <div className="flex items-center gap-2.5">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-[11px] font-black uppercase tracking-widest text-slate-400 font-mono">
            {category}
          </span>
          <span className="text-slate-600">·</span>
          <span className="text-[11px] text-slate-400 font-mono flex items-center gap-1">
            <span>⏱️</span>
            <span>{readTime} {lang === "cs" ? "min. čítania" : "min read"}</span>
          </span>
        </div>

        <div className="flex items-center gap-2.5">
          {model && (
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-blue-950/80 text-blue-300 border border-blue-800/50">
              ⚡ {model}
            </span>
          )}
          <button
            onClick={handleCopy}
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700/60 transition shadow-sm"
          >
            {copied ? (
              <>
                <span className="text-emerald-400">✓</span>
                <span className="text-emerald-400">{lang === "cs" ? "Skopírované" : "Copied"}</span>
              </>
            ) : (
              <>
                <span>📋</span>
                <span>{lang === "cs" ? "Kopírovať článok" : "Copy article"}</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Main Headline & Lead Section */}
      <div className="px-6 sm:px-8 pt-6 pb-2 relative z-10">
        {parsed.mainTitle && (
          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight leading-snug mb-3">
            {parsed.mainTitle}
          </h1>
        )}

        {parsed.subTitle && (
          <h2 className="text-sm sm:text-base font-bold text-sky-400 tracking-wide uppercase mb-3 flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-sky-400" />
            {parsed.subTitle}
          </h2>
        )}
      </div>

      {/* Article Content Stream */}
      <div className="px-6 sm:px-8 pb-8 space-y-4 text-slate-300 relative z-10 text-sm sm:text-[15px] leading-relaxed">
        {parsed.sections.map((sec, idx) => {
          if (sec.type === "h2") {
            return (
              <div key={idx} className="pt-6 pb-2 border-b border-slate-800/70">
                <h2 className="text-lg sm:text-xl font-bold text-white tracking-tight flex items-center gap-2.5">
                  <span className="w-2.5 h-2.5 rounded bg-gradient-to-r from-blue-500 to-indigo-500 shrink-0" />
                  <span>{renderInline(sec.text)}</span>
                </h2>
              </div>
            );
          }

          if (sec.type === "h3") {
            return (
              <div key={idx} className="pt-4 pb-1">
                <h3 className="text-sm sm:text-base font-extrabold uppercase tracking-wider text-slate-200 flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-sky-400 shrink-0" />
                  <span>{renderInline(sec.text)}</span>
                </h3>
              </div>
            );
          }

          if (sec.type === "divider") {
            return (
              <div key={idx} className="py-3 flex items-center gap-3">
                <div className="flex-1 h-px bg-gradient-to-r from-transparent via-slate-800 to-transparent" />
                <span className="text-slate-600 text-xs font-mono">🏒 ⚡ 🏒</span>
                <div className="flex-1 h-px bg-gradient-to-r from-transparent via-slate-800 to-transparent" />
              </div>
            );
          }

          if (sec.type === "quote") {
            return (
              <blockquote
                key={idx}
                className="my-3 rounded-xl bg-blue-950/20 border-l-4 border-blue-500 px-4 py-3 text-sm italic text-blue-200 shadow-inner"
              >
                {renderInline(sec.text)}
              </blockquote>
            );
          }

          if (sec.type === "lead") {
            return (
              <p
                key={idx}
                className="text-base sm:text-lg text-slate-100 font-medium leading-relaxed bg-slate-900/40 p-5 rounded-xl border border-slate-800/80 shadow-sm"
              >
                {renderInline(sec.text)}
              </p>
            );
          }

          // Full-width structured strategic recommendation or step
          if (sec.type === "numberedStep") {
            const theme = resolveItemTheme(sec.label || sec.text);
            return (
              <div
                key={idx}
                className={`my-3 rounded-xl bg-slate-900/60 border border-slate-800/90 p-4 border-l-4 ${theme.borderLeft} shadow-md`}
              >
                <div className="flex items-center gap-2.5 mb-2">
                  <span className="inline-flex items-center justify-center w-6 h-6 rounded-lg bg-blue-950/80 border border-blue-700/50 text-blue-300 font-mono font-bold text-xs">
                    {sec.num}
                  </span>
                  {sec.label && (
                    <span className="text-sm font-bold text-white tracking-wide flex items-center gap-1.5">
                      <span>{theme.icon}</span>
                      <span>{renderInline(sec.label)}</span>
                    </span>
                  )}
                </div>
                <div className="text-slate-300 leading-relaxed text-sm pl-8">
                  {renderInline(sec.text)}
                </div>
              </div>
            );
          }

          // Highlight Bite Cards (short highlights in 2 columns)
          if (sec.type === "highlightGrid") {
            return (
              <div key={idx} className="grid gap-3 sm:grid-cols-2 my-4">
                {sec.items.map((item, itemIdx) => {
                  const theme = resolveItemTheme(item.label || item.text);
                  return (
                    <div
                      key={itemIdx}
                      className={`rounded-xl bg-slate-900/70 border border-slate-800/90 p-4 border-l-4 ${theme.borderLeft} shadow-md hover:bg-slate-900/90 transition-all flex flex-col justify-between`}
                    >
                      {item.label && (
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-base">{theme.icon}</span>
                          <span className={`text-xs font-extrabold uppercase tracking-wide ${theme.badgeText}`}>
                            {item.label}
                          </span>
                        </div>
                      )}
                      <p className="text-xs sm:text-sm text-slate-300 leading-snug">
                        {renderInline(item.text)}
                      </p>
                    </div>
                  );
                })}
              </div>
            );
          }

          // Clean, full-width bulleted list
          if (sec.type === "bulletList") {
            return (
              <ul key={idx} className="space-y-2.5 my-3 pl-1">
                {sec.items.map((item, itemIdx) => {
                  const theme = resolveItemTheme(item.label || item.text);
                  return (
                    <li key={itemIdx} className="flex items-start gap-3 text-slate-300 text-sm leading-relaxed">
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-400 mt-2 shrink-0" />
                      <div>
                        {item.label && (
                          <span className="font-semibold text-white mr-1.5 inline-flex items-center gap-1">
                            {theme.icon !== "📌" && <span>{theme.icon}</span>}
                            <span>{item.label}:</span>
                          </span>
                        )}
                        <span>{renderInline(item.text)}</span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            );
          }

          return (
            <p key={idx} className="text-slate-300 leading-relaxed font-normal">
              {renderInline(sec.text)}
            </p>
          );
        })}
      </div>
    </article>
  );
}
