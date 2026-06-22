import type { AgentCapacity } from "./workforce-types";

export class CapacityManagementService {
  calculateCapacity(allocationPercents: number[]): AgentCapacity["allocationTotal"] extends number
    ? Pick<AgentCapacity, "allocationTotal" | "availableCapacity" | "isOverallocated">
    : never {
    const allocationTotal = allocationPercents.reduce((sum, p) => sum + p, 0);
    const availableCapacity = Math.max(0, 100 - allocationTotal);
    return {
      allocationTotal,
      availableCapacity,
      isOverallocated: allocationTotal > 100,
    };
  }

  buildCapacity(agentId: string, allocationPercents: number[]): AgentCapacity {
    const calc = this.calculateCapacity(allocationPercents);
    return { agentId, ...calc };
  }

  validateAllocation(existingTotal: number, newAllocation: number): {
    valid: boolean;
    message?: string;
  } {
    if (newAllocation < 0 || newAllocation > 100) {
      return { valid: false, message: "Allocation must be between 0 and 100 percent." };
    }
    if (existingTotal + newAllocation > 100) {
      return {
        valid: false,
        message: `Would exceed 100% capacity (current ${existingTotal}%).`,
      };
    }
    return { valid: true };
  }
}

export const capacityManagementService = new CapacityManagementService();
