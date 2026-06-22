import { describe, it, expect } from "vitest";
import {
  validateFinding,
  filterValidFindings,
  classifyDebtSpecificity,
  classifyFindingSpecificity,
  mergeDuplicateFindings,
  rankFindings,
  calculateAuditScore,
  parseAuditFindings,
  isFileLevelReference,
  isBroadCategoryReference,
} from "@/server/audit/audit-quality";
import type { AuditFinding } from "@/server/audit/audit-types";
import { projectKnowledgeBuilder } from "@/server/knowledge/project-knowledge-builder";

const snapshot = projectKnowledgeBuilder.buildFromFilesystem();

const validFinding: AuditFinding = {
  title: "Reputation not used in voting",
  fileOrModule: "src/server/governance/voting.service.ts",
  evidence: "Agent.reputationScore is stored but voting.service.ts uses static votingWeight",
  impact: "Reputation has no effect on consensus outcomes",
  fixScope: "small",
  priority: "high",
};

describe("audit-quality (Phase 2.6.1)", () => {
  it("isFileLevelReference accepts src paths", () => {
    expect(isFileLevelReference("src/server/governance/voting.service.ts")).toBe(true);
    expect(isFileLevelReference("voting.service.ts")).toBe(true);
  });

  it("isBroadCategoryReference detects module labels", () => {
    expect(isBroadCategoryReference("Governance")).toBe(true);
    expect(isBroadCategoryReference("External Integrations")).toBe(true);
    expect(isBroadCategoryReference("AI Provider Layer")).toBe(true);
    expect(isBroadCategoryReference("src/server/governance/voting.service.ts")).toBe(false);
  });

  it("rejects broad category fileOrModule", () => {
    const result = validateFinding(
      { ...validFinding, fileOrModule: "Governance" },
      snapshot
    );
    expect(result.valid).toBe(false);
  });

  it("accepts file path findings", () => {
    expect(validateFinding(validFinding, snapshot).valid).toBe(true);
  });

  it("classifies file path finding as GOOD", () => {
    expect(classifyFindingSpecificity(validFinding)).toBe("good");
  });

  it("classifies broad module finding as NEUTRAL", () => {
    expect(
      classifyFindingSpecificity({
        ...validFinding,
        fileOrModule: "External Integrations",
      })
    ).toBe("neutral");
  });

  it("classifies generic finding as BAD", () => {
    expect(classifyDebtSpecificity("Need better architecture")).toBe("bad");
    expect(classifyDebtSpecificity("Need more testing")).toBe("bad");
  });

  it("filters out non-file-level findings", () => {
    const findings = filterValidFindings(
      [
        validFinding,
        { ...validFinding, fileOrModule: "AI Provider Layer", title: "Provider issue" },
      ],
      snapshot
    );
    expect(findings).toHaveLength(1);
    expect(findings[0].fileOrModule).toContain("voting.service.ts");
  });

  it("calculates audit score with file-level findings", () => {
    const score = calculateAuditScore([validFinding], snapshot);
    expect(score.specificity).toBe(100);
    expect(score.evidenceQuality).toBe(100);
  });

  it("parses findings with fileOrModule", () => {
    const parsed = parseAuditFindings([
      {
        title: "Token bloat",
        fileOrModule: "src/server/debate/debate-orchestrator.ts",
        evidence: "Full message history passed to every agent each round",
        impact: "High OpenAI cost per debate",
        fixScope: "medium",
        priority: "high",
      },
    ]);
    expect(parsed[0].fileOrModule).toContain("debate-orchestrator");
  });

  it("merges duplicates deterministically", () => {
    const merged = mergeDuplicateFindings([
      validFinding,
      { ...validFinding, priority: "critical" },
    ]);
    expect(merged).toHaveLength(1);
    expect(merged[0].priority).toBe("critical");
  });

  it("ranks by priority", () => {
    const ranked = rankFindings([
      { ...validFinding, priority: "low" },
      { ...validFinding, title: "Critical", priority: "critical" },
    ]);
    expect(ranked[0].priority).toBe("critical");
  });
});
