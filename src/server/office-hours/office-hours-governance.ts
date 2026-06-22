import type { Agent } from "@prisma/client";
import { GovernanceError } from "@/server/errors/governance-error";

export function assertAgentCanChat(agent: Agent): void {
  if (agent.workforceStatus === "RETIRED") {
    throw new GovernanceError(
      "RETIRED_AGENT_CANNOT_CHAT",
      `Agent "${agent.name}" is retired and cannot participate in Office Hours.`
    );
  }
  if (agent.workforceStatus === "SUSPENDED") {
    throw new GovernanceError(
      "SUSPENDED_AGENT_CANNOT_CHAT",
      `Agent "${agent.name}" is suspended and cannot participate in Office Hours.`
    );
  }
  if (!agent.isActive) {
    throw new GovernanceError(
      "INACTIVE_AGENT_CANNOT_CHAT",
      `Agent "${agent.name}" is inactive and cannot participate in Office Hours.`
    );
  }
}

export const OFFICE_HOURS_ADVISORY_NOTICE =
  "Office Hours is advisory only. You cannot approve proposals, execute changes, or modify files. For official decisions, recommend creating a formal Discussion.";
