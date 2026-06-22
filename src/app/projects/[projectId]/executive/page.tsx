import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { executiveService } from "@/server/services/executive.service";
import { Card, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  runAutonomousReviewAction,
  ignoreSuggestionAction,
  archiveSuggestionAction,
  createDiscussionFromSuggestionAction,
} from "@/app/actions";
import { translateStatus } from "@/i18n/status";
import { formatRoleLabel } from "@/server/agents/agent-profile";
import type { AgentCouncilMember } from "@/server/agents/agent-types";

export default async function ExecutiveDashboardPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const t = await getTranslations("executive");
  const tc = await getTranslations("common");
  const ts = await getTranslations("status");
  const ta = await getTranslations("agents");

  const [
    brief,
    suggestions,
    timeline,
    adrs,
    archHealth,
    learningCenter,
    council,
  ] = await Promise.all([
    executiveService.getMorningBrief(projectId),
    executiveService.getSuggestions(projectId),
    executiveService.getTimeline(projectId),
    executiveService.getAdrs(projectId),
    executiveService.getArchitectureHealth(projectId),
    executiveService.getLearningCenter(projectId),
    executiveService.getAgentCouncil(projectId),
  ]);

  const consistencyCheck = await executiveService.getRecommendationConsistency(
    projectId,
    brief.recommendedActions
  );

  const isNewProject =
    brief.recentJournals.length === 0 &&
    suggestions.length === 0 &&
    brief.openProposals === 0;

  return (
    <div className="space-y-8">
      <div>
        <Link href="/executive" className="text-sm text-[var(--muted)] hover:text-white">
          ← Company Overview
        </Link>
        <h1 className="mt-2 text-2xl font-bold">{t("projectBrief")}</h1>
        <p className="text-sm text-[var(--muted)]">
          {t("morningBrief", { date: brief.generatedAt.toLocaleString() })}
        </p>
      </div>

      {isNewProject && (
        <Card>
          <CardTitle>{t("getStarted")}</CardTitle>
          <p className="mb-4 text-sm text-[var(--muted)]">{t("getStartedDesc")}</p>
          <div className="flex flex-wrap gap-3">
            <Link href={`/projects/${projectId}/discussions/new`}>
              <Button variant="primary">{t("createFirstDiscussion")}</Button>
            </Link>
            <form action={runAutonomousReviewAction.bind(null, projectId)}>
              <Button type="submit" variant="secondary">{t("runAutonomousReview")}</Button>
            </form>
            <Link href={`/projects/${projectId}/agents`}>
              <Button variant="ghost">{t("manageAgents")}</Button>
            </Link>
          </div>
          <p className="mt-3 text-xs text-[var(--muted)]">
            {t("tip", { cmd: "npm run self:test" })}
          </p>
        </Card>
      )}

      {archHealth && (
        <Card>
          <CardTitle>{t("architectureHealth")}</CardTitle>
          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <p className="text-xs text-[var(--muted)]">{t("lastAuditScore")}</p>
              <p className="text-3xl font-bold text-emerald-400">{archHealth.overallScore}%</p>
              <p className="text-xs text-[var(--muted)]">
                {archHealth.lastAuditDate.toLocaleDateString()}
              </p>
            </div>
            <div>
              <p className="text-xs text-[var(--muted)]">{t("tokenUsage")}</p>
              <p className="text-2xl font-bold">{archHealth.tokenUsage.toLocaleString()}</p>
              <p className="text-xs text-[var(--muted)]">
                {t("specificityEvidence", {
                  specificity: archHealth.auditScore.specificity,
                  evidence: archHealth.auditScore.evidenceQuality,
                })}
              </p>
            </div>
            <div>
              <p className="text-xs text-[var(--muted)] mb-2">{t("topDebts")}</p>
              <ol className="space-y-1 text-sm">
                {archHealth.topFindings.slice(0, 5).map((f, i) => (
                  <li key={i}>
                    <span className="text-amber-400">[{f.priority}]</span> {f.title}
                    <span className="block text-xs text-[var(--muted)]">{f.fileOrModule}</span>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardTitle>{t("openProposals")}</CardTitle>
          <p className="text-3xl font-bold text-emerald-400">{brief.openProposals}</p>
        </Card>
        <Card>
          <CardTitle>{t("pendingReviews")}</CardTitle>
          <p className="text-3xl font-bold text-amber-400">{brief.pendingReviews}</p>
        </Card>
        <Card>
          <CardTitle>{t("recentDecisions")}</CardTitle>
          <p className="text-3xl font-bold">{brief.recentDecisions}</p>
        </Card>
        <Card>
          <CardTitle>{t("openDiscussions")}</CardTitle>
          <p className="text-3xl font-bold text-blue-400">{brief.openDiscussions}</p>
        </Card>
      </div>

      <Card>
        <CardTitle>{t("consistencyCheck")}</CardTitle>
        <div className="mb-4 flex items-center gap-3">
          <Badge variant={consistencyCheck.consistent ? "success" : "warning"}>
            {consistencyCheck.consistent ? t("consistent") : t("inconsistent")}
          </Badge>
          <span className="text-sm text-[var(--muted)]">
            {t("verifiedTopicsTracked", { count: consistencyCheck.verifiedTopicCount })}
          </span>
        </div>
        {consistencyCheck.consistent ? (
          <p className="text-sm text-emerald-400">{t("consistentMessage")}</p>
        ) : (
          <ul className="space-y-2 text-sm text-amber-400">
            {consistencyCheck.issues.map((issue, i) => (
              <li key={i}>
                <span className="font-mono text-xs text-[var(--muted)]">[{issue.topicKey}]</span>{" "}
                {issue.topic}: {issue.message}
                <span className="ml-2 text-xs text-[var(--muted)]">
                  [{issue.sections.join(", ")}]
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <CardTitle>{t("recommendedActions")}</CardTitle>
        {brief.recommendedActions.length === 0 ? (
          <div className="space-y-3 text-sm text-[var(--muted)]">
            <p>{t("noRecommendations")}</p>
            <Link href={`/projects/${projectId}/discussions/new`}>
              <Button variant="secondary">{t("createDiscussion")}</Button>
            </Link>
          </div>
        ) : (
          <ol className="space-y-3">
            {brief.recommendedActions.map((action) => (
              <li key={`${action.priority}-${action.title}`} className="rounded border border-[var(--border)] p-3">
                <div className="flex items-center gap-2">
                  <Badge variant="info">{tc("priority")} {action.priority}</Badge>
                  <span className="font-medium">{action.title}</span>
                </div>
                <p className="mt-1 text-sm text-[var(--muted)]">{action.reason}</p>
                {action.duplicateWarning && (
                  <p className="mt-1 text-xs text-amber-400">⚠ {action.duplicateWarning}</p>
                )}
              </li>
            ))}
          </ol>
        )}
      </Card>

      <Card>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle>{t("aiCouncil")}</CardTitle>
            <p className="mt-1 text-sm text-[var(--muted)]">{t("aiCouncilDesc")}</p>
          </div>
          <Link href="/agents">
            <Button variant="secondary">{tc("manageAgents")}</Button>
          </Link>
        </div>
        {council.members.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">
            <Link href={`/projects/${projectId}/agents`} className="text-emerald-400 hover:underline">
              {tc("manageAgents")}
            </Link>
          </p>
        ) : (
          <div className="space-y-3">
            {council.members.map((member) => (
              <CouncilMemberRow
                key={member.id}
                member={member}
                projectId={projectId}
                tc={tc}
                ta={ta}
              />
            ))}
          </div>
        )}
      </Card>

      <div className="grid gap-4 md:grid-cols-3">
        <CouncilRankingCard
          title={t("topContributors")}
          members={council.topContributors}
          projectId={projectId}
          emptyLabel="—"
        />
        <CouncilRankingCard
          title={t("mostTrusted")}
          members={council.mostTrusted}
          projectId={projectId}
          emptyLabel="—"
        />
        <CouncilRankingCard
          title={t("requiringReview")}
          members={council.requiringReview}
          projectId={projectId}
          emptyLabel={t("noReviewNeeded")}
          warning
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardTitle>{t("topRisks")}</CardTitle>
          <ul className="ml-4 list-disc space-y-1 text-sm text-amber-400">
            {brief.topRisks.map((risk, i) => (
              <li key={i}>{risk}</li>
            ))}
          </ul>
        </Card>

        <Card>
          <CardTitle>{t("topAgents")}</CardTitle>
          <div className="space-y-2">
            {brief.topAgents.map((agent) => (
              <div key={agent.id} className="flex items-center justify-between text-sm">
                <Link href={`/projects/${projectId}/agents/${agent.id}`} className="hover:text-[var(--accent)]">
                  {agent.name}
                </Link>
                <span className="font-mono text-emerald-400">
                  {agent.reputationScore.toFixed(1)} · ✓{agent.acceptedCount} ✗{agent.rejectedCount}
                </span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Card>
        <div className="mb-4 flex items-center justify-between">
          <CardTitle>{t("autonomousSuggestions")}</CardTitle>
          <form action={runAutonomousReviewAction.bind(null, projectId)}>
            <Button type="submit" variant="secondary">{t("runAutonomousReview")}</Button>
          </form>
        </div>
        <p className="mb-4 text-sm text-[var(--muted)]">{t("suggestionsDesc")}</p>
        {suggestions.length === 0 ? (
          <div className="space-y-3 text-sm text-[var(--muted)]">
            <p>{t("noSuggestions")}</p>
            <form action={runAutonomousReviewAction.bind(null, projectId)}>
              <Button type="submit" variant="secondary">{t("runAutonomousReview")}</Button>
            </form>
          </div>
        ) : (
          <div className="space-y-3">
            {suggestions.map((s) => (
              <div key={s.id} className="rounded border border-[var(--border)] p-4">
                <div className="flex items-center gap-2">
                  <Badge variant="warning">{tc("suggestion")}</Badge>
                  <Badge variant="default">P{s.priority}</Badge>
                  <span className="font-medium">{s.title}</span>
                </div>
                <p className="mt-2 text-sm text-[var(--muted)]">{s.reason}</p>
                {s.status === "DRAFT" && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    <form action={createDiscussionFromSuggestionAction.bind(null, s.id, projectId)}>
                      <Button type="submit" variant="primary">{t("createDiscussion")}</Button>
                    </form>
                    <form action={ignoreSuggestionAction.bind(null, s.id, projectId)}>
                      <Button type="submit" variant="ghost">{t("ignore")}</Button>
                    </form>
                    <form action={archiveSuggestionAction.bind(null, s.id, projectId)}>
                      <Button type="submit" variant="secondary">{t("archive")}</Button>
                    </form>
                  </div>
                )}
                {s.status === "DISCUSSION_CREATED" && s.discussionId && (
                  <Link
                    href={`/projects/${projectId}/discussions/${s.discussionId}`}
                    className="mt-2 inline-block text-sm text-emerald-400 hover:underline"
                  >
                    {tc("viewDiscussion")}
                  </Link>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card>
        <CardTitle>{t("learningHealth")}</CardTitle>
        <div className="grid gap-4 md:grid-cols-4">
          <div>
            <p className="text-xs text-[var(--muted)]">{t("healthScore")}</p>
            <p className="text-3xl font-bold text-emerald-400">
              {learningCenter.health.memoryHealthScore}
              <span className="text-lg text-[var(--muted)]"> / 100</span>
            </p>
          </div>
          <div>
            <p className="text-xs text-[var(--muted)]">{t("activeMemories")}</p>
            <p className="text-2xl font-bold">{learningCenter.health.activeMemories}</p>
            <p className="text-xs text-[var(--muted)]">
              {learningCenter.health.verifiedMemories} {tc("verified")}
            </p>
          </div>
          <div>
            <p className="text-xs text-[var(--muted)]">{t("duplicatesPrevented")}</p>
            <p className="text-2xl font-bold">{learningCenter.health.duplicateMemoriesPrevented}</p>
          </div>
          <div>
            <p className="text-xs text-[var(--muted)]">{t("reopenedDebts")}</p>
            <p className="text-2xl font-bold text-amber-400">{learningCenter.health.reopenedDebts}</p>
          </div>
        </div>
      </Card>

      <Card>
        <CardTitle>{t("learningCenter")}</CardTitle>
        <p className="mb-4 text-sm text-[var(--muted)]">{t("learningCenterDesc")}</p>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <p className="mb-2 text-xs font-medium uppercase text-[var(--muted)]">{t("activeLearnings")}</p>
            {learningCenter.activeLearnings.length === 0 ? (
              <p className="text-sm text-[var(--muted)]">{t("noActiveLessons")}</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {learningCenter.activeLearnings.slice(0, 5).map((lesson, i) => (
                  <li key={i} className="rounded border border-[var(--border)] px-3 py-2">
                    <Badge variant="info" className="mr-2">{translateStatus(ts, "ACTIVE")}</Badge>
                    <span className="font-medium">{lesson.title}</span>
                    <span className="ml-2 text-xs text-[var(--muted)]">
                      ×{lesson.evidenceCount}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div>
            <p className="mb-2 text-xs font-medium uppercase text-[var(--muted)]">{t("verifiedImprovements")}</p>
            {learningCenter.verifiedImprovements.length === 0 ? (
              <p className="text-sm text-[var(--muted)]">{t("noVerifiedCycles")}</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {learningCenter.verifiedImprovements.map((c) => (
                  <li key={c.id} className="rounded border border-[var(--border)] px-3 py-2">
                    <Badge variant="success" className="mr-2">{translateStatus(ts, "VERIFIED")}</Badge>
                    <span className="font-medium">{c.title}</span>
                    {c.topicKey && (
                      <p className="mt-1 text-xs text-[var(--muted)]">{tc("topic")}: {c.topicKey}</p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div>
            <p className="mb-2 text-xs font-medium uppercase text-[var(--muted)]">{t("reopenedProblems")}</p>
            {learningCenter.reopenedProblems.length === 0 ? (
              <p className="text-sm text-[var(--muted)]">{t("noReopenedDebts")}</p>
            ) : (
              <ul className="space-y-1 text-sm text-amber-400">
                {learningCenter.reopenedProblems.map((d, i) => (
                  <li key={i}>
                    ↻ {d.title}
                    <span className="ml-2 text-xs text-[var(--muted)]">×{d.occurrenceCount}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div>
            <p className="mb-2 text-xs font-medium uppercase text-[var(--muted)]">{t("repeatedMistakes")}</p>
            {learningCenter.repeatedMistakes.length === 0 ? (
              <p className="text-sm text-[var(--muted)]">{t("noRepeatedIssues")}</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {learningCenter.repeatedMistakes.map((m, i) => (
                  <li key={i} className="text-amber-400">
                    ⚠ {m.title}
                    <span className="ml-2 text-xs">
                      <Badge variant="warning">{translateStatus(ts, m.status)}</Badge>
                      {" "}×{m.occurrenceCount}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </Card>

      <Card>
        <CardTitle>{t("recentJournals")}</CardTitle>
        {brief.recentJournals.length === 0 ? (
          <div className="space-y-3 text-sm text-[var(--muted)]">
            <p>{t("journalsAfterDebate")}</p>
            <Link href={`/projects/${projectId}/discussions/new`}>
              <Button variant="ghost">{t("startDebate")}</Button>
            </Link>
          </div>
        ) : (
          <ul className="space-y-2">
            {brief.recentJournals.map((j) => (
              <li key={j.id} className="rounded border border-[var(--border)] px-3 py-2 text-sm">
                <Badge variant="default" className="mr-2">{j.type}</Badge>
                <span className="font-medium">{j.title}</span>
                <span className="ml-2 text-[var(--muted)]">— {j.agentName}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardTitle>{t("adrs")}</CardTitle>
          <ul className="space-y-2 text-sm">
            {adrs.map((adr) => (
              <li key={adr.id}>
                <Badge variant="success" className="mr-2">{translateStatus(ts, adr.status)}</Badge>
                {adr.title}
              </li>
            ))}
          </ul>
        </Card>

        <Card>
          <CardTitle>{t("recentTimeline")}</CardTitle>
          <ul className="space-y-2 text-sm">
            {timeline.slice(0, 6).map((e) => (
              <li key={e.id} className="text-[var(--muted)]">
                <span className="text-white">{e.occurredAt.toISOString().slice(0, 10)}</span>
                {" — "}
                {e.title}
              </li>
            ))}
          </ul>
          <Link href={`/projects/${projectId}/timeline`} className="mt-3 inline-block text-sm text-emerald-400 hover:underline">
            {tc("fullTimeline")}
          </Link>
        </Card>
      </div>
    </div>
  );
}

function CouncilMemberRow({
  member,
  projectId,
  tc,
  ta,
}: {
  member: AgentCouncilMember;
  projectId: string;
  tc: Awaited<ReturnType<typeof getTranslations<"common">>>;
  ta: Awaited<ReturnType<typeof getTranslations<"agents">>>;
}) {
  const shortName = member.name.split("—")[0]?.trim() ?? member.name;
  const statusLabel =
    member.status === "active"
      ? ta("active")
      : member.status === "retired"
        ? ta("retired")
        : member.status === "suspended"
          ? ta("suspended")
          : ta("dormant");
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded border border-[var(--border)] px-4 py-3">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <span
            className="flex h-8 w-8 items-center justify-center rounded-full text-lg"
            style={{ backgroundColor: `${member.avatarColor}22`, color: member.avatarColor }}
          >
            {member.avatarEmoji}
          </span>
          <span className="font-medium">
            {shortName} — {member.title}
          </span>
          <Badge variant={member.status === "active" ? "success" : "default"}>
            {statusLabel}
          </Badge>
          {member.isOverallocated && (
            <Badge variant="warning">{ta("overallocated")}</Badge>
          )}
        </div>
        <p className="mt-1 text-sm text-[var(--muted)]">
          {member.department} · {member.rank} · {formatRoleLabel(member.role)}
        </p>
        <p className="mt-1 text-sm text-emerald-400">
          {member.reputation.toFixed(1)} reputation · {tc("influenceScore")}: {member.influenceScore}
          {" · "}{ta("allocation")}: {member.allocationTotal}%
        </p>
        {member.projects.length > 0 && (
          <p className="text-xs text-[var(--muted)]">
            {ta("projects")}: {member.projects.join(", ")}
          </p>
        )}
        <p className="text-xs text-[var(--muted)]">
          ✓ {member.acceptedCount} accepted · ✗ {member.rejectedCount} rejected
          {member.lastActivity && ` · ${member.lastActivity.toLocaleDateString()}`}
        </p>
      </div>
      <div className="flex flex-col gap-2">
        {member.status === "active" && (
          <Link href={`/projects/${projectId}/agents/${member.id}/chat`}>
            <Button variant="secondary">{ta("officeHours")}</Button>
          </Link>
        )}
        <Link href={`/projects/${projectId}/agents/${member.id}`}>
          <Button variant="ghost">{tc("viewProfile")}</Button>
        </Link>
      </div>
    </div>
  );
}

function CouncilRankingCard({
  title,
  members,
  projectId,
  emptyLabel,
  warning = false,
}: {
  title: string;
  members: AgentCouncilMember[];
  projectId: string;
  emptyLabel: string;
  warning?: boolean;
}) {
  return (
    <Card>
      <CardTitle>{title}</CardTitle>
      {members.length === 0 ? (
        <p className="text-sm text-[var(--muted)]">{emptyLabel}</p>
      ) : (
        <ul className="space-y-2 text-sm">
          {members.map((m) => (
            <li key={m.id} className="flex items-center justify-between">
              <Link
                href={`/projects/${projectId}/agents/${m.id}`}
                className={warning ? "text-amber-400 hover:underline" : "hover:text-[var(--accent)]"}
              >
                {m.name.split("—")[0]?.trim() ?? m.name}
              </Link>
              <span className="font-mono text-xs text-[var(--muted)]">
                {m.reputation.toFixed(1)} · {m.influenceScore}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
