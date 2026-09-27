"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

const LINKS = [
  { href: "/", label: "Queue" },
  { href: "/new", label: "New post" },
  { href: "/history", label: "History" },
  { href: "/settings", label: "Settings" },
];

export function MainNav({ newCount }: { newCount: number }) {
  const pathname = usePathname();

  return (
    <nav className="flex flex-wrap items-center gap-1">
      {LINKS.map((link) => {
        const isActive =
          link.href === "/" ? pathname === "/" : pathname.startsWith(link.href);
        return (
          <Link
            key={link.href}
            href={link.href}
            className={cn(
              "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors",
              isActive
                ? "bg-muted text-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            {link.label}
            {link.href === "/" && newCount > 0 && (
              <Badge className="h-5 min-w-5 px-1.5">{newCount}</Badge>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
