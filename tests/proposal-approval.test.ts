import { describe, it, expect } from "vitest";
import { GovernanceError } from "@/server/errors/governance-error";
import { assertCanGenerateFiles } from "@/server/invariants/proposal-invariants";
import { assertCannotApproveRejected } from "@/server/invariants/governance-invariants";
import { MarkdownGenerator } from "@/server/proposals/markdown-generator";
import type { Proposal } from "@prisma/client";

const baseProposal: Proposal = {
  id: "prop-1",
  discussionId: "disc-1",
  title: "Design Crew System for the MMO game",
  summary: "Test summary",
  alternativesConsidered: [],
  chosenSolution: "MVP crew system",
  reasoning: ["User value"],
  risks: ["Abuse"],
  filesToCreate: ["docs/features/crew-system.md"],
  tasksToCreate: ["Implement crew"],
  voteClassification: "weak",
  status: "PENDING",
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe("Proposal approval guards", () => {
  it("blocks file generation when proposal is PENDING", () => {
    try {
      assertCanGenerateFiles("PENDING");
      expect.fail("Should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(GovernanceError);
      expect((err as GovernanceError).code).toBe("PROPOSAL_APPROVAL_REQUIRED");
    }
  });

  it("allows file generation when proposal is APPROVED", () => {
    expect(() => assertCanGenerateFiles("APPROVED")).not.toThrow();
  });

  it("blocks approving a rejected proposal", () => {
    try {
      assertCannotApproveRejected("REJECTED", "APPROVED");
      expect.fail("Should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(GovernanceError);
      expect((err as GovernanceError).code).toBe("CANNOT_APPROVE_REJECTED");
    }
  });

  it("MarkdownGenerator rejects PENDING proposal", async () => {
    const generator = new MarkdownGenerator();
    const mockTx = {
      generatedFile: { create: async () => ({}) },
    };

    await expect(
      generator.generate(mockTx as never, { ...baseProposal, status: "PENDING" })
    ).rejects.toSatisfy((err: unknown) => {
      return err instanceof GovernanceError && err.code === "PROPOSAL_APPROVAL_REQUIRED";
    });
  });
});
