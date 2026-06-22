import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { founderService } from "@/server/founder/founder.service";
import { Card, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export default async function GlobalOrganizationPage() {
  const t = await getTranslations("founderOrganization");
  const tc = await getTranslations("common");
  const [org, agents] = await Promise.all([
    founderService.getGlobalOrganization(),
    founderService.getGlobalAgents(),
  ]);
  const profileById = new Map(agents.map((a) => [a.id, a.profileHref]));

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">{t("title")}</h1>
        <p className="text-sm text-[var(--muted)]">{t("subtitle")}</p>
      </div>

      <Card>
        <CardTitle>{t("projectOwnership")}</CardTitle>
        <div className="space-y-2">
          {org.projectOwnership.map((p) => (
            <div
              key={p.projectId}
              className="flex flex-wrap items-center justify-between rounded border border-[var(--border)] px-4 py-3 text-sm"
            >
              <span className="font-medium">{p.projectName}</span>
              <span className="text-[var(--muted)]">
                {p.leadName ? `${p.leadName} (${p.leadRole})` : "—"}
              </span>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <CardTitle>{t("departments")}</CardTitle>
        <div className="space-y-6">
          {org.departments
            .filter((d) => d.agents.length > 0)
            .map((dept) => (
              <div key={dept.department}>
                <h3 className="mb-3 font-semibold text-emerald-400">├── {dept.label}</h3>
                <div className="ml-4 space-y-2">
                  {dept.agents.map((agent) => (
                    <div
                      key={agent.id}
                      id={`agent-${agent.id}`}
                      className="flex flex-wrap items-center justify-between gap-2 rounded border border-[var(--border)] px-3 py-2 text-sm"
                    >
                      <span>
                        {agent.avatarEmoji} {agent.name} — {agent.title} ({agent.rank})
                      </span>
                      {profileById.has(agent.id) && (
                        <Link href={profileById.get(agent.id)!}>
                          <Button variant="ghost">{tc("viewProfile")}</Button>
                        </Link>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
        </div>
      </Card>

      <Card>
        <CardTitle>{t("assignments")}</CardTitle>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-[var(--muted)]">
                <th className="pb-2 pr-4">{t("agent")}</th>
                <th className="pb-2 pr-4">{t("project")}</th>
                <th className="pb-2 pr-4">{t("role")}</th>
                <th className="pb-2">{t("allocation")}</th>
              </tr>
            </thead>
            <tbody>
              {org.assignments.map((a, i) => (
                <tr key={i} className="border-t border-[var(--border)]">
                  <td className="py-2 pr-4">
                    {a.agentName}
                    {a.isLead && <Badge variant="success" className="ml-2">Lead</Badge>}
                  </td>
                  <td className="py-2 pr-4 text-[var(--muted)]">{a.projectName}</td>
                  <td className="py-2 pr-4">{a.role}</td>
                  <td className="py-2">{a.allocationPercent}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
