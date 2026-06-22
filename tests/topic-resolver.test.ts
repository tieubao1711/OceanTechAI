import { describe, it, expect } from "vitest";
import {
  isSameCanonicalTopic,
  resolveCanonicalTopic,
} from "@/server/learning/integrity/topic-resolver";

describe("topic-resolver", () => {
  it("maps agent reputation phrases to agent_reputation_voting", () => {
    const phrases = [
      "Implement Agent Reputation",
      "Agent Reputation",
      "Reputation not used in voting",
      "Use reputation in voting",
    ];

    for (const phrase of phrases) {
      expect(resolveCanonicalTopic(phrase).topicKey).toBe("agent_reputation_voting");
    }

    expect(
      isSameCanonicalTopic("Implement Agent Reputation", "Reputation not used in voting")
    ).toBe(true);
  });

  it("maps execution retry phrases to execution_retry_gaps", () => {
    const phrases = [
      "Execution retry gaps",
      "Insufficient Error Handling in GitHub Execution",
      "GitHub execution retry",
      "Self-improvement cycle verified: Execution retry gaps",
    ];

    for (const phrase of phrases) {
      expect(resolveCanonicalTopic(phrase).topicKey).toBe("execution_retry_gaps");
    }
  });

  it("maps debate token phrases to debate_token_bloat", () => {
    const phrases = [
      "Debate token bloat",
      "Token usage too high in debate",
      "Debate compression",
    ];

    for (const phrase of phrases) {
      expect(resolveCanonicalTopic(phrase).topicKey).toBe("debate_token_bloat");
    }
  });

  it("falls back to slug topic key for unknown topics", () => {
    const result = resolveCanonicalTopic("Unique Widget Calibration");
    expect(result.topicKey).toBe("unique_widget_calibration");
  });
});
