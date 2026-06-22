import { prisma } from "@/server/db/prisma";
import { extractFeatureSlug } from "@/lib/utils";
import type { Proposal } from "@prisma/client";

export interface RepositoryConfig {
  provider: string;
  owner: string;
  repo: string;
  defaultBranch: string;
  token: string | null;
  source: "database" | "env";
}

export interface RepositoryValidation {
  valid: boolean;
  missing: string[];
  config: RepositoryConfig | null;
}

export class RepositoryIntegrationService {
  async getConfig(projectId: string): Promise<RepositoryConfig | null> {
    const dbConfig = await prisma.repositoryIntegration.findUnique({
      where: { projectId, isActive: true },
    });

    if (dbConfig) {
      return {
        provider: dbConfig.provider,
        owner: dbConfig.owner,
        repo: dbConfig.repo,
        defaultBranch: dbConfig.defaultBranch,
        token: dbConfig.tokenEncrypted ?? process.env.GITHUB_TOKEN?.trim() ?? null,
        source: "database",
      };
    }

    const token = process.env.GITHUB_TOKEN?.trim();
    const owner = process.env.GITHUB_OWNER?.trim();
    const repo = process.env.GITHUB_REPO?.trim();
    const defaultBranch = process.env.GITHUB_DEFAULT_BRANCH?.trim() || "main";

    if (!owner || !repo) {
      return null;
    }

    return {
      provider: "github",
      owner,
      repo,
      defaultBranch,
      token: token ?? null,
      source: "env",
    };
  }

  validateIntegration(config: RepositoryConfig | null): RepositoryValidation {
    if (!config) {
      return {
        valid: false,
        missing: ["GITHUB_OWNER", "GITHUB_REPO"],
        config: null,
      };
    }

    const missing: string[] = [];
    if (!config.token) missing.push("GITHUB_TOKEN");
    if (!config.owner) missing.push("GITHUB_OWNER");
    if (!config.repo) missing.push("GITHUB_REPO");

    return {
      valid: missing.length === 0,
      missing,
      config,
    };
  }

  buildBranchName(proposal: Pick<Proposal, "id" | "title">): string {
    const slug = extractFeatureSlug(proposal.title);
    const shortId = proposal.id.slice(0, 8);
    return `proposal/${slug}-${shortId}`;
  }

  buildBranchNameWithSuffix(
    proposal: Pick<Proposal, "id" | "title">,
    suffix?: number
  ): string {
    const base = this.buildBranchName(proposal);
    return suffix && suffix > 1 ? `${base}-${suffix}` : base;
  }
}

export const repositoryIntegrationService = new RepositoryIntegrationService();
