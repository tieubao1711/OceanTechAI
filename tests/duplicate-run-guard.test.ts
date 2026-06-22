import { describe, it, expect } from "vitest";
import { assertDiscussionCanRun } from "@/server/invariants/debate-invariants";
import { GovernanceError } from "@/server/errors/governance-error";

describe("duplicate run guard", () => {
  it("allows DRAFT and FAILED discussions to run", () => {
    expect(() => assertDiscussionCanRun("DRAFT")).not.toThrow();
    expect(() => assertDiscussionCanRun("FAILED")).not.toThrow();
  });

  it("blocks RUNNING discussions", () => {
    expect(() => assertDiscussionCanRun("RUNNING")).toThrow(GovernanceError);
    try {
      assertDiscussionCanRun("RUNNING");
    } catch (err) {
      expect((err as GovernanceError).code).toBe("DISCUSSION_ALREADY_RUNNING");
    }
  });

  it("blocks COMPLETED discussions", () => {
    expect(() => assertDiscussionCanRun("COMPLETED")).toThrow(GovernanceError);
    try {
      assertDiscussionCanRun("COMPLETED");
    } catch (err) {
      expect((err as GovernanceError).code).toBe("DISCUSSION_ALREADY_COMPLETED");
    }
  });
});
