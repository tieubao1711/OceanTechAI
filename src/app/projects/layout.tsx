import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { AppFooter } from "@/components/app-footer";
import { LanguageSwitcher } from "@/components/language-switcher";
import { FounderChatLayout } from "@/components/founder-chat-layout";

export default async function ProjectsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const t = await getTranslations("common");

  return (
    <>
      <header className="border-b border-[var(--border)] bg-[var(--card)]">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link href="/executive" className="text-lg font-semibold text-[var(--accent)]">
            {t("appName")}
          </Link>
          <nav className="flex items-center gap-4 text-sm text-[var(--muted)]">
            <Link href="/executive" className="hover:text-white">Executive</Link>
            <Link href="/agents" className="hover:text-white">AI Council</Link>
            <Link href="/workspaces" className="hover:text-white">{t("workspaces")}</Link>
            <LanguageSwitcher />
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-8">
        <FounderChatLayout>{children}</FounderChatLayout>
      </main>
      <AppFooter maxWidthClass="max-w-6xl" />
    </>
  );
}
