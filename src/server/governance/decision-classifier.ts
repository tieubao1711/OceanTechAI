import type { VoteClassification } from "@/types/consensus";

export type DecisionClass = "D1_STRATEGIC" | "D2_TACTICAL" | "D3_OPERATIONAL" | "D4_META";

export function classifyDecision(userPrompt: string): DecisionClass {
  const prompt = userPrompt.toLowerCase();

  if (
    prompt.includes("governance") ||
    prompt.includes("charter") ||
    prompt.includes("agent config")
  ) {
    return "D4_META";
  }

  if (
    prompt.includes("fix") ||
    prompt.includes("bug") ||
    prompt.includes("patch")
  ) {
    return "D3_OPERATIONAL";
  }

  if (
    prompt.includes("approach") ||
    prompt.includes("vs") ||
    prompt.includes("scope")
  ) {
    return "D2_TACTICAL";
  }

  return "D1_STRATEGIC";
}

export function classifyVote(params: {
  approvalRatio: number;
  rejectionRatio: number;
  redTeamVotedNo: boolean;
}): VoteClassification {
  const { approvalRatio, rejectionRatio, redTeamVotedNo } = params;

  if (rejectionRatio >= 0.5) return "rejected";
  if (redTeamVotedNo && approvalRatio < 0.7) return "security_concern";
  if (approvalRatio >= 0.6 && rejectionRatio < 0.3) return "strong";
  if (approvalRatio >= 0.5 && rejectionRatio < 0.4) return "weak";
  return "split";
}

export function getDecisionClassLabel(decisionClass: DecisionClass): string {
  const labels: Record<DecisionClass, string> = {
    D1_STRATEGIC: "Strategic",
    D2_TACTICAL: "Tactical",
    D3_OPERATIONAL: "Operational",
    D4_META: "Meta (Founder only)",
  };
  return labels[decisionClass];
}
