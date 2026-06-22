import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { executiveService } from "@/server/services/executive.service";
import { Card, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatRoleLabel } from "@/server/agents/agent-profile";
import { translateStatus } from "@/i18n/status";
import { JOURNAL_TYPES } from "@/server/journals/journal-types";

function journalTypeLabel(type: string): string {
  switch (type) {
    case JOURNAL_TYPES.OBSERVATION:
      return "Observation";
    case JOURNAL_TYPES.WARNING:
      return "Warning";
    case JOURNAL_TYPES.LESSON_LEARNED:
      return "Lesson";
    case JOURNAL_TYPES.IDEA:
      return "Idea";
    case JOURNAL_TYPES.DECISION:
      return "Decision";
    case JOURNAL_TYPES.RETROSPECTIVE:
      return "Retrospective";
    default:
      return type;
  }
}

function IdentityList({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <div>
      <p className="mb-1 text-xs font-medium uppercase text-[var(--muted)]">{title}</p>
      <ul className="flex flex-wrap gap-2">
        {items.map((item) => (
          <Badge key={item} variant="default">{item}</Badge>
        ))}
      </ul>
    </div>
  );
}

export default async function AgentProfilePage({
  params,
}: {
  params: Promise<{ projectId: string; agentId: string }>;
}) {
  const { projectId, agentId } = await params;
  const t = await getTranslations("agentProfile");
  const ta = await getTranslations("agents");
  const tc = await getTranslations("common");
  const ts = await getTranslations("status");
  const profile = await executiveService.getAgentProfile(projectId, agentId);

  return (
    <div className="space-y-8">
      <div>
        <Link href={`/projects/${projectId}/agents`} className="text-sm text-[var(--muted)] hover:text-white">
          {tc("backAgents")}
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold">{profile.member.name}</h1>
          <Badge variant="info">{formatRoleLabel(profile.member.role)}</Badge>
          <Badge variant={profile.member.status === "active" ? "success" : "default"}>
            {profile.member.status === "active" ? ta("active") : ta("dormant")}
          </Badge>
          {profile.member.status === "active" && (
            <Link href={`/projects/${projectId}/agents/${agentId}/chat`}>
              <Button variant="primary">{ta("officeHours")}</Button>
            </Link>
          )}
        </div>
        <p className="mt-2 text-sm text-[var(--muted)]">{profile.systemPrompt}</p>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <p className="text-xs text-[var(--muted)]">{ta("reputation")}</p>
          <p className="text-3xl font-bold text-emerald-400">{profile.member.reputation.toFixed(1)}</p>
        </Card>
        <Card>
          <p className="text-xs text-[var(--muted)]">{tc("influenceScore")}</p>
          <p className="text-3xl font-bold">{profile.member.influenceScore}</p>
        </Card>
        <Card>
          <p className="text-xs text-[var(--muted)]">{ta("accepted")} / {ta("rejected")}</p>
          <p className="text-2xl font-bold">
            <span className="text-emerald-400">{profile.member.acceptedCount}</span>
            {" / "}
            <span className="text-amber-400">{profile.member.rejectedCount}</span>
          </p>
        </Card>
        <Card>
          <p className="text-xs text-[var(--muted)]">{ta("debates")}</p>
          <p className="text-3xl font-bold">{profile.member.proposalCount}</p>
          {profile.member.lastActivity && (
            <p className="mt-1 text-xs text-[var(--muted)]">
              {tc("lastActivity")}: {profile.member.lastActivity.toLocaleDateString()}
            </p>
          )}
        </Card>
      </div>

      <Card>
        <CardTitle>{t("summary")}</CardTitle>
        <p className="whitespace-pre-wrap text-sm text-[var(--muted)]">{profile.briefing.summary}</p>
        <div className="mt-4 grid gap-3 md:grid-cols-3 text-sm">
          {profile.briefing.strongIn.length > 0 && (
            <div>
              <p className="text-xs font-medium uppercase text-[var(--muted)]">{t("strongIn")}</p>
              <p>{profile.briefing.strongIn.join(", ")}</p>
            </div>
          )}
          {profile.briefing.frequentlyRecommends.length > 0 && (
            <div>
              <p className="text-xs font-medium uppercase text-[var(--muted)]">{t("frequentlyRecommends")}</p>
              <p>{profile.briefing.frequentlyRecommends.join(", ")}</p>
            </div>
          )}
          {profile.briefing.risks.length > 0 && (
            <div>
              <p className="text-xs font-medium uppercase text-amber-400">{t("risks")}</p>
              <p className="text-amber-300">{profile.briefing.risks.join("; ")}</p>
            </div>
          )}
        </div>
      </Card>

      <Card>
        <CardTitle>{t("identity")}</CardTitle>
        <div className="grid gap-4 md:grid-cols-2">
          <IdentityList title={t("strengths")} items={profile.identity.strengths} />
          <IdentityList title={t("weaknesses")} items={profile.identity.weaknesses} />
          <IdentityList title={t("expertiseAreas")} items={profile.identity.expertiseAreas} />
          <IdentityList title={t("behavioralTraits")} items={profile.identity.behavioralTraits} />
          <IdentityList title={t("preferredTopics")} items={profile.identity.preferredTopics} />
          <IdentityList title={t("avoidedTopics")} items={profile.identity.avoidedTopics} />
        </div>
      </Card>

      <Card>
        <CardTitle>{t("debateHistory")}</CardTitle>
        {profile.debateHistory.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">{t("noDebates")}</p>
        ) : (
          <div className="space-y-2">
            {profile.debateHistory.map((entry) => (
              <div
                key={entry.discussionId}
                className="flex flex-wrap items-center justify-between gap-2 rounded border border-[var(--border)] px-3 py-2 text-sm"
              >
                <div>
                  <Link
                    href={`/projects/${projectId}/discussions/${entry.discussionId}`}
                    className="font-medium hover:text-[var(--accent)]"
                  >
                    {entry.title}
                  </Link>
                  <p className="text-xs text-[var(--muted)]">
                    {t("roleInDebate")}: {entry.roleInDebate}
                    {entry.vote && ` · ${t("vote")}: ${entry.vote}`}
                    {entry.outcome && ` · ${t("outcome")}: ${translateStatus(ts, entry.outcome)}`}
                  </p>
                </div>
                <span className="text-xs text-[var(--muted)]">
                  {entry.occurredAt.toLocaleDateString()}
                </span>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card>
        <CardTitle>{t("learningTimeline")}</CardTitle>
        {profile.journalTimeline.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">{t("noJournals")}</p>
        ) : (
          <div className="space-y-3">
            {profile.journalTimeline.map((entry) => (
              <div key={entry.id} className="rounded border border-[var(--border)] px-3 py-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="info">{journalTypeLabel(entry.type)}</Badge>
                  <span className="font-medium">{entry.title}</span>
                  <span className="text-xs text-[var(--muted)]">
                    {entry.createdAt.toLocaleDateString()}
                  </span>
                </div>
                <p className="mt-2 whitespace-pre-wrap text-sm text-[var(--muted)]">
                  {entry.content.slice(0, 400)}
                  {entry.content.length > 400 ? "…" : ""}
                </p>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Link href={`/projects/${projectId}/agents`}>
        <Button variant="secondary">{tc("backAgents")}</Button>
      </Link>
    </div>
  );
}
