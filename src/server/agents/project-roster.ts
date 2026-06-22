import { DOGFOOD_PROJECT_ID, SEED_PROJECT_ID } from "@/lib/dogfood-ids";
import {
  CORE_PLATFORM_AGENTS,
  MMO_GAME_AGENTS,
  GENERIC_TEMPLATE_AGENTS,
  type RosterAgentConfig,
} from "./default-agents";

export type { RosterAgentConfig };

export function resolveProjectRoster(
  projectId: string,
  projectName?: string | null
): RosterAgentConfig[] {
  const nameBlob = (projectName ?? "").toLowerCase();

  if (projectId === DOGFOOD_PROJECT_ID || nameBlob.includes("oceantechai core") || nameBlob.includes("core")) {
    return CORE_PLATFORM_AGENTS;
  }

  if (
    projectId === SEED_PROJECT_ID ||
    nameBlob.includes("mmo") ||
    nameBlob.includes("game")
  ) {
    return MMO_GAME_AGENTS;
  }

  const short = (projectName ?? "Dự án").split(/\s+/).slice(0, 2).join(" ");
  return GENERIC_TEMPLATE_AGENTS.map((agent) => ({
    ...agent,
    name: disambiguateAgentName(agent.name, short),
  }));
}

export function disambiguateAgentName(name: string, projectLabel: string): string {
  if (name.includes(" · ")) return name;
  return `${name} · ${projectLabel}`;
}

export function agentShortName(fullName: string): string {
  return fullName.split("—")[0]?.trim() ?? fullName.split("·")[0]?.trim() ?? fullName;
}

export function formatAgentDisplayLabel(params: {
  name: string;
  homeProjectName?: string | null;
  showProject?: boolean;
}): string {
  const short = agentShortName(params.name);
  if (!params.showProject || !params.homeProjectName) return params.name;
  if (params.name.includes(params.homeProjectName)) return params.name;
  return `${short} (${params.homeProjectName})`;
}
