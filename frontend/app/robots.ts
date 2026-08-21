import type { MetadataRoute } from "next";

// Search engines (Google, Bing…) are welcome so the league is findable. AI-training
// scrapers and aggressive SEO crawlers are asked to stay out. (robots.txt is advisory —
// well-behaved bots honour it; hard-blocking bad actors needs a server/Caddy rule.)
const BLOCK = [
  "GPTBot", "OAI-SearchBot", "ChatGPT-User", "ClaudeBot", "anthropic-ai", "Claude-Web",
  "CCBot", "Google-Extended", "Applebot-Extended", "PerplexityBot", "Bytespider",
  "Amazonbot", "SemrushBot", "AhrefsBot", "PetalBot", "DataForSeoBot", "Diffbot",
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: BLOCK, disallow: "/" },
      { userAgent: "*", allow: "/" },
    ],
    host: "https://unhl.eu",
  };
}
