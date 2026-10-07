import React from "react";

/**
 * Parses and renders forum post bodies with support for:
 * - phpBB quotes: [quote="GM Name"]...[/quote] or [quote]...[/quote]
 * - Markdown blockquotes: > GM Name: ...
 * - BBCode & Markdown formatting: **bold**, *italic*, [b], [i], URLs, inline code.
 */
export default function ForumPostContent({ content }: { content: string }) {
  const rendered = parsePostContent(content);
  return (
    <div className="text-[14px] sm:text-[15px] leading-relaxed text-slate-200 break-words space-y-2.5">
      {rendered}
    </div>
  );
}

function parsePostContent(text: string): React.ReactNode[] {
  if (!text) return [];

  // Normalize Windows newlines
  const normalized = text.replace(/\r\n/g, "\n");

  // Regex to extract [quote="..."]...[/quote] or [quote]...[/quote]
  // and handle markdown-style blockquotes (contiguous lines starting with >)
  const blocks: React.ReactNode[] = [];
  const lines = normalized.split("\n");
  let currentParagraphLines: string[] = [];
  let currentQuoteLines: string[] = [];
  let currentQuoteAuthor: string | null = null;
  let inBbQuote = false;
  let bbQuoteAuthor: string | null = null;
  let bbQuoteLines: string[] = [];

  const flushParagraph = () => {
    if (currentParagraphLines.length > 0) {
      const pText = currentParagraphLines.join("\n");
      blocks.push(
        <div key={`p-${blocks.length}`} className="whitespace-pre-wrap">
          {renderInline(pText)}
        </div>
      );
      currentParagraphLines = [];
    }
  };

  const flushMdQuote = () => {
    if (currentQuoteLines.length > 0) {
      const qText = currentQuoteLines.join("\n");
      blocks.push(
        <div
          key={`quote-${blocks.length}`}
          className="my-3 rounded-lg border border-slate-700/80 bg-slate-800/40 overflow-hidden shadow-inner text-sm"
        >
          <div className="bg-slate-800/90 px-3 py-1.5 text-[11px] font-bold text-slate-300 border-b border-slate-700/60 flex items-center gap-1.5">
            <span className="text-blue-400 font-serif text-sm">❝</span>
            <span>
              {currentQuoteAuthor
                ? `Quote: ${currentQuoteAuthor} wrote:`
                : "Quote:"}
            </span>
          </div>
          <div className="p-3 text-slate-300 italic whitespace-pre-wrap text-[13.5px] leading-relaxed border-l-2 border-blue-500/50">
            {renderInline(qText)}
          </div>
        </div>
      );
      currentQuoteLines = [];
      currentQuoteAuthor = null;
    }
  };

  const flushBbQuote = () => {
    if (bbQuoteLines.length > 0) {
      const qText = bbQuoteLines.join("\n");
      blocks.push(
        <div
          key={`bbquote-${blocks.length}`}
          className="my-3 rounded-lg border border-slate-700/80 bg-slate-800/40 overflow-hidden shadow-inner text-sm"
        >
          <div className="bg-slate-800/90 px-3 py-1.5 text-[11px] font-bold text-slate-300 border-b border-slate-700/60 flex items-center gap-1.5">
            <span className="text-blue-400 font-serif text-sm">❝</span>
            <span>
              {bbQuoteAuthor
                ? `Quote: ${bbQuoteAuthor} wrote:`
                : "Quote:"}
            </span>
          </div>
          <div className="p-3 text-slate-300 italic whitespace-pre-wrap text-[13.5px] leading-relaxed border-l-2 border-blue-500/50">
            {renderInline(qText)}
          </div>
        </div>
      );
      bbQuoteLines = [];
      bbQuoteAuthor = null;
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Check for BBCode quote tags
    const bbQuoteStartMatch = line.match(/^\[quote(?:="([^"]*)")?\](.*)$/i);
    const bbQuoteEndMatch = line.match(/^(.*)\[\/quote\]$/i);

    if (inBbQuote) {
      if (bbQuoteEndMatch) {
        if (bbQuoteEndMatch[1]) bbQuoteLines.push(bbQuoteEndMatch[1]);
        inBbQuote = false;
        flushBbQuote();
      } else {
        bbQuoteLines.push(line);
      }
      continue;
    }

    if (bbQuoteStartMatch) {
      flushParagraph();
      flushMdQuote();
      inBbQuote = true;
      bbQuoteAuthor = bbQuoteStartMatch[1] || null;
      if (bbQuoteStartMatch[2]) {
        if (bbQuoteEndMatch) {
          // single line quote [quote="author"]text[/quote]
          const singleContent = line.replace(/^\[quote(?:="([^"]*)")?\]/i, "").replace(/\[\/quote\]$/i, "");
          bbQuoteLines.push(singleContent);
          inBbQuote = false;
          flushBbQuote();
        } else {
          bbQuoteLines.push(bbQuoteStartMatch[2]);
        }
      }
      continue;
    }

    // Markdown blockquote line: begins with >
    if (line.startsWith(">")) {
      flushParagraph();
      let quoteContent = line.slice(1).trim();

      // Check if author was prepended like "> Ladislav: text" or "> **Ladislav**:"
      const authorMatch = quoteContent.match(/^\*{0,2}([^:*]+)\*{0,2}:\s*(.*)$/);
      if (authorMatch && !currentQuoteAuthor && currentQuoteLines.length === 0) {
        currentQuoteAuthor = authorMatch[1].trim();
        quoteContent = authorMatch[2];
      }
      currentQuoteLines.push(quoteContent);
      continue;
    } else if (currentQuoteLines.length > 0) {
      flushMdQuote();
    }

    currentParagraphLines.push(line);
  }

  flushMdQuote();
  if (inBbQuote) flushBbQuote();
  flushParagraph();

  return blocks;
}

function renderInline(text: string): React.ReactNode {
  // Replace links, bbcode [b]...[/b], [i]...[/i], markdown **...**, *...*, `code`
  // We tokenize text by splitting with regex
  const parts: React.ReactNode[] = [];
  let remaining = text;
  let idx = 0;

  // Regex for tokens: URLs, bold markdown, bold bbcode, italic markdown, italic bbcode, code
  const tokenRegex = /(https?:\/\/[^\s<]+)|(\*\*([^*]+)\*\*)|(\*([^*]+)\*)|(\[b\]([\s\S]*?)\[\/b\])|(\[i\]([\s\S]*?)\[\/i\])|(`([^`]+)`)/i;

  while (remaining) {
    const match = remaining.match(tokenRegex);
    if (!match || match.index === undefined) {
      parts.push(remaining);
      break;
    }

    const before = remaining.slice(0, match.index);
    if (before) {
      parts.push(before);
    }

    const matchedStr = match[0];
    const url = match[1];
    const mdBold = match[3];
    const mdItalic = match[5];
    const bbBold = match[7];
    const bbItalic = match[9];
    const code = match[11];

    if (url) {
      parts.push(
        <a
          key={`link-${idx++}`}
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-400 hover:text-blue-300 underline underline-offset-2 break-all"
        >
          {url}
        </a>
      );
    } else if (mdBold || bbBold) {
      parts.push(<strong key={`b-${idx++}`} className="font-bold text-white">{mdBold || bbBold}</strong>);
    } else if (mdItalic || bbItalic) {
      parts.push(<em key={`i-${idx++}`} className="italic">{mdItalic || bbItalic}</em>);
    } else if (code) {
      parts.push(
        <code key={`code-${idx++}`} className="px-1.5 py-0.5 rounded bg-slate-800 text-amber-300 font-mono text-[13px] border border-slate-700">
          {code}
        </code>
      );
    } else {
      parts.push(matchedStr);
    }

    remaining = remaining.slice(match.index + matchedStr.length);
  }

  return parts;
}
