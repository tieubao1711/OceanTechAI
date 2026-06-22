import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { proposalService } from "@/server/services/proposal.service";
import { Card, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  approveProposalAction,
  rejectProposalAction,
  requestChangesAction,
  executeToGitHubAction,
} from "@/app/actions";
import { EXECUTION_LOG_TYPES } from "@/server/execution/execution-plan";
import { translateStatus } from "@/i18n/status";

function proposalVariant(status: string) {
  if (status === "APPROVED") return "success" as const;
  if (status === "REJECTED") return "danger" as const;
  if (status === "CHANGES_REQUESTED") return "warning" as const;
  return "info" as const;
}

function executionStatusVariant(status: string) {
  if (status === "SUCCESS") return "success" as const;
  if (status === "FAILED") return "danger" as const;
  return "warning" as const;
}

function extractPrUrl(logs: { type: string; status: string; metadata: unknown }[]) {
  const prLog = [...logs]
    .reverse()
    .find((l) => l.type === EXECUTION_LOG_TYPES.GITHUB_PR && l.status === "SUCCESS");
  const meta = prLog?.metadata as { prUrl?: string } | null;
  return meta?.prUrl;
}

function extractIssueUrls(logs: { type: string; status: string; metadata: unknown }[]) {
  const issues: { url: string; task?: string }[] = [];
  for (const log of logs) {
    if (log.type !== EXECUTION_LOG_TYPES.GITHUB_ISSUE || log.status !== "SUCCESS") continue;
    const meta = log.metadata as { issueUrl?: string; task?: string } | null;
    if (meta?.issueUrl) {
      issues.push({ url: meta.issueUrl, task: meta.task });
    }
  }
  return issues;
}

