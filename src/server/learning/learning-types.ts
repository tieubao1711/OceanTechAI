export type LearningEventType =
  | "AUDIT_COMPLETED"
  | "PROPOSAL_APPROVED"
  | "EXECUTION_COMPLETED"
  | "DEBT_RESOLVED"
  | "SELF_IMPROVEMENT_COMPLETED";

export type LearningImportance = "low" | "medium" | "high";

export type LearningEvent = {
  type: LearningEventType;
  title: string;
  evidence: string[];
  outcome: string;
  importance: LearningImportance;
};

export type LearningSummary = {
  eventType: LearningEventType;
  title: string;
  summary: string;
  importance: LearningImportance;
  capturedAt: string;
};

export const LEARNING_MEMORY_PREFIX = "learning_";
export const MAX_LEARNING_MEMORIES_PER_PROJECT = 200;
export const LEARNING_COMPACTION_TARGET = 150;

export type ResolvedDebtRecord = {
  title: string;
  fileOrModule: string;
  resolvedAt: string;
  cycleId?: string;
};

export type DuplicateCheckResult = {
  isDuplicate: boolean;
  warning?: string;
  matchedTopic?: string;
  source?: "resolved_debt" | "completed_cycle" | "accepted_adr";
};

export enum MemoryState {
  ACTIVE = "ACTIVE",
  VERIFIED = "VERIFIED",
  ARCHIVED = "ARCHIVED",
  SUPERSEDED = "SUPERSEDED",
}

export enum DebtStatus {
  OPEN = "OPEN",
  IMPLEMENTED = "IMPLEMENTED",
  VERIFIED = "VERIFIED",
  FAILED = "FAILED",
  REOPENED = "REOPENED",
}

export type IntegrityLearningRecord = LearningSummary & {
  state: MemoryState;
  topicKey: string;
  evidenceCount: number;
  lastSeenAt: string;
  references: string[];
  linkedProposalId?: string;
  linkedCycleId?: string;
  linkedDebtTitle?: string;
};

export type DebtTrackRecord = {
  title: string;
  fileOrModule: string;
  status: DebtStatus;
  topicKey: string;
  occurrenceCount: number;
  lastSeenAt: string;
  linkedCycleId?: string;
  linkedProposalId?: string;
  verifiedAt?: string;
};

export type LearningHealthMetrics = {
  totalMemories: number;
  activeMemories: number;
  verifiedMemories: number;
  archivedMemories: number;
  duplicateMemoriesPrevented: number;
  reopenedDebts: number;
  memoryHealthScore: number;
};

export type RepeatedMistake = {
  title: string;
  status: DebtStatus;
  occurrenceCount: number;
  fileOrModule?: string;
  topicKey?: string;
};

export const DUPLICATE_MATCH_THRESHOLD = 0.75;
export const REPEATED_MISTAKE_THRESHOLD = 2;
export const STALE_MEMORY_DAYS = 90;
export const DEBT_TRACK_PREFIX = "debt_track_";
export const LEARNING_RECORD_PREFIX = "learning_record_";
export const INTEGRITY_STATS_KEY = "learning_integrity_stats";
