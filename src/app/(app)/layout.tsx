import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { isLiveEnabled } from "@/lib/publish-mode";
import { AppSidebar } from "@/components/app-sidebar";
import { SiteHeader } from "@/components/site-header";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const supabase = await createClient();
  const [
    {
      data: { user },
    },
    { count: newCount },
    { count: scheduledCount },
    cookieStore,
  ] = await Promise.all([
    supabase.auth.getUser(),
    supabase
      .from("drafts")
      .select("id", { count: "exact", head: true })
      .eq("status", "new"),
    supabase
      .from("drafts")
      .select("id", { count: "exact", head: true })
      .in("status", ["scheduled", "publishing"]),
    cookies(),
  ]);

  // The sidebar remembers whether it was collapsed in this cookie.
  const sidebarOpen = cookieStore.get("sidebar_state")?.value !== "false";

  return (
    <SidebarProvider defaultOpen={sidebarOpen}>
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-md focus:bg-background focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:shadow-md focus:ring-2 focus:ring-ring"
      >
        Skip to content
      </a>
      <AppSidebar
        email={user?.email ?? null}
        newCount={newCount ?? 0}
        scheduledCount={scheduledCount ?? 0}
      />
      <SidebarInset>
        <SiteHeader isDraftMode={!isLiveEnabled()} />
        <div
          id="main-content"
          tabIndex={-1}
          className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-8 outline-none sm:px-6 lg:px-8"
        >
          {children}
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
