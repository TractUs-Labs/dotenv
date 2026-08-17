"use client";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ShieldCheck, LogOut } from "lucide-react";
import { useRef } from "react";

interface AppHeaderProps {
  email: string;
  signOutAction: () => Promise<void>;
}

function initials(email: string) {
  return email.slice(0, 2).toUpperCase();
}

export function AppHeader({ email, signOutAction }: AppHeaderProps) {
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <header className="border-b border-border bg-card/60 backdrop-blur-sm sticky top-0 z-40">
      <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-primary" />
          <span className="font-semibold tracking-tight text-foreground">dotenv</span>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger
            className="flex items-center gap-2 rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer bg-transparent border-0 p-0"
            aria-label="User menu"
          >
            <Avatar className="w-8 h-8">
              <AvatarFallback className="bg-primary/15 text-primary text-xs font-semibold">
                {initials(email)}
              </AvatarFallback>
            </Avatar>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
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

        {/* Hidden form for server action sign-out */}
        <form ref={formRef} action={signOutAction} className="hidden" />
      </div>
    </header>
  );
}
