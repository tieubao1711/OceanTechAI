import { describe, it, expect, vi, beforeEach } from "vitest";

import { GovernanceError } from "@/server/errors/governance-error";

import { ExecutionService } from "@/server/execution/execution.service";

import { EXECUTION_LOG_TYPES, EXECUTION_LOG_STATUS } from "@/server/execution/execution-plan";

import type { IGitHubClient } from "@/server/integrations/github/github.types";



const proposalId = "prop-exec-test-001";

const projectId = "proj-exec-test-001";



const mockProposal = {

  id: proposalId,

  discussionId: "disc-1",

  title: "Design Crew System for the MMO game",

  summary: "Crew system MVP",

  alternativesConsidered: [],

  chosenSolution: "MVP crew",

  reasoning: [],

  risks: [],

  filesToCreate: ["docs/features/crew-system.md"],

  tasksToCreate: ["Implement crew roster", "Add crew UI"],

  voteClassification: "weak",

  qualityScore: 80,

  status: "APPROVED" as const,

  createdAt: new Date(),

  updatedAt: new Date(),

  generatedFiles: [

    {

      id: "gf-1",

      proposalId,

      path: "docs/features/crew-system.md",

      content: "# Crew System",

      mimeType: "text/markdown",

      createdAt: new Date(),

    },

  ],

  executionLogs: [] as Array<{

    id: string;

    proposalId: string;

    type: string;

    status: string;

    message: string | null;

    metadata: unknown;

    createdAt: Date;

  }>,

  discussion: {

    projectId,

    project: { id: projectId, name: "Test" },

  },

};



const executionLogs: typeof mockProposal.executionLogs = [];



vi.mock("@/server/learning/learning-capture.service", () => ({
  learningCaptureService: {
    captureFromExecution: vi.fn(async () => null),
  },
}));

vi.mock("@/server/db/prisma", () => ({

  prisma: {

    proposal: {

      findUniqueOrThrow: vi.fn(async () => ({

        ...mockProposal,

        executionLogs: [...executionLogs],

      })),

    },

    executionLog: {

      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {

        const entry = {

          id: `log-${executionLogs.length + 1}`,

          proposalId: data.proposalId as string,

          type: data.type as string,

          status: data.status as string,

          message: (data.message as string) ?? null,

          metadata: data.metadata ?? null,

          createdAt: new Date(),

        };

        executionLogs.push(entry);

        return entry;

      }),

    },

  },

}));



vi.mock("@/server/integrations/repository/repository-integration.service", () => ({

  repositoryIntegrationService: {

    getConfig: vi.fn(async () => ({

      provider: "github",

      owner: "test-org",

      repo: "test-repo",

      defaultBranch: "main",

      token: "ghp_test",

      source: "env" as const,

    })),

    validateIntegration: vi.fn((config: { token: string | null } | null) => {

      if (!config?.token) {

        return { valid: false, missing: ["GITHUB_TOKEN"], config };

      }

      return { valid: true, missing: [], config };

    }),

    buildBranchName: vi.fn(() => "proposal/crew-system-prop-exe"),

    buildBranchNameWithSuffix: vi.fn((_p: unknown, suffix?: number) =>

      suffix && suffix > 1 ? `proposal/crew-system-prop-exe-${suffix}` : "proposal/crew-system-prop-exe"

    ),

  },

}));



function createMockGitHubClient(): IGitHubClient {

  return {

    getDefaultBranchRef: vi.fn(async () => ({ ref: "refs/heads/main", sha: "abc123" })),

    createBranch: vi.fn(async (name: string) => ({ ref: `refs/heads/${name}`, sha: "branch-sha" })),

    branchExists: vi.fn(async () => false),

    createOrUpdateFile: vi.fn(async (path: string) => ({

      path,

      sha: "file-sha",

      commitSha: "commit-sha",

    })),

    createPullRequest: vi.fn(async () => ({

      number: 42,

      htmlUrl: "https://github.com/test-org/test-repo/pull/42",

      title: "Design Crew System",

    })),

    createIssue: vi.fn(async (title: string) => ({

      number: Math.floor(Math.random() * 1000),

      htmlUrl: `https://github.com/test-org/test-repo/issues/${title.length}`,

      title,

    })),

  };

}



