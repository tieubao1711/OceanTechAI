export interface GitHubClientConfig {
  token: string;
  owner: string;
  repo: string;
  defaultBranch: string;
}

export interface GitRef {
  ref: string;
  sha: string;
}

export interface GitHubFileResult {
  path: string;
  sha: string;
  commitSha: string;
}

export interface GitHubPullRequest {
  number: number;
  htmlUrl: string;
  title: string;
}

export interface GitHubIssue {
  number: number;
  htmlUrl: string;
  title: string;
}

export interface IGitHubClient {
  getDefaultBranchRef(): Promise<GitRef>;
  createBranch(branchName: string, baseSha: string): Promise<GitRef>;
  branchExists(branchName: string): Promise<boolean>;
  createOrUpdateFile(
    path: string,
    content: string,
    message: string,
    branch: string
  ): Promise<GitHubFileResult>;
  createPullRequest(
    title: string,
    body: string,
    head: string,
    base: string
  ): Promise<GitHubPullRequest>;
  createIssue(
    title: string,
    body: string,
    labels?: string[]
  ): Promise<GitHubIssue>;
}
