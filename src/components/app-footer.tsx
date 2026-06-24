import { getTranslations } from "next-intl/server";
import { buildVersionService } from "@/server/services/build-version.service";

type AppFooterProps = {
  maxWidthClass?: string;
};

export async function AppFooter({ maxWidthClass = "max-w-7xl" }: AppFooterProps) {
  const t = await getTranslations("common");
  const { version } = buildVersionService.getVersionInfo();

  return (
    <footer className="border-t border-[var(--border)] bg-[var(--card)]">
      <div
        className={`mx-auto flex ${maxWidthClass} items-center justify-center px-6 py-3 text-xs text-[var(--muted)]`}
      >
        <span aria-label={t("buildVersionLabel", { version })}>
          {t("buildVersion", { version })}
        </span>
      </div>
    </footer>
  );
}
