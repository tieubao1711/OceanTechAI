import type { LearningEventType } from "../learning-types";
import {
  DUPLICATE_MATCH_THRESHOLD,
  MemoryState,
  type IntegrityLearningRecord,
} from "../learning-types";

export function normalizeTopic(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function buildTopicKey(title: string, eventType?: LearningEventType): string {
  const base = normalizeTopic(title).replace(/\s+/g, "_").slice(0, 64);
  return eventType ? `${eventType.toLowerCase()}_${base}` : base;
}

export function topicSimilarity(a: string, b: string): number {
  const na = normalizeTopic(a);
  const nb = normalizeTopic(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1;
  if (na.includes(nb) || nb.includes(na)) return 0.85;

  const wordsA = new Set(na.split(" ").filter((w) => w.length > 3));
  const wordsB = new Set(nb.split(" ").filter((w) => w.length > 3));
  if (wordsA.size === 0 || wordsB.size === 0) return 0;

  let overlap = 0;
  for (const w of wordsA) {
    if (wordsB.has(w)) overlap++;
  }
  return overlap / Math.max(wordsA.size, wordsB.size);
}

export type MemoryMatchCandidate = {
  key: string;
  record: IntegrityLearningRecord;
};

export type MemoryMatchResult = {
  matched: boolean;
  score: number;
  candidate?: MemoryMatchCandidate;
};

export function scoreMemoryMatch(
  existing: IntegrityLearningRecord,
  incoming: {
    title: string;
    eventType: LearningEventType;
    topicKey: string;
    linkedProposalId?: string;
    linkedCycleId?: string;
    linkedDebtTitle?: string;
  }
): number {
  if (existing.eventType !== incoming.eventType) {
    if (
      existing.eventType === "SELF_IMPROVEMENT_COMPLETED" &&
      incoming.eventType === "SELF_IMPROVEMENT_COMPLETED"
    ) {
      // same type, continue
    } else if (existing.topicKey === incoming.topicKey) {
      return 0.8;
    } else {
      return 0;
    }
  }

  let score = topicSimilarity(existing.title, incoming.title);
  if (existing.topicKey === incoming.topicKey) score = Math.max(score, 0.95);

  if (
    incoming.linkedProposalId &&
    existing.linkedProposalId === incoming.linkedProposalId
  ) {
    score = Math.max(score, 0.9);
  }
  if (incoming.linkedCycleId && existing.linkedCycleId === incoming.linkedCycleId) {
    score = Math.max(score, 0.95);
  }
  if (
    incoming.linkedDebtTitle &&
    existing.linkedDebtTitle &&
    topicSimilarity(existing.linkedDebtTitle, incoming.linkedDebtTitle) >= 0.75
  ) {
    score = Math.max(score, 0.9);
  }

  return score;
}

export function findBestMemoryMatch(
  candidates: MemoryMatchCandidate[],
  incoming: {
    title: string;
    eventType: LearningEventType;
    topicKey: string;
    linkedProposalId?: string;
    linkedCycleId?: string;
    linkedDebtTitle?: string;
  },
  threshold = DUPLICATE_MATCH_THRESHOLD
): MemoryMatchResult {
  let best: MemoryMatchResult = { matched: false, score: 0 };

  for (const candidate of candidates) {
    const score = scoreMemoryMatch(candidate.record, incoming);
    if (score > best.score) {
      best = { matched: score >= threshold, score, candidate };
    }
  }

  return best;
}

export function mergeLearningRecords(
  existing: IntegrityLearningRecord,
  incoming: IntegrityLearningRecord,
  referenceId: string
): IntegrityLearningRecord {
  const references = [...existing.references];
  if (!references.includes(referenceId)) {
    references.push(referenceId);
  }

  const evidenceCount = existing.evidenceCount + 1;
  const state =
    incoming.state === MemoryState.VERIFIED || existing.state === MemoryState.VERIFIED
      ? MemoryState.VERIFIED
      : existing.state;

  return {
    ...existing,
    summary: incoming.summary.length > existing.summary.length ? incoming.summary : existing.summary,
    importance:
      incoming.importance === "high" || existing.importance === "high"
        ? "high"
        : incoming.importance === "medium" || existing.importance === "medium"
          ? "medium"
          : "low",
    state,
    evidenceCount,
    lastSeenAt: incoming.lastSeenAt,
    references,
    linkedProposalId: incoming.linkedProposalId ?? existing.linkedProposalId,
    linkedCycleId: incoming.linkedCycleId ?? existing.linkedCycleId,
    linkedDebtTitle: incoming.linkedDebtTitle ?? existing.linkedDebtTitle,
  };
}
