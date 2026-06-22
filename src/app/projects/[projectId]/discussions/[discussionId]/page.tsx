import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { discussionService } from "@/server/services/discussion.service";
import { debateLiveService } from "@/server/services/debate-live.service";
import { getDiscussionUsageSummary } from "@/server/usage/usage-tracker";
import { Badge } from "@/components/ui/badge";
import { DebateLiveView } from "@/components/debate-live-view";
import { translateStatus } from "@/i18n/status";

function statusVariant(status: string) {
  if (status === "COMPLETED") return "success" as const;
  if (status === "RUNNING") return "info" as const;
  if (status === "FAILED") return "danger" as const;
  return "warning" as const;
}

export default async function DiscussionDetailPage({
  params,
}: {
  params: Promise<{ projectId: string; discussionId: string }>;
}) {
  const { projectId, discussionId } = await params;
  const t = await getTranslations("discussion");
  const tc = await getTranslations("common");
  const ts = await getTranslations("status");
  const [discussion, liveState] = await Promise.all([
    discussionService.getById(discussionId),
    debateLiveService.getLiveState(discussionId),
  ]);
  const usage =
    discussion.rounds.some((r) => r.messages.length > 0)
      ? await getDiscussionUsageSummary(discussionId)
      : null;

  return (
    <div className="space-y-8">
      <div>
        <Link href={`/projects/${projectId}`} className="text-sm text-[var(--muted)] hover:text-white">
          {tc("backProject")}
        </Link>
        <h1 className="mt-2 text-2xl font-bold">{t("title")}</h1>
        <p className="mt-2 rounded bg-slate-900 p-3 text-sm">{discussion.userPrompt}</p>
        <div className="mt-2 flex flex-wrap gap-2">
          <Badge variant={statusVariant(discussion.status)}>{translateStatus(ts, discussion.status)}</Badge>
          {discussion.mode === "architecture_audit" && (
            <Badge variant="warning">{t("architectureAudit")}</Badge>
          )}
          {discussion.proposal?.qualityScore != null && (
            <Badge variant="info">{t("proposalQuality", { score: discussion.proposal.qualityScore })}</Badge>
          )}
        </div>
        {discussion.lastError && (
          <p className="mt-3 rounded border border-red-800 bg-red-950/50 p-3 text-sm text-red-300">
            <strong>{tc("error")}:</strong> {discussion.lastError}
          </p>
        )}
        {usage && usage.totalTokens > 0 && (
          <p className="mt-3 text-xs text-[var(--muted)]">
            {t("tokenUsage", {
              total: usage.totalTokens,
              input: usage.totalInputTokens,
              output: usage.totalOutputTokens,
            })}
            {usage.fallbackCount > 0 && t("fallbackCount", { count: usage.fallbackCount })}
          </p>
        )}
      </div>

      <DebateLiveView
        discussionId={discussionId}
        projectId={projectId}
        initialState={liveState}
      />
    </div>
  );
}
