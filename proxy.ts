import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Keeps signed-out visitors out of the application shell.
 *
 * Note this is `proxy.ts`, not `middleware.ts` — the middleware convention is
 * deprecated in this version of Next.
 *
 * This only checks that a session cookie is present. It deliberately does not
 * verify the signature or read the database: proxy runs before rendering and may
 * be deployed to a CDN edge, and the docs are explicit that it should not depend
 * on shared modules. The real check — signature, account still active, session
 * not revoked — happens in the app layout, which is what actually guards the
 * data. This just saves a signed-out visitor a pointless round trip.
 */
export function proxy(request: NextRequest) {
  const hasSession = request.cookies.has("herdwise_session");
  if (hasSession) return NextResponse.next();

  const url = request.nextUrl.clone();
  url.pathname = "/login";
  url.search = `?next=${encodeURIComponent(request.nextUrl.pathname)}`;
  return NextResponse.redirect(url);
}

export const config = {
  // The marketing page, the login screen and the auth endpoints stay public.
  matcher: [
    "/dashboard/:path*", "/tracking/:path*", "/livestock/:path*", "/owners/:path*",
    "/geofences/:path*", "/incidents/:path*", "/health/:path*", "/analytics/:path*",
    "/settings/:path*", "/tags/:path*",
    // The farm owner's surface. The real check — including that the principal is
    // an owner rather than staff — happens in its layout.
    "/my/:path*",
  ],
};
