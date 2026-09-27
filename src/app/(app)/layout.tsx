import { createClient } from "@/lib/supabase/server";
import { getPublishMode } from "@/lib/publish-mode";
import { MainNav } from "@/components/main-nav";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const supabase = await createClient();
  const [
    {
      data: { user },
    },
    { count: newCount },
  ] = await Promise.all([
    supabase.auth.getUser(),
    supabase
      .from("drafts")
      .select("id", { count: "exact", head: true })
      .eq("status", "new"),
  ]);

  const isDraftMode = getPublishMode() === "draft";

  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b bg-white">
        <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center justify-between gap-4 px-4 py-3">
          <div className="flex flex-wrap items-center gap-4">
            <span className="text-lg font-semibold tracking-tight">GMB Digital</span>
            {isDraftMode && (
              <Badge
                variant="outline"
                className="border-amber-400 bg-amber-50 px-2.5 py-1 text-amber-900"
                title="PUBLISH_MODE=draft: posts are created as WordPress drafts and Facebook webhooks are skipped."
              >
                Draft mode: nothing goes live
              </Badge>
            )}
            <MainNav newCount={newCount ?? 0} />
          </div>
          <div className="flex items-center gap-3">
            {user?.email && (
              <span className="hidden text-sm text-muted-foreground sm:inline">
                {user.email}
              </span>
            )}
            <form action="/auth/logout" method="post">
              <Button variant="outline" type="submit">
                Sign out
              </Button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-8">
        {children}
      </main>
    </div>
  );
}
