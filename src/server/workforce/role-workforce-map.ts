import type { AgentRank, Department } from "@prisma/client";
import type { AgentRole } from "@/server/agents/agent-profile";

export type WorkforceDefaults = {
  department: Department;
  title: string;
  rank: AgentRank;
};

const ROLE_WORKFORCE: Record<string, WorkforceDefaults> = {
  product_manager: { department: "PRODUCT", title: "Director of Product", rank: "DIRECTOR" },
  system_architect: { department: "ENGINEERING", title: "Lead Architect", rank: "LEAD" },
  backend_engineer: { department: "ENGINEERING", title: "Senior Backend Engineer", rank: "SENIOR" },
  frontend_engineer: { department: "ENGINEERING", title: "Senior Frontend Engineer", rank: "SENIOR" },
  qa_engineer: { department: "QA", title: "Lead QA Engineer", rank: "LEAD" },
  red_team: { department: "SECURITY", title: "Security Director", rank: "DIRECTOR" },
  economy_designer: { department: "RESEARCH", title: "Economy Designer", rank: "SENIOR" },
  game_designer: { department: "PRODUCT", title: "Game Designer", rank: "SENIOR" },
  devops_engineer: { department: "OPERATIONS", title: "Senior DevOps Engineer", rank: "SENIOR" },
};

export function workforceDefaultsForRole(role: string): WorkforceDefaults {
  return (
    ROLE_WORKFORCE[role] ?? {
      department: "ENGINEERING",
      title: "AI Specialist",
      rank: "SENIOR",
    }
  );
}

export function roleToDepartment(role: AgentRole | string): Department {
  return workforceDefaultsForRole(role).department;
}

export function nextRank(current: AgentRank): AgentRank | null {
  const order: AgentRank[] = ["INTERN", "JUNIOR", "SENIOR", "LEAD", "DIRECTOR"];
  const idx = order.indexOf(current);
  return idx < order.length - 1 ? order[idx + 1]! : null;
}

export function prevRank(current: AgentRank): AgentRank | null {
  const order: AgentRank[] = ["INTERN", "JUNIOR", "SENIOR", "LEAD", "DIRECTOR"];
  const idx = order.indexOf(current);
  return idx > 0 ? order[idx - 1]! : null;
}
