import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { projectService } from "@/server/services/project.service";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { seedAgentsAction } from "@/app/actions";
import { formatRoleLabel } from "@/server/agents/agent-profile";
import { agentCouncilService } from "@/server/agents/agent-council.service";

export default async function AgentsPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const t = await getTranslations("agents");
  const tc = await getTranslations("common");
  const [project, council] = await Promise.all([
    projectService.getById(projectId),
    agentCouncilService.getCouncilMembers(projectId),
  ]);
  const influenceById = new Map(council.map((m) => [m.id, m.influenceScore]));

  return (
    <div className="space-y-8">
      <div>
        <Link href="/agents" className="text-sm text-[var(--muted)] hover:text-white">
          ← AI Council
        </Link>
        <h1 className="mt-2 text-2xl font-bold">{project.name} — {t("title")}</h1>
      </div>

      {project.agents.length === 0 && (
        <Card>
          <p className="mb-4 text-sm text-[var(--muted)]">{t("empty")}</p>
          <form action={seedAgentsAction.bind(null, projectId)}>
            <Button type="submit" variant="primary">{t("seedButton")}</Button>
          </form>
        </Card>
      )}

      <div className="space-y-4">
        {project.agents.map((agent) => (
          <Card key={agent.id}>
            <div className="flex items-start justify-between">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold">{agent.name}</h3>
                  <Badge variant={agent.isActive ? "success" : "default"}>
                    {agent.isActive ? t("active") : t("dormant")}
                  </Badge>
                  <Badge variant="info">{formatRoleLabel(agent.role)}</Badge>
                  {agent.title && <Badge variant="default">{agent.title}</Badge>}
                </div>
                <p className="text-sm text-[var(--muted)]">{agent.systemPrompt}</p>
                <div className="flex flex-wrap gap-2 pt-1">
                  <Badge variant="success">{t("reputation")}: {agent.reputationScore.toFixed(1)}</Badge>
                  {influenceById.has(agent.id) && (
                    <Badge variant="info">{t("influence")}: {influenceById.get(agent.id)}</Badge>
                  )}
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <Link href={`/projects/${projectId}/agents/${agent.id}`}>
                  <Button variant="primary">{t("viewProfile")}</Button>
                </Link>
                {agent.workforceStatus === "ACTIVE" && agent.isActive && (
                  <Link href={`/projects/${projectId}/agents/${agent.id}/chat`}>
                    <Button variant="secondary" className="w-full">{t("officeHours")}</Button>
                  </Link>
                )}
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
