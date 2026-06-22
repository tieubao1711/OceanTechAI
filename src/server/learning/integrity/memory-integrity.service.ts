import { prisma } from "@/server/db/prisma";
import type { AuditFinding } from "@/server/audit/audit-types";
import { memoryService } from "@/server/memory/memory.service";
import type { LearningEvent } from "../learning-types";
import {
  DEBT_TRACK_PREFIX,
  INTEGRITY_STATS_KEY,
  LEARNING_MEMORY_PREFIX,
  LEARNING_RECORD_PREFIX,
  MemoryState,
  type DebtTrackRecord,
  type IntegrityLearningRecord,
  type LearningHealthMetrics,
} from "../learning-types";
import { summarizeLearningEvent } from "../learning-summary";
import {
  findBestMemoryMatch,
  mergeLearningRecords,
  topicSimilarity,
} from "./memory-deduplication";
import { resolveCanonicalTopic } from "./topic-resolver";
import { topicLifecycleService } from "./topic-lifecycle.service";
import {
  DebtStatus,
  defaultMemoryStateForEvent,
  shouldArchiveMemory,
  transitionDebtOnAuditFind,
  transitionDebtOnProposalApproved,
  transitionDebtOnValidation,
} from "./memory-lifecycle";
import {
  buildHealthMetrics,
  detectRepeatedMistakes,
  type IntegrityStats,
} from "./memory-health";
import { recommendationConsistencyService } from "./recommendation-consistency.service";

const DEFAULT_STATS: IntegrityStats = { duplicateMemoriesPrevented: 0 };

export class MemoryIntegrityService {
  async recordLearningEvent(params: {
    projectId: string;
    event: LearningEvent;
    referenceId: string;
    linkedProposalId?: string;
    linkedCycleId?: string;
    linkedDebtTitle?: string;
  }): Promise<{ record: IntegrityLearningRecord; merged: boolean }> {
    const summary = summarizeLearningEvent(params.event);
    const topicKey = resolveCanonicalTopic(params.event.title).topicKey;
    const now = new Date().toISOString();

    const incoming: IntegrityLearningRecord = {
      ...summary,
      state: defaultMemoryStateForEvent(params.event.type),
      topicKey,
      evidenceCount: 1,
      lastSeenAt: now,
      references: [params.referenceId],
      linkedProposalId: params.linkedProposalId,
      linkedCycleId: params.linkedCycleId,
      linkedDebtTitle: params.linkedDebtTitle,
    };

    const existing = await this.loadLearningRecords(params.projectId);
    const candidates = existing.map((r) => ({
      key: `${LEARNING_RECORD_PREFIX}${r.topicKey}`,
      record: r,
    }));

    const match = findBestMemoryMatch(candidates, {
      title: params.event.title,
      eventType: params.event.type,
      topicKey,
      linkedProposalId: params.linkedProposalId,
      linkedCycleId: params.linkedCycleId,
      linkedDebtTitle: params.linkedDebtTitle,
    });

    if (match.matched && match.candidate) {
      const merged = mergeLearningRecords(
        match.candidate.record,
        incoming,
        params.referenceId
      );
      await this.saveLearningRecord(params.projectId, merged);
      await this.incrementDuplicatePrevented(params.projectId);
      return { record: merged, merged: true };
    }

    await this.saveLearningRecord(params.projectId, incoming);
    return { record: incoming, merged: false };
  }

  async registerDebtFromAudit(params: {
    projectId: string;
    finding: AuditFinding;
  }): Promise<DebtTrackRecord> {
    const topicKey = resolveCanonicalTopic(params.finding.title).topicKey;
    const key = `${DEBT_TRACK_PREFIX}${topicKey}`;
    const existing = await this.loadDebtTrack(params.projectId, key);
    const now = new Date().toISOString();

    const status = transitionDebtOnAuditFind(existing?.status ?? null);
    const record: DebtTrackRecord = {
      title: params.finding.title,
      fileOrModule: params.finding.fileOrModule,
      status,
      topicKey,
      occurrenceCount: (existing?.occurrenceCount ?? 0) + 1,
      lastSeenAt: now,
      linkedCycleId: existing?.linkedCycleId,
      linkedProposalId: existing?.linkedProposalId,
      verifiedAt: existing?.verifiedAt,
    };

    await memoryService.upsertEntry({
      scope: "PROJECT",
      projectId: params.projectId,
      key,
      value: JSON.stringify(record),
      source: "learning_integrity",
    });

    return record;
  }

