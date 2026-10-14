import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// chat.<domain> is the standalone UNHL Chat app on its own origin (so Chrome/Safari
// treat it as a separate installable app from the league site). Its home → /chat.
export function proxy(request: NextRequest) {
  const host = request.headers.get("host") ?? "";
  if (host.startsWith("chat.")) return NextResponse.rewrite(new URL("/chat", request.url));
  return NextResponse.next();
}

export const config = { matcher: "/" };
