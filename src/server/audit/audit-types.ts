import type { Agent } from "@prisma/client";
import type { ProjectKnowledgeSnapshot } from "@/server/knowledge/project-knowledge-types";

export const AUDIT_AGENT_ROLES = [
  "system_architect",
  "backend_engineer",
  "red_team",
] as const;

export type AuditAgentRole = (typeof AUDIT_AGENT_ROLES)[number];

export const MAX_FINDINGS_PER_AGENT = 5;

export type AuditFindingPriority = "low" | "medium" | "high" | "critical";
export type AuditFixScope = "small" | "medium" | "large";

export type AuditFinding = {
  title: string;
  fileOrModule: string;
  evidence: string;
  impact: string;
  fixScope: AuditFixScope;
  priority: AuditFindingPriority;
  sourceAgent?: string;
  sourceRole?: string;
};

export type AuditCritique = {
  targetFindingTitle: string;
  verdict: "agree" | "disagree" | "missing_evidence" | "wrong_priority";
  reason: string;
};

export type AuditScore = {
  specificity: number;
  evidenceQuality: number;
  implementationReadiness: number;
  hallucinationRisk: number;
};

export type ArchitectureAuditReport = {
  topFindings: AuditFinding[];
  strengths: string[];
  risks: string[];
  recommendations: string[];
  tokenUsage: number;
  auditScore: AuditScore;
  completedAt: string;
};

export type AuditContext = {
  discussionId: string;
  projectId: string;
  userPrompt: string;
  projectKnowledge: string;
  snapshot: ProjectKnowledgeSnapshot;
  agents: Agent[];
};

export type AgentFindingsResult = {
  agentId: string;
  agentName: string;
  agentRole: string;
  findings: AuditFinding[];
  content: string;
  concerns: string[];
  suggestions: string[];
  provider: string;
  model: string;
  tokenTotal: number;
  qualityScore: number;
};

export type AgentCritiqueResult = {
  agentId: string;
  agentName: string;
  agentRole: string;
  critiques: AuditCritique[];
  content: string;
  concerns: string[];
  provider: string;
  model: string;
  tokenTotal: number;
};
