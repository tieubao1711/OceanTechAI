import type { DecisionAction } from "@prisma/client";
import type { ArchitectureAuditReport, AuditFinding } from "@/server/audit/audit-types";
import type { ExecutionResult } from "@/server/execution/execution-plan";
import type { LearningEvent, LearningImportance } from "./learning-types";

function normalizeTopic(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function topicSimilarity(a: string, b: string): number {
  const na = normalizeTopic(a);
  const nb = normalizeTopic(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1;
  if (na.includes(nb) || nb.includes(na)) return 0.85;

  const wordsA = new Set(na.split(" ").filter((w) => w.length > 3));
  const wordsB = new Set(nb.split(" ").filter((w) => w.length > 3));
  if (wordsA.size === 0 || wordsB.size === 0) return 0;

  let overlap = 0;
  for (const w of wordsA) {
    if (wordsB.has(w)) overlap++;
  }
  return overlap / Math.max(wordsA.size, wordsB.size);
}

export function findingKey(finding: AuditFinding): string {
  return `${normalizeTopic(finding.title)}::${normalizeTopic(finding.fileOrModule)}`;
}

export function detectResolvedDebts(
  previousFindings: AuditFinding[],
  currentFindings: AuditFinding[]
): AuditFinding[] {
  const currentKeys = new Set(currentFindings.map(findingKey));

  return previousFindings.filter((prev) => {
    const key = findingKey(prev);
    if (currentKeys.has(key)) return false;

    return !currentFindings.some(
      (curr) =>
        topicSimilarity(curr.title, prev.title) >= 0.7 ||
        topicSimilarity(curr.fileOrModule, prev.fileOrModule) >= 0.9
    );
  });
}

export function detectAuditCompleted(report: ArchitectureAuditReport): LearningEvent {
  const topDebt = report.topFindings[0];
  const importance: LearningImportance =
    report.topFindings.some((f) => f.priority === "critical" || f.priority === "high")
      ? "high"
      : "medium";

  return {
    type: "AUDIT_COMPLETED",
    title: `Architecture audit completed`,
    evidence: report.topFindings.slice(0, 5).map(
      (f) => `${f.title} (${f.fileOrModule})`
    ),
    outcome: topDebt
      ? `Top debt: ${topDebt.title} in ${topDebt.fileOrModule}`
      : "No critical debts identified",
    importance,
  };
}

export function detectDebtResolved(finding: AuditFinding): LearningEvent {
  return {
    type: "DEBT_RESOLVED",
    title: `Debt resolved: ${finding.title}`,
    evidence: [finding.fileOrModule, finding.evidence].filter(Boolean),
    outcome: `Previously flagged debt no longer appears in audit findings`,
    importance:
      finding.priority === "critical" || finding.priority === "high" ? "high" : "medium",
  };
}

export function detectProposalApproved(params: {
  title: string;
  chosenSolution: string;
  risks: string[];
  action: DecisionAction;
}): LearningEvent | null {
  if (params.action !== "APPROVED") return null;

  return {
    type: "PROPOSAL_APPROVED",
    title: `Proposal approved: ${params.title}`,
    evidence: [
      params.chosenSolution,
      ...params.risks.slice(0, 2),
    ].filter(Boolean),
    outcome: "Founder approved — decision memory recorded",
    importance: params.risks.some((r) => r.toLowerCase().includes("security"))
      ? "high"
      : "medium",
  };
}

export function detectExecutionCompleted(params: {
  proposalTitle: string;
  result: ExecutionResult;
}): LearningEvent | null {
  if (!params.result.success) return null;

  return {
    type: "EXECUTION_COMPLETED",
    title: `Execution succeeded: ${params.proposalTitle}`,
    evidence: [
      params.result.prUrl ? `PR: ${params.result.prUrl}` : "",
      params.result.branchName ? `Branch: ${params.result.branchName}` : "",
      ...(params.result.issueUrls ?? []).slice(0, 2).map((u) => `Issue: ${u}`),
    ].filter(Boolean),
    outcome: params.result.skipped
      ? "Execution already completed (idempotent)"
      : "Approved proposal executed to GitHub successfully",
    importance: "high",
  };
}

export function detectSelfImprovementCompleted(params: {
  cycleTitle: string;
  resolvedDebt: string;
  validationAuditId: string;
}): LearningEvent {
  return {
    type: "SELF_IMPROVEMENT_COMPLETED",
    title: `Self-improvement cycle verified: ${params.cycleTitle}`,
    evidence: [
      `Resolved: ${params.resolvedDebt}`,
      `Validation audit: ${params.validationAuditId}`,
    ],
    outcome: "Audit → Proposal → Execution → Audit validation complete",
    importance: "high",
  };
}

export function isTopicAlreadySolved(
  topic: string,
  solvedTopics: string[],
  threshold = 0.65
): { matched: boolean; matchedTopic?: string } {
  for (const solved of solvedTopics) {
    if (topicSimilarity(topic, solved) >= threshold) {
      return { matched: true, matchedTopic: solved };
    }
  }
  return { matched: false };
}