  async markDebtImplemented(params: {
    projectId: string;
    proposalId: string;
    debtTitle?: string;
  }) {
    const tracks = await this.loadAllDebtTracks(params.projectId);
    for (const track of tracks) {
      if (
        params.debtTitle &&
        topicSimilarity(track.title, params.debtTitle) < 0.65
      ) {
        continue;
      }
      if (track.status === DebtStatus.VERIFIED) continue;

      track.status = transitionDebtOnProposalApproved();
      track.linkedProposalId = params.proposalId;
      track.lastSeenAt = new Date().toISOString();

      await memoryService.upsertEntry({
        scope: "PROJECT",
        projectId: params.projectId,
        key: `${DEBT_TRACK_PREFIX}${track.topicKey}`,
        value: JSON.stringify(track),
        source: "learning_integrity",
      });
    }
  }

  async markDebtVerified(params: {
    projectId: string;
    finding: AuditFinding;
    validationAuditId: string;
  }): Promise<DebtTrackRecord> {
    const topicKey = resolveCanonicalTopic(params.finding.title).topicKey;
    const key = `${DEBT_TRACK_PREFIX}${topicKey}`;
    const now = new Date().toISOString();

    const record: DebtTrackRecord = {
      title: params.finding.title,
      fileOrModule: params.finding.fileOrModule,
      status: transitionDebtOnValidation(),
      topicKey,
      occurrenceCount: 1,
      lastSeenAt: now,
      verifiedAt: now,
    };

    const existing = await this.loadDebtTrack(params.projectId, key);
    if (existing) {
      record.occurrenceCount = existing.occurrenceCount;
      record.linkedCycleId = existing.linkedCycleId;
      record.linkedProposalId = existing.linkedProposalId;
    }

    await memoryService.upsertEntry({
      scope: "PROJECT",
      projectId: params.projectId,
      key,
      value: JSON.stringify(record),
      source: "learning_integrity",
    });

    return record;
  }

  async openOrLinkImprovementCycle(params: {
    projectId: string;
    title: string;
    auditDiscussionId: string;
    proposalId: string;
  }) {
    const topicKey = resolveCanonicalTopic(params.title).topicKey;

    const existingByProposal = await prisma.improvementCycle.findFirst({
      where: { proposalId: params.proposalId },
    });
    if (existingByProposal) return existingByProposal;

    const verifiedCycle = await prisma.improvementCycle.findFirst({
      where: {
        projectId: params.projectId,
        topicKey,
        status: "VERIFIED",
      },
      orderBy: { verifiedAt: "desc" },
    });

    if (verifiedCycle) {
      return prisma.improvementCycle.create({
        data: {
          projectId: params.projectId,
          title: params.title,
          topicKey,
          auditDiscussionId: params.auditDiscussionId,
          proposalId: params.proposalId,
          parentCycleId: verifiedCycle.id,
          status: "OPEN",
        },
      });
    }

    return prisma.improvementCycle.create({
      data: {
        projectId: params.projectId,
        title: params.title,
        topicKey,
        auditDiscussionId: params.auditDiscussionId,
        proposalId: params.proposalId,
        status: "OPEN",
      },
    });
  }

  async verifyCycleForDebt(params: {
    projectId: string;
    finding: AuditFinding;
    validationAuditId: string;
  }) {
    const topicKey = resolveCanonicalTopic(params.finding.title).topicKey;
    const cycles = await prisma.improvementCycle.findMany({
      where: {
        projectId: params.projectId,
        status: { in: ["OPEN", "IMPLEMENTED"] },
      },
    });

    for (const cycle of cycles) {
      const cycleTopic = resolveCanonicalTopic(cycle.title).topicKey;
      if (cycleTopic !== topicKey) {
        continue;
      }

      const verifiedExists = await prisma.improvementCycle.findFirst({
        where: {
          projectId: params.projectId,
          topicKey: cycleTopic,
          status: "VERIFIED",
          id: { not: cycle.id },
        },
      });
      if (verifiedExists) {
        await prisma.improvementCycle.update({
          where: { id: cycle.id },
          data: {
            status: "FAILED",
            parentCycleId: verifiedExists.id,
          },
        });
        continue;
      }

      await prisma.improvementCycle.update({
        where: { id: cycle.id },
        data: {
          status: "VERIFIED",
          validationAuditId: params.validationAuditId,
          verifiedAt: new Date(),
          topicKey: cycleTopic,
        },
      });

      return cycle;
    }

    return null;
  }

