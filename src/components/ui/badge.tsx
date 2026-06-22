import { cn } from "@/lib/utils";

const variants: Record<string, string> = {
  default: "bg-slate-700 text-slate-200",
  success: "bg-green-900/50 text-green-300 border border-green-700",
  warning: "bg-amber-900/50 text-amber-300 border border-amber-700",
  danger: "bg-red-900/50 text-red-300 border border-red-700",
  info: "bg-sky-900/50 text-sky-300 border border-sky-700",
};

export function Badge({
  children,
  variant = "default",
  className,
}: {
  children: React.ReactNode;
  variant?: keyof typeof variants;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        variants[variant],
        className
      )}
    >
      {children}
    </span>
  );
}
