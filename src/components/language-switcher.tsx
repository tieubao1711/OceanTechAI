"use client";

import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useTransition } from "react";
import { setLocaleAction } from "@/app/actions";
import type { Locale } from "@/i18n/routing";

export function LanguageSwitcher() {
  const locale = useLocale() as Locale;
  const t = useTranslations("common");
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const btnClass = (active: boolean) =>
    `rounded px-2 py-1 text-xs transition-colors disabled:opacity-50 ${
      active
        ? "bg-[var(--accent)] text-white"
        : "text-[var(--muted)] hover:text-white"
    }`;

  const switchLocale = (next: Locale) => {
    if (next === locale || pending) return;
    startTransition(async () => {
      await setLocaleAction(next);
      router.refresh();
    });
  };

  return (
    <div className="flex items-center gap-1" role="group" aria-label={t("language")}>
      <button
        type="button"
        className={btnClass(locale === "en")}
        title={t("english")}
        disabled={pending}
        onClick={() => switchLocale("en")}
      >
        EN
      </button>
      <button
        type="button"
        className={btnClass(locale === "vi")}
        title={t("vietnamese")}
        disabled={pending}
        onClick={() => switchLocale("vi")}
      >
        VI
      </button>
    </div>
  );
}