  async getLearningCenterData(projectId: string) {
    const [records, debtTracks, cycles, audits, health, lifecycleMap] = await Promise.all([
      this.loadLearningRecords(projectId),
      this.loadAllDebtTracks(projectId),
      prisma.improvementCycle.findMany({
        where: { projectId },
        orderBy: { createdAt: "desc" },
      }),
      prisma.discussion.findMany({
        where: { projectId, mode: "architecture_audit", status: "COMPLETED" },
        orderBy: { updatedAt: "desc" },
        take: 5,
        select: { consensusJson: true },
      }),
      this.getHealthMetrics(projectId),
      topicLifecycleService.loadLifecycleMap(projectId),
    ]);

    const verifiedTopicKeys = new Set(
      [...lifecycleMap.values()]
        .filter((l) => l.status === "VERIFIED")
        .map((l) => l.topicKey)
    );

    const activeLearnings = recommendationConsistencyService
      .dedupeByTopicKey(
        records
          .filter((r) => r.state === MemoryState.ACTIVE)
          .filter((r) => {
            const topicKey = resolveCanonicalTopic(r.title).topicKey;
            const lifecycle = lifecycleMap.get(topicKey);
            if (lifecycle?.status === "VERIFIED" || lifecycle?.status === "IMPLEMENTED") {
              return false;
            }
            return !verifiedTopicKeys.has(topicKey);
          })
          .sort((a, b) => b.lastSeenAt.localeCompare(a.lastSeenAt))
      )
      .slice(0, 10);

    const verifiedImprovements = recommendationConsistencyService
      .dedupeByTopicKey(
        cycles
          .filter((c) => c.status === "VERIFIED")
          .map((c) => ({
            ...c,
            topicKey: resolveCanonicalTopic(c.title).topicKey,
            title: resolveCanonicalTopic(c.title).canonicalTitle,
          }))
      )
      .slice(0, 10);

    const reopenedProblems = debtTracks.filter((d) => d.status === DebtStatus.REOPENED);

    const repeatedMistakes = detectRepeatedMistakes(
      audits,
      debtTracks,
      undefined,
      lifecycleMap
    );

    return {
      health,
      activeLearnings,
      verifiedImprovements,
      reopenedProblems,
      repeatedMistakes,
      openCycles: cycles.filter((c) => c.status === "OPEN" || c.status === "IMPLEMENTED"),
      verifiedTopicCount: verifiedTopicKeys.size,
    };
  }

  async getHealthMetrics(projectId: string): Promise<LearningHealthMetrics> {
    const [records, debtTracks, stats] = await Promise.all([
      this.loadLearningRecords(projectId),
      this.loadAllDebtTracks(projectId),
      this.loadIntegrityStats(projectId),
    ]);

    return buildHealthMetrics({ records, debtTracks, stats });
  }