export default async function ProposalDetailPage({
  params,
}: {
  params: Promise<{ projectId: string; proposalId: string }>;
}) {
  const { projectId, proposalId } = await params;
  const t = await getTranslations("proposal");
  const tc = await getTranslations("common");
  const ts = await getTranslations("status");
  const proposal = await proposalService.getById(proposalId);
  const githubStatus = await proposalService.getGitHubConfigStatus(projectId);

  const prUrl = extractPrUrl(proposal.executionLogs);
  const issueUrls = extractIssueUrls(proposal.executionLogs);
  const hasSuccessfulPr = Boolean(prUrl);

  return (
    <div className="space-y-8">
      <div>
        <Link href={`/projects/${projectId}`} className="text-sm text-[var(--muted)] hover:text-white">
          {tc("backProject")}
        </Link>
        <h1 className="mt-2 text-2xl font-bold">{proposal.title}</h1>
        <Badge variant={proposalVariant(proposal.status)} className="mt-2">
          {translateStatus(ts, proposal.status)}
        </Badge>
        {proposal.voteClassification && (
          <Badge variant="default" className="ml-2">
            {t("voteLabel")}: {proposal.voteClassification}
          </Badge>
        )}
      </div>

      <Card>
        <CardTitle>{t("summary")}</CardTitle>
        <p className="whitespace-pre-wrap text-sm text-[var(--muted)]">{proposal.summary}</p>
      </Card>

      <Card>
        <CardTitle>{t("chosenSolution")}</CardTitle>
        <p className="text-sm">{proposal.chosenSolution}</p>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardTitle>{t("alternatives")}</CardTitle>
          <ul className="ml-4 list-disc space-y-1 text-sm text-[var(--muted)]">
            {proposal.alternativesConsidered.map((a, i) => <li key={i}>{a}</li>)}
          </ul>
        </Card>
        <Card>
          <CardTitle>{t("risks")}</CardTitle>
          <ul className="ml-4 list-disc space-y-1 text-sm text-amber-400">
            {proposal.risks.map((r, i) => <li key={i}>{r}</li>)}
          </ul>
        </Card>
      </div>

      <Card>
        <CardTitle>{t("filesToCreate")}</CardTitle>
        <ul className="ml-4 list-disc text-sm text-[var(--muted)]">
          {proposal.filesToCreate.map((f, i) => <li key={i}>{f}</li>)}
        </ul>
      </Card>

      {proposal.status === "PENDING" && (
        <Card>
          <CardTitle>{t("founderDecision")}</CardTitle>
          <p className="mb-4 text-sm text-[var(--muted)]">{t("approvalRequired")}</p>
          <div className="flex flex-wrap gap-3">
            <form action={approveProposalAction.bind(null, proposalId, projectId)}>
              <Button type="submit" variant="primary">{t("approve")}</Button>
            </form>
            <form action={rejectProposalAction.bind(null, proposalId, projectId)}>
              <Button type="submit" variant="danger">{t("reject")}</Button>
            </form>
            <form action={requestChangesAction.bind(null, proposalId, projectId)}>
              <Button type="submit" variant="secondary">{t("requestChanges")}</Button>
            </form>
          </div>
        </Card>
      )}

      {proposal.decisionLog && (
        <Card>
          <CardTitle>{t("decisionLog")}</CardTitle>
          <p className="text-sm">
            {t("decidedBy", {
              action: proposal.decisionLog.action,
              name: proposal.decisionLog.decider.name,
              date: proposal.decisionLog.decidedAt.toISOString(),
            })}
          </p>
          {proposal.decisionLog.notes && (
            <p className="mt-1 text-sm text-[var(--muted)]">{proposal.decisionLog.notes}</p>
          )}
        </Card>
      )}

      {proposal.status === "APPROVED" && (
        <>
          <Card>
            <CardTitle>{t("generatedFiles")}</CardTitle>
            {proposal.generatedFiles.length === 0 ? (
              <p className="text-sm text-[var(--muted)]">{t("noGeneratedFiles")}</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {proposal.generatedFiles.map((file) => (
                  <li key={file.id} className="rounded border border-[var(--border)] px-3 py-2">
                    <span className="font-mono text-emerald-400">{file.path}</span>
                    <span className="ml-2 text-[var(--muted)]">({file.mimeType})</span>
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-4">
              <Link href={`/projects/${projectId}/generated`}>
                <Button variant="secondary">{tc("viewAllGenerated")}</Button>
              </Link>
            </div>
          </Card>

          <Card>
            <CardTitle>{t("githubExecution")}</CardTitle>
            <p className="mb-4 text-sm text-[var(--muted)]">{t("manualRequired")}</p>

            {!githubStatus.configured && (
              <div className="mb-4 rounded border border-amber-500/40 bg-amber-500/10 p-4 text-sm">
                <p className="font-medium text-amber-300">{t("githubNotConfigured")}</p>
                <p className="mt-1 text-[var(--muted)]">
                  {t("addEnvVars", { file: ".env" })}
                </p>
                <pre className="mt-2 overflow-x-auto rounded bg-black/30 p-3 font-mono text-xs text-[var(--muted)]">
{`GITHUB_TOKEN=ghp_...
GITHUB_OWNER=your-org
GITHUB_REPO=your-repo
GITHUB_DEFAULT_BRANCH=main`}
                </pre>
                {githubStatus.missing.length > 0 && (
                  <p className="mt-2 text-amber-400">
                    {t("missing")}: {githubStatus.missing.join(", ")}
                  </p>
                )}
              </div>
            )}

            {githubStatus.configured && githubStatus.owner && githubStatus.repo && (
              <p className="mb-4 text-sm text-[var(--muted)]">
                {t("target")}: <span className="font-mono text-emerald-400">{githubStatus.owner}/{githubStatus.repo}</span>
                {githubStatus.source && (
                  <span className="ml-2 text-xs">{t("configSource", { source: githubStatus.source })}</span>
                )}
              </p>
            )}

            {prUrl && (
              <div className="mb-4 rounded border border-emerald-500/40 bg-emerald-500/10 p-3 text-sm">
                <p className="font-medium text-emerald-300">{t("pullRequest")}</p>
                <a href={prUrl} target="_blank" rel="noopener noreferrer" className="text-emerald-400 underline">
                  {prUrl}
                </a>
              </div>
            )}

            {issueUrls.length > 0 && (
              <div className="mb-4 rounded border border-blue-500/40 bg-blue-500/10 p-3 text-sm">
                <p className="mb-2 font-medium text-blue-300">{t("githubIssues")}</p>
                <ul className="space-y-1">
                  {issueUrls.map((issue, i) => (
                    <li key={i}>
                      <a href={issue.url} target="_blank" rel="noopener noreferrer" className="text-blue-400 underline">
                        {issue.task ?? issue.url}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {!hasSuccessfulPr && (
              <form action={executeToGitHubAction.bind(null, proposalId, projectId)}>
                <Button
                  type="submit"
                  variant="primary"
                  disabled={!githubStatus.configured || proposal.generatedFiles.length === 0}
                >
                  {t("executeToGitHub")}
                </Button>
              </form>
            )}

            {hasSuccessfulPr && (
              <p className="text-sm text-[var(--muted)]">{t("prAlreadyCreated")}</p>
            )}
          </Card>

          {proposal.executionLogs.length > 0 && (
            <Card>
              <CardTitle>{t("executionLogs")}</CardTitle>
              <ul className="space-y-2">
                {proposal.executionLogs.map((log) => (
                  <li
                    key={log.id}
                    className="flex flex-wrap items-center gap-2 rounded border border-[var(--border)] px-3 py-2 text-sm"
                  >
                    <Badge variant="default">{log.type}</Badge>
                    <Badge variant={executionStatusVariant(log.status)}>{translateStatus(ts, log.status)}</Badge>
                    <span className="text-[var(--muted)]">{log.createdAt.toISOString()}</span>
                    {log.message && <span className="w-full text-[var(--muted)]">{log.message}</span>}
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
