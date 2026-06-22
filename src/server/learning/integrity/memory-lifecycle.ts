import type { LearningEventType } from "../learning-types";
import { DebtStatus, MemoryState } from "../learning-types";

export { MemoryState, DebtStatus };

export function defaultMemoryStateForEvent(eventType: LearningEventType): MemoryState {
  switch (eventType) {
    case "DEBT_RESOLVED":
    case "SELF_IMPROVEMENT_COMPLETED":
    case "EXECUTION_COMPLETED":
      return MemoryState.VERIFIED;
    case "PROPOSAL_APPROVED":
      return MemoryState.ACTIVE;
    case "AUDIT_COMPLETED":
    default:
      return MemoryState.ACTIVE;
  }
}

export function transitionDebtOnAuditFind(current: DebtStatus | null): DebtStatus {
  if (!current) return DebtStatus.OPEN;
  if (current === DebtStatus.VERIFIED) return DebtStatus.REOPENED;
  if (current === DebtStatus.REOPENED) return DebtStatus.REOPENED;
  return DebtStatus.OPEN;
}

export function transitionDebtOnProposalApproved(): DebtStatus {
  return DebtStatus.IMPLEMENTED;
}

export function transitionDebtOnValidation(): DebtStatus {
  return DebtStatus.VERIFIED;
}

export function transitionDebtOnReappearance(): DebtStatus {
  return DebtStatus.REOPENED;
}

export function isDebtResolved(status: DebtStatus): boolean {
  return status === DebtStatus.VERIFIED;
}

export function isStaleMemory(lastSeenAt: string, staleDays: number): boolean {
  const last = new Date(lastSeenAt).getTime();
  if (Number.isNaN(last)) return false;
  const ageMs = Date.now() - last;
  return ageMs > staleDays * 24 * 60 * 60 * 1000;
}

export function shouldArchiveMemory(state: MemoryState, lastSeenAt: string, staleDays: number): boolean {
  return state === MemoryState.ACTIVE && isStaleMemory(lastSeenAt, staleDays);
}
