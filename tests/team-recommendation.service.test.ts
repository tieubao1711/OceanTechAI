import { describe, it, expect } from "vitest";
import { TeamRecommendationService } from "@/server/workforce/team-recommendation.service";
import type { ProjectTeamMemberView } from "@/server/workforce/workforce-types";

function member(overrides: Partial<ProjectTeamMemberView> = {}): ProjectTeamMemberView {
  return {
    assignmentId: "as1",
    agentId: "a1",
    homeProjectId: "p1",
    agentName: "Sam",
    title: "Lead Architect",
    department: "ENGINEERING",
    departmentLabel: "Engineering",
    projectRole: "system_architect",
    allocationPercent: 100,
    isLead: true,
    status: "active",
    reputation: 4.5,
    influenceScore: 80,
    avatarEmoji: "🧙",
    avatarColor: "#4ade80",
    isOverallocated: false,
    ...overrides,
  };
}

describe("team-recommendation.service", () => {
  const service = new TeamRecommendationService();

  it("uses Core requirements for OceanTechAI Core project", () => {
    const reqs = service.resolveRequirements("OceanTechAI Core", "Platform OS");
    expect(reqs.some((r) => r.key === "architect" && r.required)).toBe(true);
    expect(reqs.some((r) => r.key === "economy")).toBe(false);
  });

  it("uses MMO requirements for game projects", () => {
    const reqs = service.resolveRequirements("MMO Game Project");
    expect(reqs.some((r) => r.key === "economy" && r.required)).toBe(true);
  });

  it("flags missing QA and security for incomplete Core team", () => {
    const report = service.analyzeTeam({
      projectName: "OceanTechAI Core",
      members: [
        member({ projectRole: "system_architect", title: "Lead Architect", isLead: true }),
        member({
          agentId: "a2",
          assignmentId: "as2",
          agentName: "Alex",
          title: "Backend Engineer",
          projectRole: "backend_engineer",
          isLead: false,
        }),
      ],
    });

    expect(report.missingRoles).toContain("QA");
    expect(report.missingRoles).toContain("Security Reviewer");
    expect(report.messages.some((m) => m.includes("Missing QA"))).toBe(true);
    expect(["warning", "critical"]).toContain(report.status);
  });

  it("reports team size OK when roles are covered", () => {
    const report = service.analyzeTeam({
      projectName: "OceanTechAI Core",
      members: [
        member({ projectRole: "system_architect", title: "Architect", isLead: true }),
        member({
          agentId: "a2",
          assignmentId: "as2",
          agentName: "Alex",
          title: "Backend Engineer",
          projectRole: "backend_engineer",
        }),
        member({
          agentId: "a3",
          assignmentId: "as3",
          agentName: "Quinn",
          title: "QA Engineer",
          department: "QA",
          projectRole: "qa_engineer",
        }),
        member({
          agentId: "a4",
          assignmentId: "as4",
          agentName: "Rex",
          title: "Red Team",
          department: "SECURITY",
          projectRole: "red_team",
        }),
      ],
    });

    expect(report.missingRoles).toHaveLength(0);
    expect(report.messages).toContain("Team size OK");
    expect(report.status).toBe("healthy");
  });

  it("warns when agents are overallocated", () => {
    const report = service.analyzeTeam({
      projectName: "OceanTechAI Core",
      members: [
        member({
          isOverallocated: true,
          agentName: "Sam",
        }),
      ],
    });

    expect(report.messages.some((m) => m.includes("overallocated"))).toBe(true);
  });
});
