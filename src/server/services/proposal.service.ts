import { prisma } from "@/server/db/prisma";
import { governanceService } from "@/server/governance/governance.service";
import { executionService } from "@/server/execution/execution.service";

export class ProposalService {
  async getById(proposalId: string) {
    return prisma.proposal.findUniqueOrThrow({
      where: { id: proposalId },
      include: {
        discussion: { include: { project: true } },
        generatedFiles: true,
        decisionLog: { include: { decider: true } },
        executionLogs: { orderBy: { createdAt: "asc" } },
      },
    });
  }

  async executeToGitHub(proposalId: string) {
    return executionService.executeApprovedProposal(proposalId);
  }

  async getGitHubConfigStatus(projectId: string) {
    return executionService.isGitHubConfigured(projectId);
  }

  async approve(proposalId: string, decidedBy: string, notes?: string) {
    return governanceService.resolveProposal({
      proposalId,
      action: "APPROVED",
      decidedBy,
      notes,
    });
  }

  async reject(proposalId: string, decidedBy: string, notes?: string) {
    return governanceService.resolveProposal({
      proposalId,
      action: "REJECTED",
      decidedBy,
      notes,
    });
  }

  async requestChanges(proposalId: string, decidedBy: string, notes?: string) {
    return governanceService.resolveProposal({
      proposalId,
      action: "CHANGES_REQUESTED",
      decidedBy,
      notes,
    });
  }

  async listGeneratedFiles(projectId: string) {
    return prisma.generatedFile.findMany({
      where: { proposal: { discussion: { projectId } } },
      include: { proposal: true },
      orderBy: { createdAt: "desc" },
    });
  }
}

export const proposalService = new ProposalService();
