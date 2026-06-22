import type { Agent, Discussion, DiscussionRound, DiscussionStatus } from "@prisma/client";
import { GovernanceError } from "@/server/errors/governance-error";

export function assertDiscussionCanRun(status: DiscussionStatus): void {
  if (status === "RUNNING") {
    throw new GovernanceError(
      "DISCUSSION_ALREADY_RUNNING",
      "Discussion is already running. Wait for completion before starting again."
    );
  }
  if (status === "COMPLETED") {
    throw new GovernanceError(
      "DISCUSSION_ALREADY_COMPLETED",
      "Discussion already completed. Create a new discussion to re-debate."
    );
  }
}

export function assertActiveAgentsForDebate(agents: Agent[]): void {
  if (agents.length === 0) {
    throw new GovernanceError(
      "NO_ACTIVE_AGENTS",
      "Debate requires at least one active agent."
    );
  }

  const inactive = agents.filter((a) => !a.isActive);
  if (inactive.length > 0) {
    throw new GovernanceError(
      "INACTIVE_AGENT_IN_DEBATE",
      `Cannot run debate with inactive agents: ${inactive.map((a) => a.name).join(", ")}`
    );
  }
}

export function assertVotingRoundBeforeConsensus(
  rounds: Pick<DiscussionRound, "roundNumber" | "roundType" | "status">[]
): void {
  const voteRound = rounds.find((r) => r.roundNumber === 4 && r.roundType === "VOTE");
  if (!voteRound) {
    throw new GovernanceError(
      "VOTING_ROUND_REQUIRED",
      "Cannot run consensus without a voting round (Round 4)."
    );
  }
  if (voteRound.status !== "COMPLETED") {
    throw new GovernanceError(
      "VOTING_ROUND_INCOMPLETE",
      "Voting round must be completed before consensus."
    );
  }
}

export function assertDiscussionHasConsensus(discussion: {
  consensusJson: unknown;
  status: Discussion["status"];
}): void {
  if (!discussion.consensusJson) {
    throw new GovernanceError(
      "CONSENSUS_REQUIRED",
      "Cannot create proposal without consensus on discussion."
    );
  }
  if (discussion.status !== "COMPLETED" && discussion.status !== "RUNNING") {
    throw new GovernanceError(
      "DISCUSSION_NOT_COMPLETED",
      "Discussion must be completed before creating proposal."
    );
  }
}

export function assertAgentCanVote(agent: Agent): void {
  if (!agent.isActive || agent.workforceStatus === "RETIRED" || agent.workforceStatus === "SUSPENDED") {
    throw new GovernanceError(
      "INACTIVE_AGENT_CANNOT_VOTE",
      `Agent "${agent.name}" cannot vote (inactive, suspended, or retired).`
    );
  }
}
