"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ChevronsUpDownIcon,
  HistoryIcon,
  InboxIcon,
  LogOutIcon,
  SettingsIcon,
  SquarePenIcon,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

const WORK_LINKS = [
  { href: "/", label: "Queue", icon: InboxIcon },
  { href: "/new", label: "New post", icon: SquarePenIcon },
  { href: "/history", label: "History", icon: HistoryIcon },
];

const ADMIN_LINKS = [{ href: "/settings", label: "Settings", icon: SettingsIcon }];

function isActivePath(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

function initials(email: string) {
  const name = email.split("@")[0] ?? "";
  const parts = name.split(/[._-]+/).filter(Boolean);
  const letters = parts.length > 1 ? parts[0][0] + parts[1][0] : name.slice(0, 2);
  return letters.toUpperCase();
}

function NavLinks({
  links,
  newCount,
}: {
  links: typeof WORK_LINKS;
  newCount?: number;
}) {
  const pathname = usePathname();
  const { isMobile, setOpenMobile } = useSidebar();

  return (
    <SidebarMenu>
      {links.map((link) => {
        const active = isActivePath(pathname, link.href);
        const showCount = link.href === "/" && newCount !== undefined && newCount > 0;
        return (
          <SidebarMenuItem key={link.href}>
            <SidebarMenuButton
              isActive={active}
              tooltip={link.label}
              render={
                <Link
                  href={link.href}
                  aria-current={active ? "page" : undefined}
                  onClick={() => isMobile && setOpenMobile(false)}
                />
              }
            >
              <link.icon aria-hidden="true" />
              <span>{link.label}</span>
            </SidebarMenuButton>
            {showCount && (
              <SidebarMenuBadge
                className="bg-sidebar-primary text-sidebar-primary-foreground peer-hover/menu-button:text-sidebar-primary-foreground peer-data-active/menu-button:text-sidebar-primary-foreground"
                aria-label={`${newCount} new`}
              >
                {newCount}
              </SidebarMenuBadge>
            )}
          </SidebarMenuItem>
        );
      })}
    </SidebarMenu>
  );
}

export function AppSidebar({ email, newCount }: { email: string | null; newCount: number }) {
  const { isMobile } = useSidebar();

  return (
    <Sidebar collapsible="icon" variant="inset">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" render={<Link href="/" />} tooltip="GMB Digital">
              <Image
                src="/gmb-logo.png"
                alt=""
                width={278}
                height={276}
                priority
                className="size-8 shrink-0 rounded-full"
              />
              <div className="grid flex-1 text-left leading-tight">
                <span className="truncate font-semibold">GMB Digital</span>
                <span className="truncate text-xs text-muted-foreground">
                  Green Mountain Broadcasters
                </span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Publishing</SidebarGroupLabel>
          <SidebarGroupContent>
            <NavLinks links={WORK_LINKS} newCount={newCount} />
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarGroup>
          <SidebarGroupLabel>Admin</SidebarGroupLabel>
          <SidebarGroupContent>
            <NavLinks links={ADMIN_LINKS} />
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        {/* Sign-out is a POST so a stray prefetch can't log anyone out. */}
        <form id="logout-form" action="/auth/logout" method="post" className="hidden" />
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <SidebarMenuButton
                    size="lg"
                    className="data-popup-open:bg-sidebar-accent"
                    aria-label="Account menu"
                  />
                }
              >
                <Avatar className="size-8 rounded-lg after:rounded-lg">
                  <AvatarFallback className="rounded-lg text-xs font-medium">
                    {email ? initials(email) : "?"}
                  </AvatarFallback>
                </Avatar>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-medium">Signed in</span>
                  <span className="truncate text-xs text-muted-foreground">{email}</span>
                </div>
                <ChevronsUpDownIcon className="ml-auto" aria-hidden="true" />
              </DropdownMenuTrigger>
              <DropdownMenuContent
                className="w-(--anchor-width) min-w-56"
                side={isMobile ? "top" : "right"}
                align="end"
                sideOffset={8}
              >
                <DropdownMenuGroup>
                  <DropdownMenuLabel className="truncate font-normal text-muted-foreground">
                    {email}
                  </DropdownMenuLabel>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() =>
                    (document.getElementById("logout-form") as HTMLFormElement | null)?.requestSubmit()
                  }
                >
                  <LogOutIcon aria-hidden="true" />
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
