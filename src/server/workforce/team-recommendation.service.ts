import type { ProjectTeamMemberView, TeamHealthReport } from "./workforce-types";

export type RoleRequirement = {
  key: string;
  label: string;
  matchRoles: string[];
  matchDepartments?: string[];
  required: boolean;
};

const CORE_REQUIREMENTS: RoleRequirement[] = [
  { key: "architect", label: "Architect", matchRoles: ["system_architect"], required: true },
  { key: "backend", label: "Backend Engineer", matchRoles: ["backend_engineer"], required: true },
  { key: "qa", label: "QA", matchRoles: ["qa_engineer"], matchDepartments: ["QA"], required: true },
  { key: "security", label: "Security Reviewer", matchRoles: ["red_team"], matchDepartments: ["SECURITY"], required: true },
  { key: "frontend", label: "Frontend Engineer", matchRoles: ["frontend_engineer"], required: false },
  { key: "product", label: "Product", matchRoles: ["product_manager"], matchDepartments: ["PRODUCT"], required: false },
];

const MMO_REQUIREMENTS: RoleRequirement[] = [
  { key: "product", label: "Product / Game Designer", matchRoles: ["product_manager", "game_designer"], required: true },
  { key: "architect", label: "Architect", matchRoles: ["system_architect"], required: true },
  { key: "backend", label: "Backend Engineer", matchRoles: ["backend_engineer"], required: true },
  { key: "qa", label: "QA", matchRoles: ["qa_engineer"], required: true },
  { key: "economy", label: "Economy Designer", matchRoles: ["economy_designer"], required: true },
  { key: "security", label: "Security Reviewer", matchRoles: ["red_team"], required: false },
];

export class TeamRecommendationService {
  resolveRequirements(projectName: string, projectDescription?: string | null): RoleRequirement[] {
    const blob = `${projectName} ${projectDescription ?? ""}`.toLowerCase();
    if (blob.includes("mmo") || blob.includes("game")) return MMO_REQUIREMENTS;
    if (blob.includes("core") || blob.includes("oceantechai")) return CORE_REQUIREMENTS;
    return CORE_REQUIREMENTS;
  }

  analyzeTeam(params: {
    projectName: string;
    projectDescription?: string | null;
    members: ProjectTeamMemberView[];
  }): TeamHealthReport {
    const requirements = this.resolveRequirements(params.projectName, params.projectDescription);
    const missingRoles: string[] = [];
    const unnecessaryRoles: string[] = [];
    const suggestedAgents: string[] = [];
    const messages: string[] = [];

    for (const req of requirements) {
      const hasRole = params.members.some((m) => {
        const roleKey = req.key;
        if (roleKey === "architect") return m.title.toLowerCase().includes("architect") || m.projectRole.includes("architect");
        if (roleKey === "backend") return m.projectRole.includes("backend") || m.title.toLowerCase().includes("backend");
        if (roleKey === "qa") return m.department === "QA" || m.projectRole.toLowerCase().includes("qa");
        if (roleKey === "security") return m.department === "SECURITY" || m.projectRole.includes("security") || m.projectRole.includes("red_team");
        if (roleKey === "product") return m.department === "PRODUCT" || m.projectRole.includes("product") || m.projectRole.includes("game");
        if (roleKey === "economy") return m.projectRole.includes("economy") || m.title.toLowerCase().includes("economy");
        if (roleKey === "frontend") return m.projectRole.includes("frontend");
        return false;
      });

      if (req.required && !hasRole) {
        missingRoles.push(req.label);
        suggestedAgents.push(`Add a ${req.label}`);
        messages.push(`Missing ${req.label}`);
      }
    }

    const hasLead = params.members.some((m) => m.isLead);
    if (!hasLead) {
      messages.push("No project lead assigned");
    }

    const overallocated = params.members.filter((m) => m.isOverallocated);
    for (const m of overallocated) {
      messages.push(`${m.agentName} is overallocated (>100% total)`);
    }

    if (params.members.length > 12) {
      unnecessaryRoles.push("Team may be too large");
      messages.push("Team size is large — consider trimming");
    } else if (params.members.length > 0) {
      messages.push("Team size OK");
    }

    let status: TeamHealthReport["status"] = "healthy";
    if (missingRoles.length > 0 || !hasLead) status = "warning";
    if (missingRoles.length >= 2 || overallocated.length > 1) status = "critical";

    return {
      status,
      messages,
      missingRoles,
      unnecessaryRoles,
      suggestedAgents,
    };
  }
}

export const teamRecommendationService = new TeamRecommendationService();
