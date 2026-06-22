import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { founderService } from "@/server/founder/founder.service";
import { Card, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default async function GlobalProjectsPage() {
  const t = await getTranslations("founderProjects");
  const projects = await founderService.getGlobalProjects();

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">{t("title")}</h1>
        <p className="text-sm text-[var(--muted)]">{t("subtitle")}</p>
      </div>

      {projects.length === 0 ? (
        <Card><p className="text-sm text-[var(--muted)]">{t("empty")}</p></Card>
      ) : (
        <div className="space-y-4">
          {projects.map((p) => (
            <Card key={p.id}>
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h3 className="text-lg font-semibold">{p.name}</h3>
                  <p className="text-sm text-[var(--muted)]">{p.description}</p>
                  <p className="mt-2 text-xs text-[var(--muted)]">{p.workspaceName}</p>
                  <div className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1 text-sm md:grid-cols-4">
                    <span>{t("lead")}: <strong>{p.leadName ?? "—"}</strong></span>
                    <span>{t("teamSize")}: <strong>{p.teamSize}</strong></span>
                    <span>{t("openDiscussions")}: <strong>{p.openDiscussions}</strong></span>
                    <span>{t("openProposals")}: <strong>{p.openProposals}</strong></span>
                  </div>
                  {p.healthScore != null && (
                    <p className="mt-2 text-sm text-emerald-400">
                      {t("healthScore")}: {p.healthScore}%
                    </p>
                  )}
                </div>
                <div className="flex flex-col gap-2">
                  <Link href={p.href}>
                    <Button variant="primary">{t("openProject")}</Button>
                  </Link>
                  <Link href={`/projects/${p.id}/executive`}>
                    <Button variant="ghost">{t("projectBrief")}</Button>
                  </Link>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
