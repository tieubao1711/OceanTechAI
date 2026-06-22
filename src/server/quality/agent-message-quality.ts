import type { RoundType } from "@prisma/client";
import type { AgentMessageContractType } from "@/server/contracts/agent-message.contract";

const MIN_CONTENT_LENGTH = 40;

function hasMeaningfulItems(items: string[]): boolean {
  return items.some((s) => s.trim().length >= 8);
}

export function scoreAgentMessage(params: {
  message: AgentMessageContractType;
  roundType: RoundType;
  agentRole: string;
}): number {
  const { message, roundType, agentRole } = params;
  let score = 0;

  if (message.content.trim().length >= MIN_CONTENT_LENGTH) score += 25;
  else if (message.content.trim().length >= 15) score += 10;

  if (hasMeaningfulItems(message.concerns)) score += 15;
  if (hasMeaningfulItems(message.suggestions)) score += 15;

  switch (roundType) {
    case "PROPOSE":
      if (["support", "oppose", "neutral"].includes(message.stance)) score += 15;
      break;
    case "CRITIQUE":
      if (message.stance === "oppose" || message.content.toLowerCase().includes("critique")) {
        score += 20;
      } else if (message.stance === "neutral") score += 10;
      break;
    case "REFINE":
      if (message.stance === "refine") score += 20;
      else score += 8;
      break;
    case "VOTE":
      if (message.vote) score += 15;
      if (message.vote && message.content.trim().length >= 20) score += 15;
      break;
    default:
      score += 5;
  }

  if (agentRole === "red_team" && hasMeaningfulItems(message.concerns)) {
    score += 15;
  }

  return Math.min(100, score);
}

export const QUALITY_GATE_THRESHOLD = 60;

export function buildQualityRetryPrompt(score: number, issues: string[]): string {
  return [
    `Your previous answer failed the quality gate (score: ${score}/100).`,
    "Issues:",
    ...issues.map((i) => `- ${i}`),
    "Respond again with ONLY valid JSON. Be more specific, substantive, and role-appropriate.",
  ].join("\n");
}

export function getQualityIssues(params: {
  message: AgentMessageContractType;
  roundType: RoundType;
  agentRole: string;
}): string[] {
  const issues: string[] = [];
  const { message, roundType, agentRole } = params;

  if (message.content.trim().length < MIN_CONTENT_LENGTH) {
    issues.push("Content too short — provide more detail.");
  }
  if (!hasMeaningfulItems(message.concerns)) {
    issues.push("Include meaningful concerns.");
  }
  if (!hasMeaningfulItems(message.suggestions) && roundType !== "VOTE") {
    issues.push("Include actionable suggestions.");
  }
  if (roundType === "CRITIQUE" && message.stance === "support") {
    issues.push("Round 2 should critique, not blindly support.");
  }
  if (roundType === "REFINE" && message.stance !== "refine") {
    issues.push("Round 3 stance should be refine.");
  }
  if (roundType === "VOTE" && !message.vote) {
    issues.push("Round 4 requires a vote.");
  }
  if (agentRole === "red_team" && !hasMeaningfulItems(message.concerns)) {
    issues.push("Red Team must raise security/abuse concerns.");
  }

  return issues;
}
