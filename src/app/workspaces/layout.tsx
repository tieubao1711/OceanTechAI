import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { AppFooter } from "@/components/app-footer";
import { LanguageSwitcher } from "@/components/language-switcher";

export default async function WorkspacesLayout({
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
            <LanguageSwitcher />
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-8">{children}</main>
      <AppFooter maxWidthClass="max-w-6xl" />
    </>
  );
}
