import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { universalSearchService } from "@/server/founder/universal-search.service";
import { Card, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { UniversalSearchBar } from "@/components/universal-search-bar";

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const t = await getTranslations("founderSearch");
  const tf = await getTranslations("founderNav");

  const results = q ? await universalSearchService.search(q) : [];

  const byType = {
    agent: results.filter((r) => r.type === "agent"),
    project: results.filter((r) => r.type === "project"),
    discussion: results.filter((r) => r.type === "discussion"),
    proposal: results.filter((r) => r.type === "proposal"),
    adr: results.filter((r) => r.type === "adr"),
    learning: results.filter((r) => r.type === "learning"),
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">{t("title")}</h1>
        <UniversalSearchBar placeholder={tf("searchPlaceholder")} initialQuery={q ?? ""} />
      </div>

      {!q ? (
        <Card><p className="text-sm text-[var(--muted)]">{t("enterQuery")}</p></Card>
      ) : results.length === 0 ? (
        <Card><p className="text-sm text-[var(--muted)]">{t("noResults", { q })}</p></Card>
      ) : (
        <div className="space-y-6">
          {Object.entries(byType).map(([type, items]) =>
            items.length > 0 ? (
              <Card key={type}>
                <CardTitle>{t(`type_${type}` as "type_agent")}</CardTitle>
                <ul className="space-y-2">
                  {items.map((item) => (
                    <li key={`${item.type}-${item.id}`}>
                      <Link href={item.href} className="block rounded border border-[var(--border)] px-3 py-2 hover:border-emerald-500/50">
                        <span className="font-medium">{item.title}</span>
                        <p className="text-xs text-[var(--muted)]">{item.subtitle}</p>
                        {item.projectName && (
                          <Badge variant="info" className="mt-1">{item.projectName}</Badge>
                        )}
                      </Link>
                    </li>
                  ))}
                </ul>
              </Card>
            ) : null
          )}
        </div>
      )}
    </div>
  );
}