  async repairProject(projectId: string) {
    const entries = await prisma.memoryEntry.findMany({
      where: {
        projectId,
        scope: "PROJECT",
        key: { startsWith: LEARNING_MEMORY_PREFIX },
      },
    });

    let merged = 0;
    let archived = 0;
    let verifiedMemoriesArchived = 0;
    const canonical = new Map<string, IntegrityLearningRecord>();

    const cycles = await prisma.improvementCycle.findMany({ where: { projectId } });
    let cyclesMerged = 0;
    const verifiedByTopic = new Map<string, { cycleId: string; verifiedAt: string }>();

    for (const cycle of cycles.sort(
      (a, b) => (a.verifiedAt?.getTime() ?? 0) - (b.verifiedAt?.getTime() ?? 0)
    )) {
      const topicKey = resolveCanonicalTopic(cycle.title).topicKey;
      if (cycle.topicKey !== topicKey) {
        await prisma.improvementCycle.update({
          where: { id: cycle.id },
          data: { topicKey },
        });
      }

      if (cycle.status === "VERIFIED") {
        if (verifiedByTopic.has(topicKey)) {
          await prisma.improvementCycle.update({
            where: { id: cycle.id },
            data: { status: "FAILED", parentCycleId: verifiedByTopic.get(topicKey)!.cycleId },
          });
          cyclesMerged++;
        } else {
          verifiedByTopic.set(topicKey, {
            cycleId: cycle.id,
            verifiedAt: cycle.verifiedAt?.toISOString() ?? new Date().toISOString(),
          });
        }
      }
    }

    const debtEntries = entries.filter((e) => e.key.startsWith(DEBT_TRACK_PREFIX));
    const debtByTopic = new Map<string, DebtTrackRecord>();
    const staleDebtEntryIds: string[] = [];

    for (const entry of debtEntries) {
      try {
        const track = JSON.parse(entry.value) as DebtTrackRecord;
        const topicKey = resolveCanonicalTopic(track.title).topicKey;
        track.topicKey = topicKey;

        const verified = verifiedByTopic.get(topicKey);
        if (verified && track.status === DebtStatus.OPEN) {
          const lastSeen = track.lastSeenAt ? new Date(track.lastSeenAt) : null;
          const verifiedAt = new Date(verified.verifiedAt);
          if (lastSeen && lastSeen > verifiedAt) {
            track.status = DebtStatus.REOPENED;
          } else {
            track.status = DebtStatus.VERIFIED;
            track.verifiedAt = verified.verifiedAt;
          }
        }

        const existing = debtByTopic.get(topicKey);
        if (existing) {
          existing.occurrenceCount = Math.max(
            existing.occurrenceCount,
            track.occurrenceCount
          );
          if (
            track.lastSeenAt &&
            (!existing.lastSeenAt || track.lastSeenAt > existing.lastSeenAt)
          ) {
            existing.lastSeenAt = track.lastSeenAt;
          }
          staleDebtEntryIds.push(entry.id);
        } else {
          debtByTopic.set(topicKey, track);
          if (entry.key !== `${DEBT_TRACK_PREFIX}${topicKey}`) {
            staleDebtEntryIds.push(entry.id);
          }
        }
      } catch {
        staleDebtEntryIds.push(entry.id);
      }
    }

    for (const [topicKey, track] of debtByTopic.entries()) {
      await memoryService.upsertEntry({
        scope: "PROJECT",
        projectId,
        key: `${DEBT_TRACK_PREFIX}${topicKey}`,
        value: JSON.stringify(track),
        source: "learning_integrity_repair",
      });
    }

    const learningSources = [
      ...entries.filter((e) => e.key.startsWith(LEARNING_RECORD_PREFIX)),
      ...entries.filter(
        (e) =>
          !e.key.startsWith(LEARNING_RECORD_PREFIX) &&
          !e.key.startsWith(DEBT_TRACK_PREFIX) &&
          e.key !== INTEGRITY_STATS_KEY
      ),
    ];

    for (const entry of learningSources) {
      let record: IntegrityLearningRecord;
      try {
        const parsed = JSON.parse(entry.value) as IntegrityLearningRecord;
        const title = parsed.title ?? entry.key;
        record = {
          eventType: parsed.eventType ?? "AUDIT_COMPLETED",
          title,
          summary: parsed.summary ?? entry.value,
          importance: parsed.importance ?? "medium",
          capturedAt: parsed.capturedAt ?? entry.createdAt.toISOString(),
          state: parsed.state ?? MemoryState.ACTIVE,
          topicKey: resolveCanonicalTopic(title).topicKey,
          evidenceCount: parsed.evidenceCount ?? 1,
          lastSeenAt: parsed.lastSeenAt ?? entry.updatedAt.toISOString(),
          references: parsed.references ?? [entry.key],
          linkedProposalId: parsed.linkedProposalId,
          linkedCycleId: parsed.linkedCycleId,
          linkedDebtTitle: parsed.linkedDebtTitle,
        };
      } catch {
        record = {
          eventType: "AUDIT_COMPLETED",
          title: entry.key,
          summary: entry.value.slice(0, 480),
          importance: "medium",
          capturedAt: entry.createdAt.toISOString(),
          state: MemoryState.ACTIVE,
          topicKey: resolveCanonicalTopic(entry.key).topicKey,
          evidenceCount: 1,
          lastSeenAt: entry.updatedAt.toISOString(),
          references: [entry.key],
        };
      }

      if (verifiedByTopic.has(record.topicKey) && record.state === MemoryState.ACTIVE) {
        record.state = MemoryState.ARCHIVED;
        verifiedMemoriesArchived++;
      }

      if (shouldArchiveMemory(record.state, record.lastSeenAt, 90)) {
        record.state = MemoryState.ARCHIVED;
        archived++;
      }

      const candidates = [...canonical.entries()].map(([key, r]) => ({
        key,
        record: r,
      }));
      const match = findBestMemoryMatch(candidates, {
        title: record.title,
        eventType: record.eventType,
        topicKey: record.topicKey,
        linkedProposalId: record.linkedProposalId,
        linkedCycleId: record.linkedCycleId,
        linkedDebtTitle: record.linkedDebtTitle,
      });

      if (match.matched && match.candidate) {
        const existing = canonical.get(match.candidate.key)!;
        canonical.set(
          match.candidate.key,
          mergeLearningRecords(existing, record, entry.key)
        );
        merged++;
      } else {
        const key = `${LEARNING_RECORD_PREFIX}${record.topicKey}`;
        const existing = canonical.get(key);
        if (existing) {
          canonical.set(key, mergeLearningRecords(existing, record, entry.key));
          merged++;
        } else {
          canonical.set(key, record);
        }
      }
    }

    for (const [, record] of canonical.entries()) {
      await memoryService.upsertEntry({
        scope: "PROJECT",
        projectId,
        key: `${LEARNING_RECORD_PREFIX}${record.topicKey}`,
        value: JSON.stringify(record),
        source: "learning_integrity_repair",
      });
    }

    const staleLearningIds = entries
      .filter((e) => e.key.startsWith(LEARNING_RECORD_PREFIX))
      .filter((e) => !canonical.has(e.key))
      .map((e) => e.id);

    const legacyKeys = entries
      .filter(
        (e) =>
          !e.key.startsWith(LEARNING_RECORD_PREFIX) &&
          !e.key.startsWith(DEBT_TRACK_PREFIX) &&
          e.key !== INTEGRITY_STATS_KEY
      )
      .map((e) => e.id);

    const removeIds = [...new Set([...staleDebtEntryIds, ...staleLearningIds, ...legacyKeys])];
    if (removeIds.length > 0) {
      await prisma.memoryEntry.deleteMany({ where: { id: { in: removeIds } } });
    }

    return {
      memoriesMerged: merged,
      memoriesArchived: archived,
      verifiedMemoriesArchived,
      legacyRemoved: legacyKeys.length,
      debtTracksCanonicalized: debtByTopic.size,
      cyclesDeduped: cyclesMerged,
      canonicalRecords: canonical.size,
      staleEntriesRemoved: removeIds.length,
    };
  }

