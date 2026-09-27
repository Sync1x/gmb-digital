import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function proxy(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico, sitemap.xml, robots.txt (metadata files)
     * - api routes with their own auth (intake is protected by its own
     *   x-intake-secret header, not the user session)
     */
    "/((?!_next/static|_next/image|favicon.ico|api/intake|sitemap.xml|robots.txt).*)",
  ],
};
