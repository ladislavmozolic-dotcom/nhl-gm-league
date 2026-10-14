import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// chat.<domain> is the standalone UNHL Chat app on its own origin (so Chrome/Safari treat it as a
// separate installable app from the league site).
//  • on the chat host, its home "/" → /chat
//  • on the league host, /chat… → redirect to the chat origin, so nobody can install the chat from the
//    league's origin (that gives a home-screen icon that launches the LEAGUE).
export function proxy(request: NextRequest) {
  const host = request.headers.get("host") ?? "";
  if (host.startsWith("chat.")) {
    if (request.nextUrl.pathname === "/") return NextResponse.rewrite(new URL("/chat", request.url));
    return NextResponse.next();
  }
  const chatOrigin = process.env.CHAT_ORIGIN;
  if (chatOrigin) return NextResponse.redirect(`${chatOrigin}${request.nextUrl.pathname}${request.nextUrl.search}`, 307);
  return NextResponse.next();
}

export const config = { matcher: ["/", "/chat", "/chat/:path*"] };
