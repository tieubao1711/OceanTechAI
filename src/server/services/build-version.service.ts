import { readFileSync } from "fs";
import path from "path";

const SEMVER_PATTERN = /^\d+\.\d+\.\d+(-[\w.+-]+)?$/;

export type BuildVersionInfo = {
  version: string;
  buildDate: string | null;
};

function sanitizeVersion(raw: string): string {
  const trimmed = raw.trim();
  if (!SEMVER_PATTERN.test(trimmed)) {
    return "0.0.0";
  }
  return trimmed;
}

export class BuildVersionService {
  getVersionInfo(): BuildVersionInfo {
    const fromEnv = process.env.APP_VERSION;
    const version = fromEnv ? sanitizeVersion(fromEnv) : this.readFromPackageJson();
    const buildDate = process.env.BUILD_DATE?.trim() || null;

    return { version, buildDate };
  }

  private readFromPackageJson(): string {
    try {
      const pkgPath = path.join(process.cwd(), "package.json");
      const pkg = JSON.parse(readFileSync(pkgPath, "utf-8")) as { version?: string };
      return sanitizeVersion(String(pkg.version ?? "0.0.0"));
    } catch {
      return "0.0.0";
    }
  }
}

export const buildVersionService = new BuildVersionService();
