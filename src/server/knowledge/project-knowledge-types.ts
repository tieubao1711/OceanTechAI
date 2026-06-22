import type { DiscussionMode } from "@/types/discussion-mode";

export type { DiscussionMode };

export type AuditFileMapEntry = {
  category: string;
  files: string[];
};

export type AuditFindingPriority = "low" | "medium" | "high" | "critical";

export type AuditFinding = {
  title: string;
  evidence: string;
  impact: string;
  priority: AuditFindingPriority;
};

export type ProjectKnowledgeSnapshot = {
  architectureSummary: string;
  existingModules: string[];
  existingFeatures: string[];
  existingTests: string[];
  existingPages: string[];
  existingServices: string[];
  existingIntegrations: string[];
  knownConstraints: string[];
  recentADRs: string[];
  recentDecisions: string[];
  prismaModels: string[];
  packageScripts: string[];
  auditFileMap: AuditFileMapEntry[];
};
