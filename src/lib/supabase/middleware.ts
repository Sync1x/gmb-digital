import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { isAllowedEmail } from "@/lib/allowed-emails";

const PUBLIC_PATHS = ["/login"];

function isPublicPath(pathname: string) {
  return PUBLIC_PATHS.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`)
  );
}

/**
 * Refreshes the Supabase auth session on every request and gates every
 * page except /login behind (a) being logged in and (b) the logged-in
 * email being in ALLOWED_EMAILS. Anyone else is signed out and bounced
 * to /login. Runs in Next middleware, so it applies before any page or
 * layout renders.
 */
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // IMPORTANT: avoid writing logic between createServerClient and
  // getUser(). A simple mistake could make it very hard to debug why
  // users are randomly logged out.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const publicPath = isPublicPath(pathname);

  const isAllowed = !!user?.email && isAllowedEmail(user.email);

  if ((!user || !isAllowed) && !publicPath) {
    if (user && !isAllowed) {
      // Logged in but not on the allowlist: sign them out.
      await supabase.auth.signOut();
    }
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  if (user && isAllowed && pathname === "/login") {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  // IMPORTANT: return supabaseResponse as-is so cookies stay in sync.
  return supabaseResponse;
}