  private async saveLearningRecord(projectId: string, record: IntegrityLearningRecord) {
    const key = `${LEARNING_RECORD_PREFIX}${record.topicKey}`;
    await memoryService.upsertEntry({
      scope: "PROJECT",
      projectId,
      key,
      value: JSON.stringify(record),
      source: "learning_integrity",
    });
  }

  private async loadLearningRecords(projectId: string): Promise<IntegrityLearningRecord[]> {
    const entries = await prisma.memoryEntry.findMany({
      where: {
        projectId,
        scope: "PROJECT",
        key: { startsWith: LEARNING_RECORD_PREFIX },
      },
      orderBy: { updatedAt: "desc" },
    });

    return entries
      .map((e) => {
        try {
          return JSON.parse(e.value) as IntegrityLearningRecord;
        } catch {
          return null;
        }
      })
      .filter((r): r is IntegrityLearningRecord => r !== null);
  }

  private async loadAllDebtTracks(projectId: string): Promise<DebtTrackRecord[]> {
    const entries = await prisma.memoryEntry.findMany({
      where: {
        projectId,
        scope: "PROJECT",
        key: { startsWith: DEBT_TRACK_PREFIX },
      },
    });

    return entries
      .map((e) => {
        try {
          return JSON.parse(e.value) as DebtTrackRecord;
        } catch {
          return null;
        }
      })
      .filter((r): r is DebtTrackRecord => r !== null);
  }

  private async loadDebtTrack(
    projectId: string,
    key: string
  ): Promise<DebtTrackRecord | null> {
    const entry = await prisma.memoryEntry.findFirst({
      where: { projectId, scope: "PROJECT", key },
    });
    if (!entry) return null;
    try {
      return JSON.parse(entry.value) as DebtTrackRecord;
    } catch {
      return null;
    }
  }

  private async loadIntegrityStats(projectId: string): Promise<IntegrityStats> {
    const entry = await prisma.memoryEntry.findFirst({
      where: { projectId, scope: "PROJECT", key: INTEGRITY_STATS_KEY },
    });
    if (!entry) return DEFAULT_STATS;
    try {
      return JSON.parse(entry.value) as IntegrityStats;
    } catch {
      return DEFAULT_STATS;
    }
  }

  private async incrementDuplicatePrevented(projectId: string) {
    const stats = await this.loadIntegrityStats(projectId);
    stats.duplicateMemoriesPrevented += 1;
    await memoryService.upsertEntry({
      scope: "PROJECT",
      projectId,
      key: INTEGRITY_STATS_KEY,
      value: JSON.stringify(stats),
      source: "learning_integrity",
    });
  }
}

export const memoryIntegrityService = new MemoryIntegrityService();
