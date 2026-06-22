import { topicLifecycleService } from "./topic-lifecycle.service";
import { resolveCanonicalTopic } from "./topic-resolver";

export type VerifiedTopicEntry = {
  topicKey: string;
  title: string;
  source: "debt" | "cycle" | "memory" | "adr";
  status: string;
};

export type VerifiedTopicSnapshot = {
  entries: VerifiedTopicEntry[];
};

export async function loadVerifiedTopics(projectId: string): Promise<VerifiedTopicSnapshot> {
  const lifecycleMap = await topicLifecycleService.loadLifecycleMap(projectId);
  const entries: VerifiedTopicEntry[] = [];

  for (const lifecycle of lifecycleMap.values()) {
    if (lifecycle.status !== "VERIFIED") continue;

    const source =
      lifecycle.source === "debt_track"
        ? "debt"
        : lifecycle.source === "improvement_cycle"
          ? "cycle"
          : lifecycle.source === "adr"
            ? "adr"
            : "memory";

    entries.push({
      topicKey: lifecycle.topicKey,
      title: lifecycle.canonicalTitle,
      source,
      status: lifecycle.status,
    });
  }

  return { entries: dedupeByTopicKey(entries) };
}

function dedupeByTopicKey(entries: VerifiedTopicEntry[]): VerifiedTopicEntry[] {
  const seen = new Set<string>();
  const result: VerifiedTopicEntry[] = [];
  for (const entry of entries) {
    if (seen.has(entry.topicKey)) continue;
    seen.add(entry.topicKey);
    result.push(entry);
  }
  return result;
}

export function matchesVerifiedTopic(
  text: string,
  snapshot: VerifiedTopicSnapshot
): VerifiedTopicEntry | null {
  const canonical = resolveCanonicalTopic(text);
  return snapshot.entries.find((e) => e.topicKey === canonical.topicKey) ?? null;
}

export function isTopicVerified(text: string, snapshot: VerifiedTopicSnapshot): boolean {
  return matchesVerifiedTopic(text, snapshot) !== null;
}
