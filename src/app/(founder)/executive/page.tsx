import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { founderService } from "@/server/founder/founder.service";
import { getFounderScope } from "@/server/founder/founder-context";
import { executiveService } from "@/server/services/executive.service";
import { Card, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ViewAllLink } from "@/components/view-all-link";
import { runAutonomousReviewAction } from "@/app/actions";
import { translateStatus } from "@/i18n/status";

export default async function FounderExecutivePage() {
  const t = await getTranslations("founderHome");
  const tc = await getTranslations("common");
  const ts = await getTranslations("status");
  const ta = await getTranslations("agents");

  const [home, scope] = await Promise.all([
    founderService.getFounderHome(),
    getFounderScope(),
  ]);

  const brief = scope.primaryProjectId
    ? await executiveService.getMorningBrief(scope.primaryProjectId)
    : null;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">{t("title")}</h1>
        <p className="text-sm text-[var(--muted)]">{t("subtitle")}</p>
      </div>

      <div className="grid gap-4 md:grid-cols-5">
        <Card>
          <p className="text-xs text-[var(--muted)]">{t("people")}</p>
          <p className="text-3xl font-bold text-emerald-400">{home.companyOverview.activeAgents}</p>
          <p className="text-xs text-[var(--muted)]">/ {home.companyOverview.totalAgents}</p>
        </Card>
        <Card>
          <p className="text-xs text-[var(--muted)]">{t("projects")}</p>
          <p className="text-3xl font-bold">{home.companyOverview.projects}</p>
        </Card>
        <Card>
          <p className="text-xs text-[var(--muted)]">{t("openDiscussions")}</p>
          <p className="text-3xl font-bold text-blue-400">{home.companyOverview.openDiscussions}</p>
        </Card>
        <Card>
          <p className="text-xs text-[var(--muted)]">{t("openProposals")}</p>
          <p className="text-3xl font-bold text-amber-400">{home.companyOverview.openProposals}</p>
        </Card>
        <Card>
          <p className="text-xs text-[var(--muted)]">{t("learningHealth")}</p>
          <p className="text-3xl font-bold">{home.learning.healthScore}%</p>
        </Card>
      </div>

      <Card>
        <div className="mb-4 flex items-center justify-between">
          <CardTitle>{t("councilSnapshot")}</CardTitle>
          <ViewAllLink href="/agents" label={t("viewAll")} />
        </div>
        <div className="space-y-3">
          {home.agents.map((agent) => (
            <div
              key={agent.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded border border-[var(--border)] px-4 py-3"
            >
              <div className="flex items-center gap-3">
                <span
                  className="flex h-9 w-9 items-center justify-center rounded-full text-lg"
                  style={{ backgroundColor: `${agent.avatarColor}22`, color: agent.avatarColor }}
                >
                  {agent.avatarEmoji}
                </span>
                <div>
                  <p className="font-medium">{agent.displayName}</p>
                  <p className="text-xs text-[var(--muted)]">
                    {agent.title} · {agent.departmentLabel} · {agent.reputation.toFixed(1)} rep
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                {agent.status === "active" && (
                  <Link href={agent.officeHoursHref}>
                    <Button variant="secondary">{ta("officeHours")}</Button>
                  </Link>
                )}
                <Link href={agent.profileHref}>
                  <Button variant="ghost">{tc("viewProfile")}</Button>
                </Link>
              </div>
            </div>
          ))}
        </div>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <div className="mb-4 flex items-center justify-between">
            <CardTitle>{t("projectsSnapshot")}</CardTitle>
            <ViewAllLink href="/projects" label={t("viewAll")} />
          </div>
          <ul className="space-y-2 text-sm">
            {home.projects.map((p) => (
              <li key={p.id} className="flex justify-between rounded border border-[var(--border)] px-3 py-2">
                <Link href={p.href} className="font-medium hover:text-emerald-400">{p.name}</Link>
                <span className="text-xs text-[var(--muted)]">
                  {p.teamSize} · {p.openDiscussions} disc
                </span>
              </li>
            ))}
          </ul>
        </Card>

        <Card>
          <div className="mb-4 flex items-center justify-between">
            <CardTitle>{t("discussionsSnapshot")}</CardTitle>
            <ViewAllLink href="/discussions" label={t("viewAll")} />
          </div>
          <ul className="space-y-2 text-sm">
            {home.recentDiscussions.length === 0 ? (
              <li className="text-[var(--muted)]">{t("noDiscussions")}</li>
            ) : (
              home.recentDiscussions.map((d) => (
                <li key={d.id}>
                  <Link href={d.href} className="hover:text-emerald-400">
                    {d.userPrompt.slice(0, 70)}…
                  </Link>
                  <p className="text-xs text-[var(--muted)]">
                    {d.projectName} · <Badge variant="default">{translateStatus(ts, d.status)}</Badge>
                  </p>
                </li>
              ))
            )}
          </ul>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <div className="mb-4 flex items-center justify-between">
            <CardTitle>{t("decisionsSnapshot")}</CardTitle>
            {scope.primaryProjectId && (
              <Link href={`/projects/${scope.primaryProjectId}/timeline`} className="text-sm text-emerald-400 hover:underline">
                {tc("fullTimeline")}
              </Link>
            )}
          </div>
          <ul className="space-y-2 text-sm">
            {home.recentDecisions.length === 0 ? (
              <li className="text-[var(--muted)]">{t("noDecisions")}</li>
            ) : (
              home.recentDecisions.map((d, i) => (
                <li key={i} className="text-[var(--muted)]">
                  <span className="text-white">{d.title}</span>
                  <span className="ml-2 text-xs">{d.occurredAt.toLocaleDateString()}</span>
                </li>
              ))
            )}
          </ul>
        </Card>

        <Card>
          <div className="mb-4 flex items-center justify-between">
            <CardTitle>{t("learningSnapshot")}</CardTitle>
            <ViewAllLink href="/learning" label={t("viewAll")} />
          </div>
          <div className="grid grid-cols-3 gap-3 text-sm">
            <div>
              <p className="text-xs text-[var(--muted)]">{t("verified")}</p>
              <p className="text-xl font-bold text-emerald-400">{home.learning.verifiedCount}</p>
            </div>
            <div>
              <p className="text-xs text-[var(--muted)]">{t("mistakes")}</p>
              <p className="text-xl font-bold text-amber-400">{home.learning.mistakesCount}</p>
            </div>
            <div>
              <p className="text-xs text-[var(--muted)]">{t("activeLearnings")}</p>
              <p className="text-xl font-bold">{home.learning.activeLearningsCount}</p>
            </div>
          </div>
        </Card>
      </div>

      {home.topRisks.length > 0 && (
        <Card>
          <CardTitle>{t("risks")}</CardTitle>
          <ul className="ml-4 list-disc space-y-1 text-sm text-amber-400">
            {home.topRisks.map((risk, i) => (
              <li key={i}>{risk}</li>
            ))}
          </ul>
        </Card>
      )}

      {brief && brief.recommendedActions.length > 0 && (
        <Card>
          <CardTitle>{t("recommendedActions")}</CardTitle>
          <ol className="space-y-2 text-sm">
            {brief.recommendedActions.slice(0, 5).map((action, i) => (
              <li key={i} className="rounded border border-[var(--border)] px-3 py-2">
                <span className="font-medium">{action.title}</span>
                <p className="text-xs text-[var(--muted)]">{action.reason}</p>
              </li>
            ))}
          </ol>
        </Card>
      )}

      {scope.primaryProjectId && (
        <div className="flex flex-wrap gap-3">
          <Link href={`/projects/${scope.primaryProjectId}/discussions/new`}>
            <Button variant="primary">{t("newDiscussion")}</Button>
          </Link>
          <form action={runAutonomousReviewAction.bind(null, scope.primaryProjectId)}>
            <Button type="submit" variant="secondary">{t("runReview")}</Button>
          </form>
        </div>
      )}
    </div>
  );
}
