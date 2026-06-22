import type { Agent } from "@prisma/client";

export type AgentRole =
  | "product_manager"
  | "system_architect"
  | "backend_engineer"
  | "frontend_engineer"
  | "qa_engineer"
  | "game_designer"
  | "economy_designer"
  | "devops_engineer"
  | "red_team";

export function toAgentProfile(agent: Agent) {
  return {
    id: agent.id,
    name: agent.name,
    role: agent.role as AgentRole,
    expertise: agent.expertise,
    systemPrompt: agent.systemPrompt,
    modelProvider: agent.modelProvider,
    modelName: agent.modelName,
    memorySummary: agent.memorySummary,
    toolsAllowed: agent.toolsAllowed,
    votingWeight: agent.votingWeight,
    isActive: agent.isActive,
  };
}

export function formatRoleLabel(role: string): string {
  return role
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}
