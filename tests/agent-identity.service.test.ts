import { describe, it, expect } from "vitest";
import { AgentIdentityService } from "@/server/agents/agent-identity.service";
import { JOURNAL_TYPES } from "@/server/journals/journal-types";

describe("agent-identity.service", () => {
  const service = new AgentIdentityService();

  const baseParams = {
    role: "system_architect",
    expertise: ["system design", "scalability"],
    acceptedCount: 0,
    rejectedCount: 0,
    proposalCount: 0,
    journalTypes: [] as string[],
    messageStances: [] as string[],
    messageConcerns: [] as string[],
    messageSuggestions: [] as string[],
    journalContents: [] as string[],
    messageContents: [] as string[],
    votesYesOnRejected: 0,
    votesYesOnApproved: 0,
    avgQuality: 70,
  };

  it("extracts strengths from high acceptance and warnings", () => {
    const identity = service.deriveIdentity({
      ...baseParams,
      acceptedCount: 5,
      rejectedCount: 1,
      proposalCount: 4,
      journalTypes: [JOURNAL_TYPES.WARNING, JOURNAL_TYPES.WARNING],
      messageConcerns: ["risk", "security", "edge", "failure", "retry"],
      votesYesOnApproved: 3,
      avgQuality: 82,
    });

    expect(identity.strengths).toContain("Trusted by governance");
    expect(identity.strengths).toContain("Risk identification");
    expect(identity.strengths).toContain("Raises useful risks");
  });

  it("extracts architecture expertise from journal content", () => {
    const identity = service.deriveIdentity({
      ...baseParams,
      journalContents: [
        "Modular architecture improves scalability and maintainability",
        "API design governance patterns for long-term system design",
      ],
      messageContents: ["architecture modularization proposal"],
    });

    expect(identity.expertiseAreas.some((e) => e.toLowerCase().includes("architecture"))).toBe(
      true
    );
  });

  it("detects over-engineering weakness from refine-heavy behavior", () => {
    const identity = service.deriveIdentity({
      ...baseParams,
      proposalCount: 3,
      messageStances: ["REFINE", "REFINE", "REFINE", "REFINE", "REFINE"],
      messageSuggestions: ["a", "b", "c", "d", "e", "f"],
    });

    expect(identity.weaknesses).toContain("Sometimes over-engineers solutions");
    expect(identity.behavioralTraits).toContain("Detail-oriented refiner");
  });

  it("builds readable briefing summary", () => {
    const identity = service.deriveIdentity({
      ...baseParams,
      acceptedCount: 4,
      journalContents: ["Governance voting architecture modularization"],
      messageSuggestions: ["modularization", "maintainability", "governance"],
    });

    const briefing = service.buildBriefing({
      name: "Sam — System Architect",
      role: "system_architect",
      identity,
    });

    expect(briefing.summary).toContain("Sam");
    expect(briefing.summary).toContain("Strong in");
    expect(briefing.strongIn.length).toBeGreaterThan(0);
  });

  it("identifies critical thinker trait from oppose-heavy stances", () => {
    const identityA = service.deriveIdentity({
      ...baseParams,
      role: "product_manager",
      messageStances: ["OPPOSE", "OPPOSE", "OPPOSE", "OPPOSE"],
      proposalCount: 2,
    });
    expect(identityA.behavioralTraits).toContain("Critical thinker");
  });
});
