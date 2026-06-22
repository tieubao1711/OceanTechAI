import { describe, it, expect } from "vitest";
import {
  buildNormalizedAgentMessagePayload,
  normalizeStance,
  normalizeVote,
} from "@/server/contracts/agent-message-normalizer";
import { parseAgentMessage } from "@/server/contracts/agent-message.contract";

describe("agent-message-normalizer", () => {
  it("lowercases stance from OpenAI-style responses", () => {
    expect(normalizeStance("Support")).toBe("support");
    expect(normalizeStance("OPPOSE")).toBe("oppose");
    expect(normalizeStance("Neutral")).toBe("neutral");
  });

  it("normalizes vote casing", () => {
    expect(normalizeVote("YES")).toBe("yes");
    expect(normalizeVote("No")).toBe("no");
    expect(normalizeVote("Abstain")).toBe("abstain");
  });

  it("passes contract after normalizing GPT-like payload", () => {
    const payload = buildNormalizedAgentMessagePayload(
      {
        stance: "Neutral",
        content: "Frontend critique of architect proposal.",
        concerns: "Missing loading states",
        suggestions: ["Add debate progress UI"],
      },
      "agent-1",
      2
    );
    const parsed = parseAgentMessage(payload);
    expect(parsed.stance).toBe("neutral");
    expect(parsed.concerns).toEqual(["Missing loading states"]);
    expect(parsed.suggestions).toEqual(["Add debate progress UI"]);
  });
});
