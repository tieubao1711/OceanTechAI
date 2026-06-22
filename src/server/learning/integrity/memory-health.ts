import type { ArchitectureAuditReport } from "@/server/audit/audit-types";
import { parseArchitectureAuditReport } from "@/server/audit/audit-quality";
import {
  DebtStatus,
  MemoryState,
  REPEATED_MISTAKE_THRESHOLD,
  STALE_MEMORY_DAYS,
  type DebtTrackRecord,
  type IntegrityLearningRecord,
  type LearningHealthMetrics,
  type RepeatedMistake,
} from "../learning-types";
import { isDebtResolved, isStaleMemory } from "./memory-lifecycle";
import { topicSimilarity } from "./memory-deduplication";
import { resolveCanonicalTopic } from "./topic-resolver";
import type { TopicLifecycle } from "./topic-lifecycle.service";

export type IntegrityStats = {
  duplicateMemoriesPrevented: number;
};

export function calculateMemoryHealthScore(params: {
  totalMemories: number;
  verifiedMemories: number;
  archivedMemories: number;
  duplicateMemoriesPrevented: number;
  openDebts: number;
  verifiedDebts: number;
  staleMemories: number;
}): number {
  const {
    totalMemories,
    verifiedMemories,
    archivedMemories,
    duplicateMemoriesPrevented,
    openDebts,
    verifiedDebts,
    staleMemories,
  } = params;

  if (totalMemories === 0) return 100;

  const verifiedRatio = verifiedMemories / totalMemories;
  const staleRatio = staleMemories / totalMemories;
  const totalDebts = openDebts + verifiedDebts;
  const unresolvedDebtRatio = totalDebts > 0 ? openDebts / totalDebts : 0;
  const duplicateBonus = Math.min(duplicateMemoriesPrevented * 0.5, 10);
  const archivePenalty = (archivedMemories / totalMemories) * 5;

  const raw =
    100 -
    staleRatio * 25 -
    unresolvedDebtRatio * 30 +
    verifiedRatio * 20 +
    duplicateBonus -
    archivePenalty;

  return Math.max(0, Math.min(100, Math.round(raw)));
}

export function buildHealthMetrics(params: {
  records: IntegrityLearningRecord[];
  debtTracks: DebtTrackRecord[];
  stats: IntegrityStats;
}): LearningHealthMetrics {
  const { records, debtTracks, stats } = params;

  const activeMemories = records.filter((r) => r.state === MemoryState.ACTIVE).length;
  const verifiedMemories = records.filter((r) => r.state === MemoryState.VERIFIED).length;
  const archivedMemories = records.filter(
    (r) => r.state === MemoryState.ARCHIVED || r.state === MemoryState.SUPERSEDED
  ).length;
  const staleMemories = records.filter(
    (r) => r.state === MemoryState.ACTIVE && isStaleMemory(r.lastSeenAt, STALE_MEMORY_DAYS)
  ).length;

  const openDebts = debtTracks.filter(
    (d) =>
      d.status === DebtStatus.OPEN ||
      d.status === DebtStatus.REOPENED ||
      d.status === DebtStatus.IMPLEMENTED
  ).length;
  const verifiedDebts = debtTracks.filter((d) => isDebtResolved(d.status)).length;
  const reopenedDebts = debtTracks.filter((d) => d.status === DebtStatus.REOPENED).length;

  return {
    totalMemories: records.length,
    activeMemories,
    verifiedMemories,
    archivedMemories,
    duplicateMemoriesPrevented: stats.duplicateMemoriesPrevented,
    reopenedDebts,
    memoryHealthScore: calculateMemoryHealthScore({
      totalMemories: records.length,
      verifiedMemories,
      archivedMemories,
      duplicateMemoriesPrevented: stats.duplicateMemoriesPrevented,
      openDebts,
      verifiedDebts,
      staleMemories,
    }),
  };
}

function isExcludedMistakeStatus(status: DebtStatus): boolean {
  return (
    status === DebtStatus.VERIFIED ||
    status === DebtStatus.IMPLEMENTED
  );
}

export function detectRepeatedMistakes(
  audits: Array<{ consensusJson: unknown }>,
  debtTracks: DebtTrackRecord[],
  threshold = REPEATED_MISTAKE_THRESHOLD,
  lifecycleMap?: Map<string, TopicLifecycle>
): RepeatedMistake[] {
  const topicCounts = new Map<
    string,
    { count: number; title: string; fileOrModule?: string; topicKey: string }
  >();

  for (const audit of audits) {
    const report = parseArchitectureAuditReport(audit.consensusJson);
    if (!report) continue;
    for (const finding of report.topFindings) {
      const topicKey = resolveCanonicalTopic(finding.title).topicKey;
      const existing = topicCounts.get(topicKey) ?? {
        count: 0,
        title: finding.title,
        fileOrModule: finding.fileOrModule,
        topicKey,
      };
      existing.count += 1;
      topicCounts.set(topicKey, existing);
    }
  }

  const results: RepeatedMistake[] = [];

  for (const [, data] of topicCounts.entries()) {
    if (data.count < threshold) continue;

    const lifecycle = lifecycleMap?.get(data.topicKey);
    if (
      lifecycle &&
      (lifecycle.status === "VERIFIED" || lifecycle.status === "IMPLEMENTED")
    ) {
      continue;
    }

    const debtTrack = debtTracks.find(
      (d) =>
        resolveCanonicalTopic(d.title).topicKey === data.topicKey ||
        d.topicKey === data.topicKey ||
        topicSimilarity(d.title, data.title) >= 0.75
    );

    const status = debtTrack?.status ?? DebtStatus.OPEN;

    if (isExcludedMistakeStatus(status)) continue;
    if (status !== DebtStatus.OPEN && status !== DebtStatus.REOPENED) continue;

    results.push({
      title: debtTrack?.title ?? data.title,
      status,
      occurrenceCount: debtTrack?.occurrenceCount ?? data.count,
      fileOrModule: debtTrack?.fileOrModule ?? data.fileOrModule,
      topicKey: data.topicKey,
    });
  }

  const deduped = new Map<string, RepeatedMistake>();
  for (const item of results) {
    const key = item.topicKey ?? resolveCanonicalTopic(item.title).topicKey;
    if (!deduped.has(key)) {
      deduped.set(key, item);
    }
  }

  return [...deduped.values()]
    .sort((a, b) => b.occurrenceCount - a.occurrenceCount)
    .slice(0, 10);
}

export function extractDebtTitlesFromReport(report: ArchitectureAuditReport): string[] {
  return report.topFindings.map((f) => f.title);
}
