import Link from "next/link";
import { getTranslations } from "next-intl/server";

const NAV_ITEMS = [
  { href: "/executive", icon: "🏠", key: "executive" as const },
  { href: "/agents", icon: "👥", key: "council" as const },
  { href: "/projects", icon: "📁", key: "projects" as const },
  { href: "/discussions", icon: "💬", key: "discussions" as const },
  { href: "/learning", icon: "🧠", key: "learning" as const },
  { href: "/organization", icon: "📊", key: "organization" as const },
];

export async function FounderSidebar({ activePath }: { activePath?: string }) {
  const t = await getTranslations("founderNav");

  return (
    <aside className="w-56 shrink-0 border-r border-[var(--border)] pr-4">
      <nav className="sticky top-6 space-y-1">
        {NAV_ITEMS.map((item) => {
          const isActive =
            activePath === item.href ||
            (item.href !== "/executive" && activePath?.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-2 rounded px-3 py-2 text-sm transition-colors ${
                isActive
                  ? "bg-emerald-500/10 font-medium text-emerald-400"
                  : "text-[var(--muted)] hover:bg-white/5 hover:text-white"
              }`}
            >
              <span>{item.icon}</span>
              <span>{t(item.key)}</span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
