"use client";

import type { ReactElement, ReactNode } from "react";
import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";

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
    >
      <Sun className="hidden dark:block" />
      <Moon className="dark:hidden" />
      {label}
    </Button>
  );
}
