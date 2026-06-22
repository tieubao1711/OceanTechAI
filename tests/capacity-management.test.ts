import { describe, it, expect } from "vitest";
import { CapacityManagementService } from "@/server/workforce/capacity-management.service";

describe("capacity-management", () => {
  const service = new CapacityManagementService();

  it("calculates allocation total and available capacity", () => {
    const result = service.calculateCapacity([70, 30]);
    expect(result.allocationTotal).toBe(100);
    expect(result.availableCapacity).toBe(0);
    expect(result.isOverallocated).toBe(false);
  });

  it("flags overallocated when total exceeds 100%", () => {
    const result = service.calculateCapacity([70, 40]);
    expect(result.allocationTotal).toBe(110);
    expect(result.availableCapacity).toBe(0);
    expect(result.isOverallocated).toBe(true);
  });

  it("rejects allocation that would exceed capacity", () => {
    const validation = service.validateAllocation(70, 40);
    expect(validation.valid).toBe(false);
    expect(validation.message).toContain("100%");
  });

  it("allows valid allocation within capacity", () => {
    const validation = service.validateAllocation(60, 30);
    expect(validation.valid).toBe(true);
  });
});
