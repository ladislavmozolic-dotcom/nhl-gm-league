import type { Branding } from "@/lib/site-config";

// Web-app manifest of the standalone UNHL Chat app (served on chat.<domain>, and at /chat/manifest.webmanifest).
export function chatManifest(b: Branding) {
  return {
    name: `${b.leagueName} Chat`, short_name: "UNHL Chat", description: `${b.leagueName} GM chat`,
    id: "/chat", start_url: "/chat", scope: "/chat", display: "standalone" as const, orientation: "portrait-primary" as const,
    background_color: "#46239A", theme_color: "#7C4DDB",
    icons: [
      { src: "/icons/chat-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/chat-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/chat-512-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" as const },
    ],
  };
}
