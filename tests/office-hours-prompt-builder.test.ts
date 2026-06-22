import { describe, it, expect } from "vitest";
import { OfficeHoursPromptBuilder } from "@/server/office-hours/office-hours-prompt-builder";
import type { OfficeHoursContextBundle } from "@/server/office-hours/office-hours-types";

describe("office-hours-prompt-builder", () => {
  const builder = new OfficeHoursPromptBuilder();

  const agent = {
    name: "Sam — System Architect",
    title: "Lead Architect",
    role: "system_architect",
    department: "ENGINEERING" as const,
    rank: "LEAD" as const,
    systemPrompt: "Focus on scalability and maintainability.",
    expertise: ["system design", "API design"],
    avatarSeed: null,
    avatarType: "FANTASY" as const,
  };

  const context: OfficeHoursContextBundle = {
    projectName: "OceanTechAI Core",
    projectDescription: "Self-improvement OS",
    assignments: ["OceanTechAI Core: Lead Architect (100%)"],
    memoryBlock: "Project uses PostgreSQL.",
    journals: ["LESSON: Debate integrity — watch lifecycle leaks"],
    debatePositions: ["PROPOSE [SUPPORT]: Modular architecture proposal"],
    learningRecords: ["agent_reputation_voting lifecycle"],
    projectKnowledge: "Architecture: Next.js modular monolith",
    recentMessages: [{ role: "founder", content: "What should we prioritize?" }],
  };

  it("includes role, department, and advisory rules in system prompt", () => {
    const prompt = builder.buildSystemPrompt(agent);
    expect(prompt).toContain("Sam — System Architect");
    expect(prompt).toContain("Lead Architect");
    expect(prompt).toContain("Engineering");
    expect(prompt).toContain("advisory only");
    expect(prompt).toContain("HIẾN CHƯƠNG OCEANTECHAI");
    expect(prompt).toContain("tiếng Việt");
  });

  it("injects memory, journals, debates, learning, and project knowledge", () => {
    const userPrompt = builder.buildUserPrompt({
      founderMessage: "What should we prioritize this week?",
      context,
    });
    expect(userPrompt).toContain("OceanTechAI Core");
    expect(userPrompt).toContain("PostgreSQL");
    expect(userPrompt).toContain("Debate integrity");
    expect(userPrompt).toContain("Modular architecture");
    expect(userPrompt).toContain("agent_reputation_voting");
    expect(userPrompt).toContain("Next.js modular monolith");
    expect(userPrompt).toContain("What should we prioritize this week?");
  });

  it("formats compact project knowledge within line limits", () => {
    const compact = builder.formatCompactProjectKnowledge({
      architectureSummary: "Modular Next.js app",
      existingModules: ["debate", "learning", "workforce"],
      existingServices: ["office-hours.service.ts"],
      knownConstraints: ["Founder approval required"],
      recentADRs: ["ADR-001 Governance"],
      prismaModels: ["Agent", "Discussion"],
    });
    expect(compact).toContain("Modular Next.js app");
    expect(compact).toContain("office-hours.service.ts");
    expect(compact.split("\n").length).toBeLessThanOrEqual(25);
  });
});
