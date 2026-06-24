import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";
import { readFileSync } from "fs";
import path from "path";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

function loadPackageVersion(): string {
  try {
    const pkg = JSON.parse(
      readFileSync(path.join(process.cwd(), "package.json"), "utf-8")
    ) as { version?: string };
    return String(pkg.version ?? "0.1.0");
  } catch {
    return "0.1.0";
  }
}

const nextConfig: NextConfig = {
  env: {
    APP_VERSION: loadPackageVersion(),
    BUILD_DATE: new Date().toISOString(),
  },
};

export default withNextIntl(nextConfig);
