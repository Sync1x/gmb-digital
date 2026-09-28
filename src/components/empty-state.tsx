import Link from "next/link";
import { InboxIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";

export function EmptyState({
  title,
  description,
  action,
  icon: Icon = InboxIcon,
}: {
  title: string;
  description?: string;
  action?: { href: string; label: string };
  icon?: React.ComponentType<{ className?: string }>;
}) {
  return (
    <Empty className="rounded-xl border border-dashed py-14">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <Icon className="size-5" />
        </EmptyMedia>
        <EmptyTitle>{title}</EmptyTitle>
        {description && <EmptyDescription>{description}</EmptyDescription>}
      </EmptyHeader>
      {action && (
        <EmptyContent>
          <Link href={action.href} className={cn(buttonVariants(), "h-9 px-4")}>
            {action.label}
          </Link>
        </EmptyContent>
      )}
    </Empty>
  );
}
