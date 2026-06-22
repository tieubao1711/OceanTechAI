import type { AuditFinding, ArchitectureAuditReport } from "./audit-types";
import {
  calculateAuditScore,
  filterValidFindings,
  mergeDuplicateFindings,
  rankFindings,
} from "./audit-quality";
import type { AgentCritiqueResult, AgentFindingsResult } from "./audit-types";
import type { ProjectKnowledgeSnapshot } from "@/server/knowledge/project-knowledge-types";

export function buildAuditSummary(round1: AgentFindingsResult[]): string {
  const lines: string[] = ["AUDIT SUMMARY — Round 1 Findings", ""];

  for (const agent of round1) {
    const label =
      agent.agentRole === "system_architect"
        ? "Architect"
        : agent.agentRole === "backend_engineer"
          ? "Backend"
          : agent.agentRole === "red_team"
            ? "Red Team"
            : agent.agentName;

    lines.push(`${label} Findings (${agent.agentName}):`);
    if (agent.findings.length === 0) {
      lines.push("  (none accepted)");
    } else {
      agent.findings.forEach((f, i) => {
        lines.push(
          `  ${i + 1}. ${f.title} — ${f.fileOrModule} [${f.priority}/${f.fixScope}]`
        );
      });
    }
    lines.push("");
  }

  return lines.join("\n");
}

function applyCritiques(
  findings: AuditFinding[],
  critiques: AgentCritiqueResult[]
): AuditFinding[] {
  const demote = new Set<string>();
  const remove = new Set<string>();

  for (const agent of critiques) {
    for (const c of agent.critiques) {
      const key = c.targetFindingTitle.toLowerCase().trim();
      if (c.verdict === "disagree" || c.verdict === "missing_evidence") {
        remove.add(key);
      } else if (c.verdict === "wrong_priority") {
        demote.add(key);
      }
    }
  }

  return findings
    .filter((f) => !remove.has(f.title.toLowerCase().trim()))
    .map((f) => {
      if (!demote.has(f.title.toLowerCase().trim())) return f;
      const priority =
        f.priority === "critical"
          ? "high"
          : f.priority === "high"
            ? "medium"
            : f.priority === "medium"
              ? "low"
              : "low";
      return { ...f, priority };
    });
}

export class AuditConsensusEngine {
  merge(params: {
    round1: AgentFindingsResult[];
    round2: AgentCritiqueResult[];
    snapshot: ProjectKnowledgeSnapshot;
    tokenUsage: number;
  }): ArchitectureAuditReport {
    const allFindings = params.round1.flatMap((a) =>
      a.findings.map((f) => ({
        ...f,
        sourceAgent: a.agentName,
        sourceRole: a.agentRole,
      }))
    );

    const fileLevel = filterValidFindings(allFindings, params.snapshot);
    const deduped = mergeDuplicateFindings(fileLevel);
    const adjusted = applyCritiques(deduped, params.round2);
    const topFindings = rankFindings(
      filterValidFindings(adjusted, params.snapshot)
    ).slice(0, 5);
    const auditScore = calculateAuditScore(topFindings, params.snapshot);

    const strengths = [
      `${params.snapshot.existingModules.length} modules operational`,
      `${params.snapshot.existingTests.length} test files in suite`,
      `Integrations: ${params.snapshot.existingIntegrations.join(", ")}`,
    ];

    const risks = topFindings
      .filter((f) => f.priority === "critical" || f.priority === "high")
      .map((f) => `${f.title} (${f.fileOrModule})`);

    const recommendations = topFindings.map(
      (f) =>
        `[${f.priority}] ${f.title}: fix in ${f.fileOrModule} (scope: ${f.fixScope})`
    );

    return {
      topFindings,
      strengths,
      risks,
      recommendations,
      tokenUsage: params.tokenUsage,
      auditScore,
      completedAt: new Date().toISOString(),
    };
  }
}

export const auditConsensusEngine = new AuditConsensusEngine();
