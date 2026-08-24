"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRef } from "react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ThemeSwitcherSidebar } from "@/components/theme-switcher-sidebar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar";
import {
  FolderLock,
  Users,
  ScrollText,
  LogOut,
  ChevronsUpDown,
} from "lucide-react";

type NavItem = { href: string; label: string; icon: typeof FolderLock };

const BASE_NAV: NavItem[] = [
  { href: "/", label: "Projects", icon: FolderLock },
];
const ADMIN_NAV: NavItem[] = [
  { href: "/access", label: "Access", icon: Users },
  { href: "/audit", label: "Audit Log", icon: ScrollText },
];

function initials(email: string) {
  return email.slice(0, 2).toUpperCase();
}

export function AppSidebar({
  email,
  name,
  isOrgAdmin,
  signOutAction,
}: {
  email: string;
  name: string;
  isOrgAdmin: boolean;
  signOutAction: () => Promise<void>;
}) {
  const pathname = usePathname();
  const formRef = useRef<HTMLFormElement>(null);
  const items = isOrgAdmin ? [...BASE_NAV, ...ADMIN_NAV] : BASE_NAV;

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <div className="flex flex-row items-center justify-between px-2 text-lg">
          <div className="flex flex-row items-center gap-2">
            <p className="text-primary font-mono select-none">&gt;_</p>
            <h1 className="font-semibold tracking-tight">dotenv</h1>
          </div>
          <div className="group-data-[collapsible=icon]:hidden">
            <ThemeSwitcherSidebar />
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => {
                const active =
                  item.href === "/"
                    ? pathname === "/"
                    : pathname.startsWith(item.href);
                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      render={<Link href={item.href} />}
                      isActive={active}
                      tooltip={item.label}
                    >
                      <item.icon />
                      <span>{item.label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger render={<SidebarMenuButton size="lg" />}>
                <Avatar className="size-8">
                  <AvatarFallback className="bg-primary/15 text-primary text-xs font-semibold">
                    {initials(name)}
                  </AvatarFallback>
                </Avatar>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate text-xs">{name}</span>
                </div>
                <ChevronsUpDown />
              </DropdownMenuTrigger>
              <DropdownMenuContent
                className="w-[--radix-dropdown-menu-trigger-width] min-w-56"
                side="top"
                align="start"
              >
                <div className="px-3 py-2">
                  <p className="text-xs text-muted-foreground">Signed in as {name}</p>
                  <p className="text-sm font-medium truncate">{email}</p>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive cursor-pointer gap-2"
                  onClick={() => formRef.current?.requestSubmit()}
                >
                  <LogOut />
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>

      <SidebarRail />

      <form ref={formRef} action={signOutAction} className="hidden" />
    </Sidebar>
  );
}
