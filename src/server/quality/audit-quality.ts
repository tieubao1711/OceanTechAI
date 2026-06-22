/** @deprecated Import from @/server/audit/audit-quality for Phase 2.6+ */
export {
  AuditFindingSchema,
  AuditCritiqueSchema,
  parseAuditFindings,
  parseAuditCritiques,
  validateFinding,
  filterValidFindings,
  buildAuditRetryPrompt,
  classifyDebtSpecificity,
  calculateAuditScore,
  mergeDuplicateFindings,
  rankFindings,
  parseArchitectureAuditReport,
  hasModuleReference,
  isGenericAdvice,
  EVIDENCE_MIN_LENGTH,
  FILE_OR_MODULE_MIN_LENGTH,
} from "@/server/audit/audit-quality";

// Legacy agent-runner compatibility
import type { AgentMessageContractType } from "@/server/contracts/agent-message.contract";
import type { ProjectKnowledgeSnapshot } from "@/server/knowledge/project-knowledge-types";
import {
  filterValidFindings,
  hasModuleReference,
  isGenericAdvice,
  parseAuditFindings,
} from "@/server/audit/audit-quality";

export type AuditQualityResult = {
  penalty: number;
  issues: string[];
  findingsValid: boolean;
};

export function scoreAuditAwareness(params: {
  message: AgentMessageContractType;
  snapshot: ProjectKnowledgeSnapshot;
  findings?: ReturnType<typeof parseAuditFindings>;
  isAuditMode: boolean;
}): AuditQualityResult {
  const { message, snapshot, findings = [], isAuditMode } = params;
  const issues: string[] = [];
  let penalty = 0;

  if (!isAuditMode) {
    return { penalty: 0, issues: [], findingsValid: true };
  }

  const blob = [message.content, ...message.concerns, ...message.suggestions].join(" ");

  if (isGenericAdvice(blob)) {
    penalty += 20;
    issues.push("Generic architectural advice detected");
  }

  if (!hasModuleReference(blob, snapshot)) {
    penalty += 20;
    issues.push("Response lacks specific module, service, or file references");
  }

  const valid = filterValidFindings(findings, snapshot);
  let findingsValid = true;
  if (valid.length === 0) {
    penalty += 15;
    issues.push("Audit mode requires at least one finding with evidence");
    findingsValid = false;
  }

  return { penalty, issues, findingsValid };
}
