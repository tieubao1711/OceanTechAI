import { prisma } from "@/server/db/prisma";
import {
  DEBT_TRACK_PREFIX,
  DebtStatus,
  LEARNING_RECORD_PREFIX,
  MemoryState,
  type DebtTrackRecord,
  type IntegrityLearningRecord,
} from "../learning-types";
import { resolveCanonicalTopic } from "./topic-resolver";

export type TopicLifecycleStatus =
  | "OPEN"
  | "IMPLEMENTED"
  | "VERIFIED"
  | "REOPENED"
  | "UNKNOWN";

export type TopicLifecycleSource =
  | "debt_track"
  | "improvement_cycle"
  | "memory"
  | "adr"
  | "none";

export type TopicLifecycle = {
  topicKey: string;
  canonicalTitle: string;
  status: TopicLifecycleStatus;
  source: TopicLifecycleSource;
  evidence: string[];
};

const STATUS_PRIORITY: Record<TopicLifecycleStatus, number> = {
  REOPENED: 5,
  VERIFIED: 4,
  IMPLEMENTED: 3,
  OPEN: 2,
  UNKNOWN: 1,
};

function debtStatusToLifecycle(status: DebtStatus): TopicLifecycleStatus {
  switch (status) {
    case DebtStatus.REOPENED:
      return "REOPENED";
    case DebtStatus.VERIFIED:
      return "VERIFIED";
    case DebtStatus.IMPLEMENTED:
      return "IMPLEMENTED";
    case DebtStatus.OPEN:
      return "OPEN";
    case DebtStatus.FAILED:
      return "UNKNOWN";
    default:
      return "UNKNOWN";
  }
}

function cycleStatusToLifecycle(status: string): TopicLifecycleStatus {
  switch (status) {
    case "VERIFIED":
      return "VERIFIED";
    case "IMPLEMENTED":
      return "IMPLEMENTED";
    case "OPEN":
      return "OPEN";
    case "FAILED":
      return "UNKNOWN";
    default:
      return "UNKNOWN";
  }
}

function mergeLifecycle(
  map: Map<string, TopicLifecycle>,
  text: string,
  status: TopicLifecycleStatus,
  source: TopicLifecycleSource,
  evidence: string
) {
  const canonical = resolveCanonicalTopic(text);
  const existing = map.get(canonical.topicKey);

  if (!existing || STATUS_PRIORITY[status] > STATUS_PRIORITY[existing.status]) {
    map.set(canonical.topicKey, {
      topicKey: canonical.topicKey,
      canonicalTitle: canonical.canonicalTitle,
      status,
      source,
      evidence: existing ? [...existing.evidence, evidence] : [evidence],
    });
    return;
  }

  if (existing && !existing.evidence.includes(evidence)) {
    existing.evidence.push(evidence);
  }
}

export class TopicLifecycleService {
  async loadLifecycleMap(projectId: string): Promise<Map<string, TopicLifecycle>> {
    const map = new Map<string, TopicLifecycle>();

    const [debtEntries, cycles, memoryEntries, adrs] = await Promise.all([
      prisma.memoryEntry.findMany({
        where: { projectId, scope: "PROJECT", key: { startsWith: DEBT_TRACK_PREFIX } },
        select: { value: true },
      }),
      prisma.improvementCycle.findMany({ where: { projectId } }),
      prisma.memoryEntry.findMany({
        where: { projectId, scope: "PROJECT", key: { startsWith: LEARNING_RECORD_PREFIX } },
        select: { value: true },
      }),
      prisma.adr.findMany({
        where: { projectId, status: "ACCEPTED" },
        select: { title: true, summary: true },
      }),
    ]);

    for (const entry of debtEntries) {
      try {
        const track = JSON.parse(entry.value) as DebtTrackRecord;
        mergeLifecycle(
          map,
          track.title,
          debtStatusToLifecycle(track.status),
          "debt_track",
          `debt:${track.title}:${track.status}`
        );
      } catch {
        // skip
      }
    }

    for (const cycle of cycles) {
      mergeLifecycle(
        map,
        cycle.title,
        cycleStatusToLifecycle(cycle.status),
        "improvement_cycle",
        `cycle:${cycle.id}:${cycle.status}`
      );
    }

    for (const entry of memoryEntries) {
      try {
        const record = JSON.parse(entry.value) as IntegrityLearningRecord;
        const status: TopicLifecycleStatus =
          record.state === MemoryState.VERIFIED
            ? "VERIFIED"
            : record.state === MemoryState.ACTIVE
              ? "OPEN"
              : "UNKNOWN";
        mergeLifecycle(
          map,
          record.title,
          status,
          "memory",
          `memory:${record.title}:${record.state}`
        );
      } catch {
        // skip
      }
    }

    for (const adr of adrs) {
      mergeLifecycle(map, adr.title, "VERIFIED", "adr", `adr:${adr.title}`);
      if (adr.summary) {
        mergeLifecycle(map, adr.summary, "VERIFIED", "adr", `adr-summary:${adr.title}`);
      }
    }

    return map;
  }

  async resolve(projectId: string, text: string): Promise<TopicLifecycle> {
    const map = await this.loadLifecycleMap(projectId);
    const canonical = resolveCanonicalTopic(text);
    const existing = map.get(canonical.topicKey);

    if (existing) return existing;

    return {
      topicKey: canonical.topicKey,
      canonicalTitle: canonical.canonicalTitle,
      status: "UNKNOWN",
      source: "none",
      evidence: [],
    };
  }

  async shouldSkipClosedTopic(projectId: string, text: string): Promise<boolean> {
    const lifecycle = await this.resolve(projectId, text);
    return lifecycle.status === "VERIFIED" || lifecycle.status === "IMPLEMENTED";
  }

  async shouldIncludeAsRepeatedMistake(projectId: string, text: string): Promise<boolean> {
    const lifecycle = await this.resolve(projectId, text);
    return lifecycle.status === "OPEN" || lifecycle.status === "REOPENED";
  }

  async shouldExcludeFromActiveLearnings(projectId: string, text: string): Promise<boolean> {
    const lifecycle = await this.resolve(projectId, text);
    return (
      lifecycle.status === "VERIFIED" ||
      lifecycle.status === "IMPLEMENTED" ||
      lifecycle.status === "REOPENED"
    );
  }

  isVerifiedOrImplemented(status: TopicLifecycleStatus): boolean {
    return status === "VERIFIED" || status === "IMPLEMENTED";
  }
}

export const topicLifecycleService = new TopicLifecycleService();
