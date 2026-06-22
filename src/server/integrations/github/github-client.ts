import { GitHubError } from "./github-errors";
import type {
  GitHubClientConfig,
  GitHubFileResult,
  GitHubIssue,
  GitHubPullRequest,
  GitRef,
  IGitHubClient,
} from "./github.types";

const GITHUB_API = "https://api.github.com";

export class GitHubClient implements IGitHubClient {
  constructor(private readonly config: GitHubClientConfig) {}

  private async request<T>(
    method: string,
    path: string,
    body?: unknown
  ): Promise<T> {
    const url = path.startsWith("http") ? path : `${GITHUB_API}${path}`;
    const response = await fetch(url, {
      method,
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${this.config.token}`,
        "X-GitHub-Api-Version": "2022-11-28",
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      const code =
        response.status === 422 && text.includes("Reference already exists")
          ? "GITHUB_REF_EXISTS"
          : "GITHUB_API_ERROR";
      throw new GitHubError(
        code,
        `GitHub API ${method} ${path} failed (${response.status}): ${text || response.statusText}`,
        response.status
      );
    }

    if (response.status === 204) {
      return undefined as T;
    }

    return response.json() as Promise<T>;
  }

  async getDefaultBranchRef(): Promise<GitRef> {
    const data = await this.request<{ object: { sha: string } }>(
      "GET",
      `/repos/${this.config.owner}/${this.config.repo}/git/ref/heads/${this.config.defaultBranch}`
    );
    return {
      ref: `refs/heads/${this.config.defaultBranch}`,
      sha: data.object.sha,
    };
  }

  async branchExists(branchName: string): Promise<boolean> {
    try {
      await this.request(
        "GET",
        `/repos/${this.config.owner}/${this.config.repo}/git/ref/heads/${branchName}`
      );
      return true;
    } catch (err) {
      if (err instanceof GitHubError && err.statusCode === 404) {
        return false;
      }
      throw err;
    }
  }

  async createBranch(branchName: string, baseSha: string): Promise<GitRef> {
    const data = await this.request<{ ref: string; object: { sha: string } }>(
      "POST",
      `/repos/${this.config.owner}/${this.config.repo}/git/refs`,
      { ref: `refs/heads/${branchName}`, sha: baseSha }
    );
    return { ref: data.ref, sha: data.object.sha };
  }

  async createOrUpdateFile(
    path: string,
    content: string,
    message: string,
    branch: string
  ): Promise<GitHubFileResult> {
    let existingSha: string | undefined;
    try {
      const existing = await this.request<{ sha: string }>(
        "GET",
        `/repos/${this.config.owner}/${this.config.repo}/contents/${encodeURIComponent(path)}?ref=${encodeURIComponent(branch)}`
      );
      existingSha = existing.sha;
    } catch (err) {
      if (!(err instanceof GitHubError && err.statusCode === 404)) {
        throw err;
      }
    }

    const data = await this.request<{
      content: { sha: string };
      commit: { sha: string };
    }>("PUT", `/repos/${this.config.owner}/${this.config.repo}/contents/${encodeURIComponent(path)}`, {
      message,
      content: Buffer.from(content, "utf8").toString("base64"),
      branch,
      ...(existingSha ? { sha: existingSha } : {}),
    });

    return {
      path,
      sha: data.content.sha,
      commitSha: data.commit.sha,
    };
  }

  async createPullRequest(
    title: string,
    body: string,
    head: string,
    base: string
  ): Promise<GitHubPullRequest> {
    const data = await this.request<{
      number: number;
      html_url: string;
      title: string;
    }>("POST", `/repos/${this.config.owner}/${this.config.repo}/pulls`, {
      title,
      body,
      head,
      base,
    });

    return {
      number: data.number,
      htmlUrl: data.html_url,
      title: data.title,
    };
  }

  async createIssue(
    title: string,
    body: string,
    labels?: string[]
  ): Promise<GitHubIssue> {
    const data = await this.request<{
      number: number;
      html_url: string;
      title: string;
    }>("POST", `/repos/${this.config.owner}/${this.config.repo}/issues`, {
      title,
      body,
      ...(labels?.length ? { labels } : {}),
    });

    return {
      number: data.number,
      htmlUrl: data.html_url,
      title: data.title,
    };
  }
}

export function createGitHubClient(config: GitHubClientConfig): IGitHubClient {
  return new GitHubClient(config);
}

export function createGitHubClientFromEnv(): IGitHubClient | null {
  const token = process.env.GITHUB_TOKEN?.trim();
  const owner = process.env.GITHUB_OWNER?.trim();
  const repo = process.env.GITHUB_REPO?.trim();
  const defaultBranch = process.env.GITHUB_DEFAULT_BRANCH?.trim() || "main";

  if (!token || !owner || !repo) {
    return null;
  }

  return createGitHubClient({ token, owner, repo, defaultBranch });
}
