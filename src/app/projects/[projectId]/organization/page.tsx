import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { executiveService } from "@/server/services/executive.service";
import { Card, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export default async function OrganizationPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const t = await getTranslations("organization");
  const tc = await getTranslations("common");
  const chart = await executiveService.getOrganizationChart(projectId);

  return (
    <div className="space-y-8">
      <div>
        <Link
          href={`/projects/${projectId}/executive`}
          className="text-sm text-[var(--muted)] hover:text-white"
        >
          {tc("backExecutive")}
        </Link>
        <h1 className="mt-2 text-2xl font-bold">{t("title")}</h1>
        <p className="text-sm text-[var(--muted)]">{t("subtitle")}</p>
      </div>

      <Card>
        <CardTitle>{chart.founderLabel}</CardTitle>
        <div className="mt-4 space-y-6">
          {chart.departments.map((dept) => (
            <div key={dept.department}>
              <h3 className="mb-3 font-semibold text-emerald-400">├── {dept.label}</h3>
              {dept.agents.length === 0 ? (
                <p className="ml-4 text-sm text-[var(--muted)]">{t("noAgents")}</p>
              ) : (
                <div className="ml-4 space-y-3">
                  {dept.agents.map((agent) => (
                    <div
                      key={agent.id}
                      className="flex flex-wrap items-center justify-between gap-3 rounded border border-[var(--border)] px-4 py-3"
                    >
                      <div className="flex items-center gap-3">
                        <span
                          className="flex h-10 w-10 items-center justify-center rounded-full text-xl"
                          style={{
                            backgroundColor: `${agent.avatarColor}22`,
                            color: agent.avatarColor,
                          }}
                        >
                          {agent.avatarEmoji}
                        </span>
                        <div>
                          <p className="font-medium">{agent.name}</p>
                          <p className="text-sm text-[var(--muted)]">
                            {agent.title} · {agent.rank}
                          </p>
                          {agent.managerName && (
                            <p className="text-xs text-[var(--muted)]">
                              {t("reportsTo")}: {agent.managerName}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="info">{dept.label}</Badge>
                        <Link href={`/projects/${projectId}/agents/${agent.id}`}>
                          <Button variant="ghost">{tc("viewProfile")}</Button>
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
