import sanitizeHtml from "sanitize-html";

const DATA_IMAGE = /^data:image\/(?:png|jpeg|gif|webp);base64,[a-z0-9+/=\s]+$/i;

/**
 * Keep the formatting exposed by NewsEditor while removing scripts, event
 * handlers, embedded documents, unsafe URLs and pasted inline CSS.
 *
 * This runs on write and read: write-time cleaning keeps new rows safe, while
 * read-time cleaning protects pages from articles saved before it existed.
 */
export function sanitizeArticleHtml(input: string): string {
  return sanitizeHtml(input ?? "", {
    allowedTags: [
      "p", "div", "br", "h1", "h2", "h3",
      "b", "strong", "i", "em", "u", "s", "strike",
      "ul", "ol", "li", "blockquote", "pre", "code",
      "a", "img", "hr", "span", "font",
    ],
    allowedAttributes: {
      a: ["href", "title", "target", "rel"],
      img: ["src", "alt", "width", "height"],
      hr: ["class"],
      font: ["size"],
    },
    allowedClasses: { hr: ["article-cut"] },
    allowedSchemes: ["http", "https", "mailto"],
    allowedSchemesByTag: { img: ["http", "https", "data"] },
    allowProtocolRelative: false,
    // Data images are created by the editor. SVG and arbitrary data: payloads
    // are excluded because they can contain active content.
    exclusiveFilter: (frame) =>
      frame.tag === "img" &&
      typeof frame.attribs.src === "string" &&
      /^data:/i.test(frame.attribs.src) &&
      !DATA_IMAGE.test(frame.attribs.src),
    transformTags: {
      a: (tagName, attribs) => ({
        tagName,
        attribs: {
          ...attribs,
          ...(attribs.target === "_blank" ? { rel: "noopener noreferrer" } : {}),
        },
      }),
    },
  });
}

export function articlePlainText(html: string): string {
  return sanitizeArticleHtml(html)
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
}
