import type { AvatarType } from "@prisma/client";
import type { DefaultAgentConfig } from "@/server/agents/default-agents";
import { generateAvatarSeed } from "./agent-avatar.service";
import { workforceDefaultsForRole } from "./role-workforce-map";

const AVATAR_BY_ROLE: Record<string, AvatarType> = {
  system_architect: "FANTASY",
  red_team: "CYBERPUNK",
  game_designer: "PIXEL",
  economy_designer: "PIXEL",
};

export function workforceFieldsForAgent(agent: DefaultAgentConfig) {
  const defaults = workforceDefaultsForRole(agent.role);
  return {
    department: defaults.department,
    title: defaults.title,
    rank: defaults.rank,
    avatarType: AVATAR_BY_ROLE[agent.role] ?? "CORPORATE",
    avatarSeed: generateAvatarSeed(agent.name, agent.role),
    workforceStatus: agent.isActive ? ("ACTIVE" as const) : ("ACTIVE" as const),
  };
}
