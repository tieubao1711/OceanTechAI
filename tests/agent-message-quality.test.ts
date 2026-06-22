import { describe, it, expect } from "vitest";
import {
  scoreAgentMessage,
  QUALITY_GATE_THRESHOLD,
} from "@/server/quality/agent-message-quality";

describe("agent-message-quality", () => {
  it("scores high-quality critique message", () => {
    const score = scoreAgentMessage({
      message: {
        agentId: "a1",
        round: 2,
        stance: "oppose",
        content:
          "The proposed architecture lacks rate limiting and abuse detection for social features.",
        concerns: ["CRITICAL: No rate limiting", "HIGH: Chat harassment vector"],
        suggestions: ["Add rate limit middleware", "Profanity filter on chat"],
      },
      roundType: "CRITIQUE",
      agentRole: "red_team",
    });
    expect(score).toBeGreaterThanOrEqual(QUALITY_GATE_THRESHOLD);
  });

  it("scores low for empty weak message", () => {
    const score = scoreAgentMessage({
      message: {
        agentId: "a1",
        round: 2,
        stance: "support",
        content: "ok",
        concerns: [],
        suggestions: [],
      },
      roundType: "CRITIQUE",
      agentRole: "product_manager",
    });
    expect(score).toBeLessThan(QUALITY_GATE_THRESHOLD);
  });
});
