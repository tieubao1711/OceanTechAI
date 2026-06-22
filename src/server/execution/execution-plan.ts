export const EXECUTION_LOG_TYPES = {
  GENERATE_FILES: "GENERATE_FILES",
  GITHUB_BRANCH: "GITHUB_BRANCH",
  GITHUB_COMMIT: "GITHUB_COMMIT",
  GITHUB_PR: "GITHUB_PR",
  GITHUB_ISSUE: "GITHUB_ISSUE",
} as const;

export type ExecutionLogType =
  (typeof EXECUTION_LOG_TYPES)[keyof typeof EXECUTION_LOG_TYPES];

export const EXECUTION_LOG_STATUS = {
  PENDING: "PENDING",
  SUCCESS: "SUCCESS",
  FAILED: "FAILED",
} as const;

export type ExecutionLogStatus =
  (typeof EXECUTION_LOG_STATUS)[keyof typeof EXECUTION_LOG_STATUS];

export interface ExecutionResult {
  success: boolean;
  skipped?: boolean;
  prUrl?: string;
  issueUrls?: string[];
  branchName?: string;
  message?: string;
}
