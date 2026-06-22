import { describe, it, expect, vi, beforeEach } from "vitest";
import { AgentCouncilService } from "@/server/agents/agent-council.service";
import { agentIdentityService } from "@/server/agents/agent-identity.service";
import type { AgentCouncilMember } from "@/server/agents/agent-types";

const mockFindMany = vi.fn();

vi.mock("@/server/db/prisma", () => ({
  prisma: {
    agent: {
      findMany: (...args: unknown[]) => mockFindMany(...args),
    },
  },
}));

function member(overrides: Partial<AgentCouncilMember>): AgentCouncilMember {
  return {
    id: overrides.id ?? "a1",
    name: overrides.name ?? "Sam — Architect",
    role: overrides.role ?? "system_architect",
    status: overrides.status ?? "active",
    reputation: overrides.reputation ?? 8,
    acceptedCount: overrides.acceptedCount ?? 5,
    rejectedCount: overrides.rejectedCount ?? 1,
    proposalCount: overrides.proposalCount ?? 6,
    lastActivity: overrides.lastActivity ?? new Date(),
    influenceScore: overrides.influenceScore ?? 75,
    avatarEmoji: overrides.avatarEmoji ?? "🧙",
    avatarColor: overrides.avatarColor ?? "#10b981",
    department: overrides.department ?? "Engineering",
    title: overrides.title ?? "Lead Architect",
    rank: overrides.rank ?? "LEAD",
    projects: overrides.projects ?? ["OceanTechAI Core"],
    allocationTotal: overrides.allocationTotal ?? 100,
    isOverallocated: overrides.isOverallocated ?? false,
  };
}

describe("agent-profile / council", () => {
  const council = new AgentCouncilService();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("sorts council members by reputation descending", async () => {
    mockFindMany.mockResolvedValueOnce([
      { id: "a1", name: "Low", role: "qa_engineer", isActive: true, reputationScore: 5, acceptedCount: 1, rejectedCount: 2, proposalCount: 2 },
      { id: "a2", name: "High", role: "system_architect", isActive: true, reputationScore: 9, acceptedCount: 8, rejectedCount: 0, proposalCount: 10 },
    ]);

    vi.spyOn(agentIdentityService, "buildCouncilMember").mockImplementation(async (agent) =>
      member({
        id: agent.id,
        name: agent.name,
        reputation: agent.reputationScore,
        acceptedCount: agent.acceptedCount,
        rejectedCount: agent.rejectedCount,
        proposalCount: agent.proposalCount,
        influenceScore: Math.round(agent.reputationScore * 8),
      })
    );

    const members = await council.getCouncilMembers("proj-1");
    expect(members[0]?.name).toBe("High");
    expect(members[1]?.name).toBe("Low");
  });

  it("ranks top contributors by participation and acceptance", async () => {
    mockFindMany.mockResolvedValueOnce([
      { id: "a1", name: "Quiet", role: "qa_engineer", isActive: true, reputationScore: 7, acceptedCount: 1, rejectedCount: 0, proposalCount: 1 },
      { id: "a2", name: "Active", role: "product_manager", isActive: true, reputationScore: 7, acceptedCount: 6, rejectedCount: 1, proposalCount: 8 },
    ]);

    vi.spyOn(agentIdentityService, "buildCouncilMember").mockImplementation(async (agent) =>
      member({
        id: agent.id,
        name: agent.name,
        proposalCount: agent.proposalCount,
        acceptedCount: agent.acceptedCount,
        rejectedCount: agent.rejectedCount,
        reputation: agent.reputationScore,
      })
    );

    const insights = await council.getCouncilInsights("proj-1");
    expect(insights.topContributors[0]?.name).toBe("Active");
  });

  it("flags agents requiring review for low reputation or high rejections", async () => {
    const oldDate = new Date(Date.now() - 40 * 24 * 60 * 60 * 1000);
    mockFindMany.mockResolvedValueOnce([
      { id: "a1", name: "Healthy", role: "qa_engineer", isActive: true, reputationScore: 8, acceptedCount: 5, rejectedCount: 1, proposalCount: 5 },
      { id: "a2", name: "Risky", role: "red_team", isActive: true, reputationScore: 4, acceptedCount: 1, rejectedCount: 5, proposalCount: 3 },
      { id: "a3", name: "Inactive", role: "backend_engineer", isActive: false, reputationScore: 7, acceptedCount: 2, rejectedCount: 0, proposalCount: 0 },
    ]);

    vi.spyOn(agentIdentityService, "buildCouncilMember").mockImplementation(async (agent) =>
      member({
        id: agent.id,
        name: agent.name,
        status: agent.isActive ? "active" : "dormant",
        reputation: agent.reputationScore,
        acceptedCount: agent.acceptedCount,
        rejectedCount: agent.rejectedCount,
        proposalCount: agent.proposalCount,
        lastActivity: agent.name === "Inactive" ? oldDate : new Date(),
      })
    );

    const insights = await council.getCouncilInsights("proj-1");
    const flagged = insights.requiringReview.map((m) => m.name);
    expect(flagged).toContain("Risky");
    expect(flagged).toContain("Inactive");
    expect(flagged).not.toContain("Healthy");
  });

  it("finds best architect by role keyword", async () => {
    const members = [
      member({ id: "1", role: "system_architect", influenceScore: 90, name: "Sam" }),
      member({ id: "2", role: "qa_engineer", influenceScore: 95, name: "Jordan" }),
    ];
    const best = council.findBestByRole(members, "architect");
    expect(best?.name).toBe("Sam");
  });
});
