"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRef } from "react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { FolderLock, Users, ScrollText, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";

type NavItem = { href: string; label: string; icon: typeof FolderLock };

const BASE_NAV: NavItem[] = [{ href: "/", label: "Projects", icon: FolderLock }];
const ADMIN_NAV: NavItem[] = [
  { href: "/access", label: "Access", icon: Users },
  { href: "/audit", label: "Audit Log", icon: ScrollText },
];

function initials(email: string) {
  return email.slice(0, 2).toUpperCase();
}

export function AppSidebar({
  email,
  isOrgAdmin,
  signOutAction,
}: {
  email: string;
  isOrgAdmin: boolean;
  signOutAction: () => Promise<void>;
}) {
  const pathname = usePathname();
  const formRef = useRef<HTMLFormElement>(null);
  const items = isOrgAdmin ? [...BASE_NAV, ...ADMIN_NAV] : BASE_NAV;

  return (
    <aside className="w-56 shrink-0 border-r border-border bg-sidebar flex flex-col h-screen sticky top-0">
      {/* Wordmark */}
      <div className="h-14 flex items-center gap-2 px-4 border-b border-border">
        <span className="font-semibold tracking-tight text-foreground">dotenv</span>
        <span className="font-mono text-primary text-sm select-none">&gt;_</span>
      </div>

      <nav className="flex-1 px-2 py-3 space-y-0.5">
        {items.map((item) => {
          const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-2.5 px-2.5 py-1.5 text-sm rounded-lg transition-colors",
                active
                  ? "text-primary bg-primary/8 font-medium"
                  : "text-muted-foreground hover:bg-muted/40 hover:text-foreground"
              )}
            >
              <Icon className="w-4 h-4 shrink-0" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <DropdownMenu>
        <DropdownMenuTrigger
          className="flex items-center gap-2 px-4 h-14 border-t border-border text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer bg-transparent"
          aria-label="User menu"
        >
          <Avatar className="w-7 h-7">
            <AvatarFallback className="bg-primary/15 text-primary text-xs font-semibold">
              {initials(email)}
            </AvatarFallback>
          </Avatar>
          <span className="text-xs text-sidebar-foreground truncate">{email}</span>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" side="top" className="w-56">
          <div className="px-3 py-2">
            <p className="text-xs text-muted-foreground">Signed in as</p>
            <p className="text-sm font-medium truncate">{email}</p>
          </div>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="text-destructive focus:text-destructive cursor-pointer gap-2"
            onClick={() => formRef.current?.requestSubmit()}
          >
            <LogOut className="w-4 h-4" />
            Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <form ref={formRef} action={signOutAction} className="hidden" />
    </aside>
  );
}
