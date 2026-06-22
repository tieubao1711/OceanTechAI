import { describe, it, expect } from "vitest";
import { buildAgentPrompt } from "@/server/agents/agent-prompt-builder";
import { OfficeHoursPromptBuilder } from "@/server/office-hours/office-hours-prompt-builder";
import {
  buildDebateGovernanceBlock,
  buildDiscussionSummaryContent,
  buildDecisionRecordContent,
} from "@/server/governance/oceantechai-constitution";
import type { Agent } from "@prisma/client";
import type { RoundContext } from "@/types/debate";
import { emptyProjectKnowledgeSnapshot } from "@/server/knowledge/empty-snapshot";

describe("oceantechai-constitution", () => {
  it("includes company constitution and Vietnamese rule in debate governance block", () => {
    const block = buildDebateGovernanceBlock();
    expect(block).toContain("HIẾN CHƯƠNG OCEANTECHAI");
    expect(block).toContain("QUY TRÌNH THẢO LUẬN CHÍNH THỨC");
    expect(block).toContain("CHÍNH SÁCH BỘ NHỚ TỔ CHỨC");
    expect(block).toContain("TIẾNG VIỆT");
  });

  it("injects constitution into debate agent prompts", () => {
    const agent = {
      id: "a1",
      projectId: "p1",
      name: "Sam — Architect",
      role: "system_architect",
      expertise: ["architecture"],
      systemPrompt: "Focus on modularity.",
      memorySummary: null,
    } as Agent;

    const context = {
      discussion: {
        id: "d1",
        projectId: "p1",
        userPrompt: "Cải thiện debate engine",
        status: "RUNNING",
        mode: "normal",
      },
      project: { id: "p1", name: "Core", workspaceId: "w1" },
      workspace: { id: "w1", name: "WS" },
      agents: [agent],
      userPrompt: "Cải thiện debate engine",
      memoryContext: "",
      discussionMode: "normal" as const,
      projectKnowledge: "",
      projectKnowledgeSnapshot: emptyProjectKnowledgeSnapshot(),
      round: {
        id: "r1",
        discussionId: "d1",
        roundNumber: 1,
        roundType: "PROPOSE",
        status: "RUNNING",
        createdAt: new Date(),
      },
      previousMessages: [],
    } as RoundContext;

    const { systemPrompt, userPrompt } = buildAgentPrompt({
      agent,
      roundType: "PROPOSE",
      context,
      memoryContext: "",
    });

    expect(systemPrompt).toContain("HIẾN CHƯƠNG OCEANTECHAI");
    expect(systemPrompt).toContain("tiếng Việt");
    expect(userPrompt).toContain("VÒNG 1 — TƯ DUY ĐỘC LẬP");
  });

  it("injects constitution into office hours system prompt", () => {
    const builder = new OfficeHoursPromptBuilder();
    const prompt = builder.buildSystemPrompt({
      name: "Quinn — QA",
      title: "QA Lead",
      role: "qa_engineer",
      department: "QA",
      rank: "SENIOR",
      systemPrompt: "Test coverage first.",
      expertise: ["testing"],
    } as Parameters<typeof builder.buildSystemPrompt>[0]);

    expect(prompt).toContain("HIẾN CHƯƠNG OCEANTECHAI");
    expect(prompt).toContain("tiếng Việt");
  });

  it("formats discussion summary and decision records", () => {
    const summary = buildDiscussionSummaryContent({
      topic: "Debate UX",
      mainViews: ["Sam: Modular pipeline"],
      risks: ["Latency"],
      conclusion: "Ship progress panel",
      nextActions: ["Founder review"],
    });
    expect(summary).toContain("DISCUSSION SUMMARY");
    expect(summary).toContain("Chủ đề: Debate UX");

    const decision = buildDecisionRecordContent({
      title: "Debate UX",
      date: "2026-06-11",
      participants: ["Sam", "Quinn"],
      reason: "Founder request",
      decision: "Ship progress panel",
      impact: "Better visibility",
      status: "CHỜ_FOUNDER_DUYỆT",
    });
    expect(decision).toContain("DECISION");
    expect(decision).toContain("CHỜ_FOUNDER_DUYỆT");
  });
});
