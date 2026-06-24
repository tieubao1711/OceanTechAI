import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { AppFooter } from "@/components/app-footer";
import { LanguageSwitcher } from "@/components/language-switcher";
import { FounderSidebar } from "@/components/founder-sidebar";
import { UniversalSearchBar } from "@/components/universal-search-bar";
import { FounderChatLayout } from "@/components/founder-chat-layout";

export default async function FounderLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const t = await getTranslations("common");
  const tf = await getTranslations("founderNav");

  return (
    <>
      <header className="border-b border-[var(--border)] bg-[var(--card)]">
        <div className="mx-auto flex max-w-7xl items-center gap-4 px-6 py-3">
          <Link href="/executive" className="shrink-0 text-lg font-semibold text-[var(--accent)]">
            {t("appName")}
          </Link>
          <UniversalSearchBar placeholder={tf("searchPlaceholder")} />
          <nav className="flex shrink-0 items-center gap-3 text-sm text-[var(--muted)]">
            <Link href="/workspaces" className="hover:text-white">
              {t("workspaces")}
            </Link>
            <LanguageSwitcher />
          </nav>
        </div>
      </header>
      <div className="mx-auto flex max-w-7xl gap-6 px-6 py-8">
        <FounderSidebar />
        <div className="min-w-0 flex-1">
          <FounderChatLayout>{children}</FounderChatLayout>
        </div>
      </div>
      <AppFooter />
    </>
  );
}
