// Minimal, dependency-free Markdown → HTML for admin-authored custom pages / home
// blocks. HTML is escaped first (XSS-safe), then a small block/inline grammar is
// applied. Covers: # ## ### headings, - / * / 1. lists, > quote, --- rule, **bold**,
// *italic*, `code`, [text](url) links (http/https/relative only), and paragraphs.

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function inline(s: string): string {
  let out = esc(s);
  // links [text](url) — sanitize href
  out = out.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_m, text: string, url: string) => {
    const safe = /^(https?:\/\/|\/)/i.test(url) ? url : "#";
    const ext = /^https?:/i.test(safe);
    return `<a href="${safe}"${ext ? ' target="_blank" rel="noopener noreferrer"' : ""} class="text-[color:var(--accent,#60a5fa)] underline hover:no-underline">${text}</a>`;
  });
  out = out.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  out = out.replace(/(^|[^*])\*([^*]+)\*/g, "$1<em>$2</em>");
  out = out.replace(/`([^`]+)`/g, '<code class="px-1 py-0.5 rounded bg-slate-800 text-[13px]">$1</code>');
  return out;
}

/** Render markdown to a safe HTML string. */
export function renderMarkdown(md: string): string {
  const lines = (md ?? "").replace(/\r\n/g, "\n").split("\n");
  const html: string[] = [];
  let i = 0;
  const flushList = (ordered: boolean, items: string[]) => {
    const tag = ordered ? "ol" : "ul";
    const cls = ordered ? "list-decimal" : "list-disc";
    html.push(`<${tag} class="${cls} pl-6 my-3 space-y-1">${items.map((t) => `<li>${inline(t)}</li>`).join("")}</${tag}>`);
  };
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) { i++; continue; }
    let m: RegExpMatchArray | null;
    if ((m = line.match(/^(#{1,3})\s+(.*)$/))) {
      const lvl = m[1].length;
      const size = lvl === 1 ? "text-2xl" : lvl === 2 ? "text-xl" : "text-lg";
      html.push(`<h${lvl} class="${size} font-bold mt-5 mb-2">${inline(m[2])}</h${lvl}>`);
      i++; continue;
    }
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(line.trim())) { html.push('<hr class="my-5 border-slate-700/50" />'); i++; continue; }
    if (/^>\s?/.test(line)) {
      const quote: string[] = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) { quote.push(lines[i].replace(/^>\s?/, "")); i++; }
      html.push(`<blockquote class="border-l-4 border-slate-600 pl-4 my-3 text-slate-300 italic">${inline(quote.join(" "))}</blockquote>`);
      continue;
    }
    if (/^[-*]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^[-*]\s+/.test(lines[i])) { items.push(lines[i].replace(/^[-*]\s+/, "")); i++; }
      flushList(false, items); continue;
    }
    if (/^\d+\.\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\d+\.\s+/.test(lines[i])) { items.push(lines[i].replace(/^\d+\.\s+/, "")); i++; }
      flushList(true, items); continue;
    }
    // paragraph — gather consecutive non-blank, non-special lines
    const para: string[] = [];
    while (i < lines.length && lines[i].trim() && !/^(#{1,3}\s|[-*]\s|\d+\.\s|>|-{3,}|\*{3,})/.test(lines[i])) { para.push(lines[i]); i++; }
    html.push(`<p class="my-3 leading-relaxed">${inline(para.join(" "))}</p>`);
  }
  return html.join("\n");
}