describe("ExecutionService", () => {

  const service = new ExecutionService();



  beforeEach(() => {

    executionLogs.length = 0;

    mockProposal.status = "APPROVED";

    mockProposal.generatedFiles = [

      {

        id: "gf-1",

        proposalId,

        path: "docs/features/crew-system.md",

        content: "# Crew System",

        mimeType: "text/markdown",

        createdAt: new Date(),

      },

    ];

    mockProposal.executionLogs = [];

  });



  it("executes approved proposal: branch, commits, PR, issues", async () => {

    const github = createMockGitHubClient();

    const result = await service.executeApprovedProposal(proposalId, { githubClient: github });



    expect(result.success).toBe(true);

    expect(result.prUrl).toBe("https://github.com/test-org/test-repo/pull/42");

    expect(result.issueUrls).toHaveLength(2);

    expect(github.createBranch).toHaveBeenCalled();

    expect(github.createOrUpdateFile).toHaveBeenCalledTimes(1);

    expect(github.createPullRequest).toHaveBeenCalled();

    expect(github.createIssue).toHaveBeenCalledTimes(2);



    const types = executionLogs.map((l) => l.type);

    expect(types).toContain(EXECUTION_LOG_TYPES.GENERATE_FILES);

    expect(types).toContain(EXECUTION_LOG_TYPES.GITHUB_BRANCH);

    expect(types).toContain(EXECUTION_LOG_TYPES.GITHUB_COMMIT);

    expect(types).toContain(EXECUTION_LOG_TYPES.GITHUB_PR);

    expect(types.filter((t) => t === EXECUTION_LOG_TYPES.GITHUB_ISSUE)).toHaveLength(2);

  });



  it("blocks execution when proposal is not approved", async () => {

    mockProposal.status = "PENDING";

    const github = createMockGitHubClient();



    await expect(

      service.executeApprovedProposal(proposalId, { githubClient: github })

    ).rejects.toSatisfy((err: unknown) => {

      return err instanceof GovernanceError && err.code === "PROPOSAL_NOT_APPROVED";

    });



    expect(github.createBranch).not.toHaveBeenCalled();

  });



  it("creates failed log when token is missing", async () => {

    const { repositoryIntegrationService } = await import(

      "@/server/integrations/repository/repository-integration.service"

    );

    vi.mocked(repositoryIntegrationService.validateIntegration).mockReturnValueOnce({

      valid: false,

      missing: ["GITHUB_TOKEN"],

      config: {

        provider: "github",

        owner: "test-org",

        repo: "test-repo",

        defaultBranch: "main",

        token: null,

        source: "env",

      },

    });



    const result = await service.executeApprovedProposal(proposalId);



    expect(result.success).toBe(false);

    expect(result.message).toContain("GITHUB_TOKEN");

    const failedBranch = executionLogs.find(

      (l) => l.type === EXECUTION_LOG_TYPES.GITHUB_BRANCH && l.status === EXECUTION_LOG_STATUS.FAILED

    );

    expect(failedBranch).toBeDefined();

  });



  it("skips duplicate PR when success log already exists", async () => {

    executionLogs.push({

      id: "existing-pr",

      proposalId,

      type: EXECUTION_LOG_TYPES.GITHUB_PR,

      status: EXECUTION_LOG_STATUS.SUCCESS,

      message: "PR already created",

      metadata: {

        prUrl: "https://github.com/test-org/test-repo/pull/1",

        branchName: "proposal/crew-system-prop-exe",

      },

      createdAt: new Date(),

    });



    const github = createMockGitHubClient();

    const result = await service.executeApprovedProposal(proposalId, { githubClient: github });



    expect(result.success).toBe(true);

    expect(result.skipped).toBe(true);

    expect(result.prUrl).toBe("https://github.com/test-org/test-repo/pull/1");

    expect(github.createPullRequest).not.toHaveBeenCalled();

    expect(github.createBranch).not.toHaveBeenCalled();

  });



  it("stops execution and logs failed commit on file error", async () => {

    const github = createMockGitHubClient();

    vi.mocked(github.createOrUpdateFile).mockRejectedValueOnce(new Error("Commit failed"));



    const result = await service.executeApprovedProposal(proposalId, { githubClient: github });



    expect(result.success).toBe(false);

    expect(result.message).toContain("Commit failed");

    const failedCommit = executionLogs.find(

      (l) => l.type === EXECUTION_LOG_TYPES.GITHUB_COMMIT && l.status === EXECUTION_LOG_STATUS.FAILED

    );

    expect(failedCommit).toBeDefined();

    expect(github.createPullRequest).not.toHaveBeenCalled();

  });

});


