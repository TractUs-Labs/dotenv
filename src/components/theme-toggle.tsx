"use client";

import type { ReactElement, ReactNode } from "react";
import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function ThemeToggle({
  render,
  label,
}: {
  render?: ReactElement;
  label?: ReactNode;
}) {
  const { resolvedTheme, setTheme } = useTheme();

  return (
    <Button
      variant="ghost"
      aria-label="Toggle theme"
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
      {...(render ? { render } : { size: "icon" as const })}
      className={cn("flex items-center justify-start")}
    >
      <Sun className="hidden dark:block" />
      <Moon className="dark:hidden" />
      {label}
    </Button>
  );
}
