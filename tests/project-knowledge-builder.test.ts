import { describe, it, expect } from "vitest";
import { projectKnowledgeBuilder } from "@/server/knowledge/project-knowledge-builder";

describe("ProjectKnowledgeBuilder", () => {
  it("builds snapshot from real workspace files", () => {
    const snapshot = projectKnowledgeBuilder.buildFromFilesystem();

    expect(snapshot.existingModules.length).toBeGreaterThan(5);
    expect(snapshot.existingTests.length).toBeGreaterThan(10);
    expect(snapshot.existingIntegrations.some((i) => i.toLowerCase().includes("openai"))).toBe(
      true
    );
    expect(snapshot.existingModules.some((m) => m.toLowerCase().includes("debate"))).toBe(true);
    expect(snapshot.prismaModels).toContain("Discussion");
    expect(snapshot.knownConstraints.some((c) => c.includes("Founder approval"))).toBe(true);
    expect(snapshot.architectureSummary).toContain("OceanTechAI");
  });

  it("builds auditFileMap with governance and provider files", () => {
    const snapshot = projectKnowledgeBuilder.buildFromFilesystem();

    expect(snapshot.auditFileMap.length).toBeGreaterThan(5);

    const governance = snapshot.auditFileMap.find((e) => e.category === "Governance");
    expect(governance?.files).toContain("src/server/governance/voting.service.ts");

    const providers = snapshot.auditFileMap.find((e) => e.category === "AI Provider Layer");
    expect(providers?.files).toContain("src/server/ai/providers/model-router.ts");
    expect(providers?.files).toContain("src/server/agents/agent-runner.ts");

    const audit = snapshot.auditFileMap.find((e) => e.category === "Architecture Audit");
    expect(audit?.files).toContain("src/server/audit/audit-orchestrator.ts");
  });
});
