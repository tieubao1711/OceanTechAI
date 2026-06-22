import { DomainError } from "@/server/errors/domain-error";

export class GitHubError extends DomainError {
  readonly statusCode?: number;

  constructor(code: string, message: string, statusCode?: number) {
    super(code, message);
    this.name = "GitHubError";
    this.statusCode = statusCode;
  }
}

export function isGitHubRefExistsError(err: unknown): boolean {
  return (
    err instanceof GitHubError &&
    (err.code === "GITHUB_REF_EXISTS" || err.statusCode === 422)
  );
}
