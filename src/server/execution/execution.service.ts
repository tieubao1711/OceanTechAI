import type { Prisma } from "@prisma/client";
import { prisma } from "@/server/db/prisma";
import { GovernanceError } from "@/server/errors/governance-error";
import { createGitHubClient } from "@/server/integrations/github/github-client";
import { isGitHubRefExistsError } from "@/server/integrations/github/github-errors";
import type { IGitHubClient } from "@/server/integrations/github/github.types";
import { repositoryIntegrationService } from "@/server/integrations/repository/repository-integration.service";
import {
  EXECUTION_LOG_STATUS,
  EXECUTION_LOG_TYPES,
  type ExecutionResult,
} from "./execution-plan";
import { learningCaptureService } from "@/server/learning/learning-capture.service";

type ExecutionLogMetadata = Prisma.InputJsonValue;

export class ExecutionService {
  async executeApprovedProposal(
    proposalId: string,
    options?: { githubClient?: IGitHubClient }
  ): Promise<ExecutionResult> {
    const proposal = await prisma.proposal.findUniqueOrThrow({
      where: { id: proposalId },
      include: {
        generatedFiles: true,
        executionLogs: { orderBy: { createdAt: "desc" } },
        discussion: { include: { project: true } },
      },
    });

    if (proposal.status !== "APPROVED") {
      throw new GovernanceError(
        "PROPOSAL_NOT_APPROVED",
        "Only APPROVED proposals can be executed to GitHub."
      );
    }

    const existingPr = proposal.executionLogs.find(
      (log) =>
        log.type === EXECUTION_LOG_TYPES.GITHUB_PR &&
        log.status === EXECUTION_LOG_STATUS.SUCCESS
    );
    if (existingPr) {
      const metadata = existingPr.metadata as { prUrl?: string; branchName?: string } | null;
      return {
        success: true,
        skipped: true,
        prUrl: metadata?.prUrl,
        branchName: metadata?.branchName,
        message: "Pull request already created for this proposal.",
      };
    }

    const projectId = proposal.discussion.projectId;
    const repoConfig = await repositoryIntegrationService.getConfig(projectId);
    const validation = repositoryIntegrationService.validateIntegration(repoConfig);

    if (!validation.valid) {
      const message = `GitHub integration not configured. Missing: ${validation.missing.join(", ")}. Set env vars in .env (see README).`;
      await this.writeLog(proposalId, EXECUTION_LOG_TYPES.GITHUB_BRANCH, EXECUTION_LOG_STATUS.FAILED, message, {
        missing: validation.missing,
      });
      return { success: false, message };
    }

    const config = validation.config!;
    const github =
      options?.githubClient ??
      createGitHubClient({
        token: config.token!,
        owner: config.owner,
        repo: config.repo,
        defaultBranch: config.defaultBranch,
      });

    if (proposal.generatedFiles.length === 0) {
      const message = "No generated files found. Approve the proposal first to generate files.";
      await this.writeLog(proposalId, EXECUTION_LOG_TYPES.GENERATE_FILES, EXECUTION_LOG_STATUS.FAILED, message);
      return { success: false, message };
    }

    await this.writeLog(
      proposalId,
      EXECUTION_LOG_TYPES.GENERATE_FILES,
      EXECUTION_LOG_STATUS.SUCCESS,
      `Found ${proposal.generatedFiles.length} generated file(s).`,
      { fileCount: proposal.generatedFiles.length }
    );

    let branchName: string;
    try {
      branchName = await this.createBranchWithSuffix(github, proposal);
      await this.writeLog(proposalId, EXECUTION_LOG_TYPES.GITHUB_BRANCH, EXECUTION_LOG_STATUS.SUCCESS, `Branch ${branchName} created.`, {
        branchName,
        owner: config.owner,
        repo: config.repo,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to create branch.";
      await this.writeLog(proposalId, EXECUTION_LOG_TYPES.GITHUB_BRANCH, EXECUTION_LOG_STATUS.FAILED, message);
      return { success: false, message };
    }

    for (const file of proposal.generatedFiles) {
      try {
        const result = await github.createOrUpdateFile(
          file.path,
          file.content,
          `chore: add ${file.path} from proposal ${proposal.id.slice(0, 8)}`,
          branchName
        );
        await this.writeLog(
          proposalId,
          EXECUTION_LOG_TYPES.GITHUB_COMMIT,
          EXECUTION_LOG_STATUS.SUCCESS,
          `Committed ${file.path}.`,
          { path: file.path, sha: result.sha, commitSha: result.commitSha, branchName }
        );
      } catch (err) {
        const message = err instanceof Error ? err.message : `Failed to commit ${file.path}.`;
        await this.writeLog(proposalId, EXECUTION_LOG_TYPES.GITHUB_COMMIT, EXECUTION_LOG_STATUS.FAILED, message, {
          path: file.path,
          branchName,
        });
        return { success: false, message, branchName };
      }
    }

    let prUrl: string;
    try {
      const pr = await github.createPullRequest(
        proposal.title,
        this.buildPrBody(proposal),
        branchName,
        config.defaultBranch
      );
      prUrl = pr.htmlUrl;
      await this.writeLog(proposalId, EXECUTION_LOG_TYPES.GITHUB_PR, EXECUTION_LOG_STATUS.SUCCESS, `PR #${pr.number} created.`, {
        prNumber: pr.number,
        prUrl,
        branchName,
        title: pr.title,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to create pull request.";
      await this.writeLog(proposalId, EXECUTION_LOG_TYPES.GITHUB_PR, EXECUTION_LOG_STATUS.FAILED, message, {
        branchName,
      });
      return { success: false, message, branchName };
    }

    const issueUrls: string[] = [];
    for (const task of proposal.tasksToCreate) {
      try {
        const issue = await github.createIssue(
          task,
          this.buildIssueBody(proposal, task),
          ["oceantechai", "proposal"]
        );
        issueUrls.push(issue.htmlUrl);
        await this.writeLog(
          proposalId,
          EXECUTION_LOG_TYPES.GITHUB_ISSUE,
          EXECUTION_LOG_STATUS.SUCCESS,
          `Issue #${issue.number} created: ${task}`,
          { issueNumber: issue.number, issueUrl: issue.htmlUrl, task }
        );
      } catch (err) {
        const message = err instanceof Error ? err.message : `Failed to create issue: ${task}`;
        await this.writeLog(proposalId, EXECUTION_LOG_TYPES.GITHUB_ISSUE, EXECUTION_LOG_STATUS.FAILED, message, {
          task,
        });
        return { success: false, message, prUrl, issueUrls, branchName };
      }
    }

    await learningCaptureService.captureFromExecution({
      projectId,
      proposalId,
      proposalTitle: proposal.title,
      result: { success: true, prUrl, issueUrls, branchName },
    });

    return { success: true, prUrl, issueUrls, branchName };
  }

  private async createBranchWithSuffix(
    github: IGitHubClient,
    proposal: { id: string; title: string }
  ): Promise<string> {
    const baseRef = await github.getDefaultBranchRef();

    for (let attempt = 1; attempt <= 10; attempt++) {
      const branchName = repositoryIntegrationService.buildBranchNameWithSuffix(
        proposal,
        attempt > 1 ? attempt : undefined
      );

      const exists = await github.branchExists(branchName);
      if (exists) {
        continue;
      }

      try {
        await github.createBranch(branchName, baseRef.sha);
        return branchName;
      } catch (err) {
        if (isGitHubRefExistsError(err)) {
          continue;
        }
        throw err;
      }
    }

    throw new Error("Could not create a unique branch name after 10 attempts.");
  }

  private buildPrBody(proposal: {
    id: string;
    summary: string;
    chosenSolution: string;
    tasksToCreate: string[];
  }): string {
    const tasks =
      proposal.tasksToCreate.length > 0
        ? proposal.tasksToCreate.map((t) => `- ${t}`).join("\n")
        : "_No tasks listed._";

    return `## Proposal Execution

**Proposal ID:** \`${proposal.id}\`

### Summary
${proposal.summary}

### Chosen Solution
${proposal.chosenSolution}

### Tasks
${tasks}

---
_Auto-generated by OceanTechAI Workspace._`;
  }

  private buildIssueBody(
    proposal: { id: string; title: string; summary: string },
    task: string
  ): string {
    return `## Task from Proposal

**Proposal:** ${proposal.title}
**Proposal ID:** \`${proposal.id}\`

### Task
${task}

### Context
${proposal.summary}

---
_Created by OceanTechAI Workspace execution layer._`;
  }

  private async writeLog(
    proposalId: string,
    type: string,
    status: string,
    message?: string,
    metadata?: ExecutionLogMetadata
  ) {
    await prisma.executionLog.create({
      data: {
        proposalId,
        type,
        status,
        message,
        metadata: metadata ?? undefined,
      },
    });
  }

  async getLogsForProposal(proposalId: string) {
    return prisma.executionLog.findMany({
      where: { proposalId },
      orderBy: { createdAt: "asc" },
    });
  }

  isGitHubConfigured(projectId: string): Promise<RepositoryValidationResult> {
    return repositoryIntegrationService.getConfig(projectId).then((config) => {
      const validation = repositoryIntegrationService.validateIntegration(config);
      return {
        configured: validation.valid,
        missing: validation.missing,
        source: config?.source ?? null,
        owner: config?.owner,
        repo: config?.repo,
      };
    });
  }
}

export interface RepositoryValidationResult {
  configured: boolean;
  missing: string[];
  source: "database" | "env" | null;
  owner?: string;
  repo?: string;
}

export const executionService = new ExecutionService();
