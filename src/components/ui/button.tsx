import { cn } from "@/lib/utils";

const variants: Record<string, string> = {
  primary: "bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white",
  secondary: "bg-slate-700 hover:bg-slate-600 text-white",
  danger: "bg-[var(--danger)] hover:bg-red-600 text-white",
  ghost: "bg-transparent hover:bg-slate-800 text-[var(--muted)]",
};

export function Button({
  children,
  variant = "primary",
  className,
  type = "button",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: keyof typeof variants;
}) {
  return (
    <button
      type={type}
      className={cn(
        "rounded-md px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50",
        variants[variant],
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}
