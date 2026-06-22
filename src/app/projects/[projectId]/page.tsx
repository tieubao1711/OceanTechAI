import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { projectService } from "@/server/services/project.service";
import { projectTeamService } from "@/server/workforce/project-team.service";
import { Card, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ProjectTeamPanel } from "@/components/project-team-panel";
import { translateStatus } from "@/i18n/status";
import {
  addAgentToProjectAction,
  removeAgentFromProjectAction,
  setProjectLeadAction,
  updateProjectAssignmentAction,
} from "@/app/actions";

function statusVariant(status: string) {
  if (status === "COMPLETED" || status === "APPROVED") return "success" as const;
  if (status === "RUNNING" || status === "DRAFT") return "warning" as const;
  if (status === "FAILED" || status === "REJECTED") return "danger" as const;
  return "default" as const;
}

export default async function ProjectDashboardPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const t = await getTranslations("project");
  const tt = await getTranslations("projectTeam");
  const ts = await getTranslations("status");
  const [project, team] = await Promise.all([
    projectService.getById(projectId),
    projectTeamService.getTeamPage(projectId),
  ]);

  const teamLabels: Record<string, string> = {
    teamTitle: tt("title"),
    teamSubtitle: tt("subtitle"),
    addAgent: tt("addAgent"),
    teamHealth: tt("teamHealth"),
    suggestions: tt("suggestions"),
    overallocatedWarning: tt("overallocatedWarning"),
    noMembers: tt("noMembers"),
    lead: tt("lead"),
    reputation: tt("reputation"),
    influence: tt("influence"),
    officeHours: tt("officeHours"),
    setLead: tt("setLead"),
    edit: tt("edit"),
    remove: tt("remove"),
    projectRole: tt("projectRole"),
    save: tt("save"),
    recentChanges: tt("recentChanges"),
    selectAgent: tt("selectAgent"),
    leadQuestion: tt("leadQuestion"),
    add: tt("add"),
    cancel: tt("cancel"),
    removeConfirm: tt("removeConfirm"),
    removeNote: tt("removeNote"),
    confirmRemove: tt("confirmRemove"),
  };

  return (
    <div className="space-y-8">
      <div>
        <p className="text-sm text-[var(--muted)]">
          <Link href="/projects" className="hover:text-white">← Projects</Link>
        </p>
        <h1 className="mt-1 text-2xl font-bold">{project.name}</h1>
        <p className="text-[var(--muted)]">{project.description}</p>
      </div>

      <div className="flex flex-wrap gap-3">
        <Link href={`/projects/${projectId}/discussions/new`}>
          <Button>{t("newDiscussion")}</Button>
        </Link>
        <Link href={`/projects/${projectId}/executive`}>
          <Button variant="primary">{t("projectBrief")}</Button>
        </Link>
        <Link href="/executive">
          <Button variant="ghost">{t("companyOverview")}</Button>
        </Link>
        <Link href={`/projects/${projectId}/timeline`}>
          <Button variant="ghost">{t("timeline")}</Button>
        </Link>
      </div>

      <Card>
        <ProjectTeamPanel
          team={team}
          labels={teamLabels}
          addAgent={addAgentToProjectAction}
          removeAgent={removeAgentFromProjectAction}
          setLead={setProjectLeadAction}
          updateAssignment={updateProjectAssignmentAction}
        />
      </Card>

      <Card>
        <CardTitle>{t("recentDiscussions")}</CardTitle>
        {project.discussions.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">{t("noDiscussions")}</p>
        ) : (
          <div className="space-y-3">
            {project.discussions.map((d) => (
              <div key={d.id} className="flex items-center justify-between rounded border border-[var(--border)] p-3">
                <div>
                  <Link
                    href={`/projects/${projectId}/discussions/${d.id}`}
                    className="font-medium hover:text-[var(--accent)]"
                  >
                    {d.userPrompt.slice(0, 80)}
                  </Link>
                  <div className="mt-1 flex gap-2">
                    <Badge variant={statusVariant(d.status)}>{translateStatus(ts, d.status)}</Badge>
                    {d.proposal && (
                      <Badge variant={statusVariant(d.proposal.status)}>
                        {t("proposal")}: {translateStatus(ts, d.proposal.status)}
                      </Badge>
                    )}
                  </div>
                </div>
                {d.proposal && (
                  <Link href={`/projects/${projectId}/proposals/${d.proposal.id}`}>
                    <Button variant="ghost">{t("viewProposal")}</Button>
                  </Link>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
