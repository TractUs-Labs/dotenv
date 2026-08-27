import { cn } from "@/lib/utils";

export function AppPage({
  children,
  className,
  narrow,
}: {
  children: React.ReactNode;
  className?: string;
  /** Slightly narrower content (e.g. audit feed). */
  narrow?: boolean;
}) {
  return (
    <main
      className={cn(
        "w-full mx-auto px-4 sm:px-8 py-8 sm:py-10",
        narrow ? "max-w-3xl" : "max-w-5xl",
        className,
      )}
    >
      {children}
    </main>
  );
}

export function AppPageHeader({
  title,
  description,
  actions,
  className,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between mb-8",
        className,
      )}
    >
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground text-balance">
          {title}
        </h1>
        {description != null && (
          <p className="text-sm text-muted-foreground mt-0.5">{description}</p>
        )}
      </div>
      {actions != null && (
        <div className="flex items-center gap-2 shrink-0">{actions}</div>
      )}
    </div>
  );
}

export function AppEmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: React.ReactNode;
  title: string;
  description?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center py-16 sm:py-20 px-4 text-center border border-border rounded-xl",
        className,
      )}
    >
      {icon != null && (
        <div className="mb-3 text-muted-foreground [&_svg]:size-8">{icon}</div>
      )}
      <h2 className="text-base font-semibold text-foreground mb-1">{title}</h2>
      {description != null && (
        <p className="text-sm text-muted-foreground max-w-sm mb-4">{description}</p>
      )}
      {action}
    </div>
  );
}
