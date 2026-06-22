import type { AgentMessageContractType } from "./agent-message.contract";

const STANCES = new Set(["support", "oppose", "neutral", "refine"]);
const VOTES = new Set(["yes", "no", "abstain"]);

export function normalizeStringArray(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return raw.map(String).map((s) => s.trim()).filter(Boolean);
  }
  if (typeof raw === "string" && raw.trim()) {
    return [raw.trim()];
  }
  return [];
}

export function normalizeStance(raw: unknown): AgentMessageContractType["stance"] {
  const value = String(raw ?? "neutral").toLowerCase().trim();
  if (STANCES.has(value)) {
    return value as AgentMessageContractType["stance"];
  }
  if (value === "agree" || value === "positive" || value === "pro") return "support";
  if (value === "disagree" || value === "against" || value === "con") return "oppose";
  return "neutral";
}

export function normalizeVote(raw: unknown): "yes" | "no" | "abstain" | undefined {
  if (raw == null || raw === "") return undefined;
  const value = String(raw).toLowerCase().trim();
  if (VOTES.has(value)) {
    return value as "yes" | "no" | "abstain";
  }
  if (value === "y" || value === "approve" || value === "approved") return "yes";
  if (value === "n" || value === "reject" || value === "rejected") return "no";
  return undefined;
}

export function buildNormalizedAgentMessagePayload(
  parsed: Record<string, unknown>,
  agentId: string,
  roundNumber: number
): AgentMessageContractType {
  const content = String(parsed.content ?? "").trim();
  return {
    agentId,
    round: roundNumber,
    stance: normalizeStance(parsed.stance),
    content: content || "See concerns and suggestions below.",
    concerns: normalizeStringArray(parsed.concerns),
    suggestions: normalizeStringArray(parsed.suggestions),
    vote: normalizeVote(parsed.vote),
  };
}
