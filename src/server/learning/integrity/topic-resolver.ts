import { buildTopicKey, normalizeTopic } from "./memory-deduplication";

export type CanonicalTopic = {
  topicKey: string;
  canonicalTitle: string;
};

type TopicRule = {
  topicKey: string;
  canonicalTitle: string;
  match: (text: string) => boolean;
};

function containsAll(text: string, terms: string[]): boolean {
  return terms.every((t) => text.includes(t));
}

function containsAny(text: string, terms: string[]): boolean {
  return terms.some((t) => text.includes(t));
}

const CANONICAL_RULES: TopicRule[] = [
  {
    topicKey: "agent_reputation_voting",
    canonicalTitle: "Agent Reputation in Voting",
    match: (raw) => {
      const text = normalizeTopic(raw);
      if (text.includes("implement agent reputation")) return true;
      if (text.includes("agent reputation") && !text.includes("debate")) return true;
      if (containsAll(text, ["reputation", "voting"])) return true;
      if (text.includes("reputation not used")) return true;
      if (text.includes("use reputation in voting")) return true;
      if (text.includes("reputation") && text.includes("not used")) return true;
      return false;
    },
  },
  {
    topicKey: "execution_retry_gaps",
    canonicalTitle: "Execution Retry Gaps",
    match: (raw) => {
      const text = normalizeTopic(raw);
      if (text.includes("execution retry")) return true;
      if (text.includes("retry gap")) return true;
      if (containsAll(text, ["execution", "retry"])) return true;
      if (text.includes("github execution") && text.includes("retry")) return true;
      if (
        text.includes("insufficient error handling") &&
        containsAny(text, ["execution", "github"])
      ) {
        return true;
      }
      if (text.includes("self improvement cycle verified") && text.includes("execution")) {
        return true;
      }
      if (text.includes("debt resolved") && text.includes("execution")) return true;
      return false;
    },
  },
  {
    topicKey: "debate_token_bloat",
    canonicalTitle: "Debate Token Bloat",
    match: (raw) => {
      const text = normalizeTopic(raw);
      if (containsAll(text, ["debate", "token"])) return true;
      if (text.includes("debate token bloat")) return true;
      if (text.includes("token usage") && text.includes("debate")) return true;
      if (text.includes("debate compression")) return true;
      if (text.includes("token bloat")) return true;
      return false;
    },
  },
];

export function resolveCanonicalTopic(text: string): CanonicalTopic {
  for (const rule of CANONICAL_RULES) {
    if (rule.match(text)) {
      return { topicKey: rule.topicKey, canonicalTitle: rule.canonicalTitle };
    }
  }

  return {
    topicKey: buildTopicKey(text),
    canonicalTitle: text.trim(),
  };
}

export function isSameCanonicalTopic(a: string, b: string): boolean {
  return resolveCanonicalTopic(a).topicKey === resolveCanonicalTopic(b).topicKey;
}

export function getCanonicalRules(): ReadonlyArray<{ topicKey: string; canonicalTitle: string }> {
  return CANONICAL_RULES.map((r) => ({
    topicKey: r.topicKey,
    canonicalTitle: r.canonicalTitle,
  }));
}
