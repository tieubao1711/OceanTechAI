/**
 * Local setup checklist — verifies env, DB, and optional integrations.
 * Does not crash on missing OpenAI/GitHub; prints warnings and next steps.
 */
import fs from "fs";
import path from "path";
import { PrismaClient } from "@prisma/client";

const ROOT = path.resolve(__dirname, "..");
const ENV_PATH = path.join(ROOT, ".env");
const ENV_EXAMPLE_PATH = path.join(ROOT, ".env.example");

function loadEnvFile(filePath: string): Record<string, string> {
  if (!fs.existsSync(filePath)) return {};
  const content = fs.readFileSync(filePath, "utf8");
  const vars: Record<string, string> = {};
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    vars[key] = value;
    if (!process.env[key]) process.env[key] = value;
  }
  return vars;
}

function status(ok: boolean): string {
  return ok ? "✓" : "✗";
}

async function checkDatabase(url: string | undefined): Promise<boolean> {
  if (!url) return false;
  const prisma = new PrismaClient({ datasourceUrl: url });
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch {
    return false;
  } finally {
    await prisma.$disconnect();
  }
}

async function main() {
  console.log("=== OceanTechAI Local Setup Checklist ===\n");

  const hasEnv = fs.existsSync(ENV_PATH);
  const hasExample = fs.existsSync(ENV_EXAMPLE_PATH);

  console.log(`${status(hasEnv)} .env file ${hasEnv ? "found" : "missing"}`);
  if (!hasEnv && hasExample) {
    console.log("  → Run: cp .env.example .env");
  }

  if (hasEnv) loadEnvFile(ENV_PATH);

  const databaseUrl = process.env.DATABASE_URL?.trim();
  console.log(`${status(!!databaseUrl)} DATABASE_URL ${databaseUrl ? "set" : "not set"}`);

  let dbReachable = false;
  if (databaseUrl) {
    dbReachable = await checkDatabase(databaseUrl);
    console.log(`${status(dbReachable)} Database reachable`);
    if (!dbReachable) {
      console.log("  → Ensure PostgreSQL is running and database exists");
      console.log("  → Check DATABASE_URL credentials in .env");
    }
  }

  const aiMode = process.env.AI_PROVIDER_MODE?.trim() || "mock";
  console.log(`\n--- AI Provider ---`);
  console.log(`  AI_PROVIDER_MODE: ${aiMode}`);
  const openaiKey = process.env.OPENAI_API_KEY?.trim();
  if (openaiKey) {
    console.log(`  ✓ OPENAI_API_KEY set (${openaiKey.slice(0, 7)}...)`);
  } else {
    console.log(`  ⚠ OPENAI_API_KEY not set — mock mode will be used`);
  }
  if (aiMode === "openai" && !openaiKey) {
    console.log(`  ⚠ openai mode without key — runtime falls back to mock`);
  }

  console.log(`\n--- GitHub (optional) ---`);
  const ghToken = process.env.GITHUB_TOKEN?.trim();
  const ghOwner = process.env.GITHUB_OWNER?.trim();
  const ghRepo = process.env.GITHUB_REPO?.trim();
  const ghBranch = process.env.GITHUB_DEFAULT_BRANCH?.trim() || "main";
  const ghReady = !!(ghToken && ghOwner && ghRepo);
  console.log(`  GITHUB_TOKEN: ${ghToken ? "set" : "not set"}`);
  console.log(`  GITHUB_OWNER: ${ghOwner || "not set"}`);
  console.log(`  GITHUB_REPO: ${ghRepo || "not set"}`);
  console.log(`  GITHUB_DEFAULT_BRANCH: ${ghBranch}`);
  if (!ghReady) {
    console.log(`  ⚠ GitHub execution disabled until all three token/owner/repo are set`);
  } else {
    console.log(`  ✓ GitHub execution can be configured`);
  }

  let prismaClientOk = false;
  try {
    const clientPath = path.join(ROOT, "node_modules", ".prisma", "client", "index.js");
    prismaClientOk = fs.existsSync(clientPath);
  } catch {
    prismaClientOk = false;
  }
  console.log(`\n--- Prisma ---`);
  console.log(`${status(prismaClientOk)} Prisma client generated`);
  if (!prismaClientOk) {
    console.log("  → Run: npx prisma generate");
  }

  console.log(`\n--- Recommended next steps ---`);
  const steps: string[] = ["npm install"];
  if (!hasEnv) steps.push("cp .env.example .env  # then edit DATABASE_URL");
  if (!prismaClientOk) steps.push("npx prisma generate");
  if (databaseUrl) steps.push("npm run db:push");
  if (databaseUrl && dbReachable) {
    steps.push("npm run db:seed");
    steps.push("npm run self:test");
  }
  steps.push("npm run dev");

  steps.forEach((s, i) => console.log(`  ${i + 1}. ${s}`));

  console.log(`\n--- After dev server ---`);
  console.log(`  Executive Dashboard: http://localhost:3001/projects/oceantechai-core/executive`);
  console.log(`  Dogfooding guide:    docs/DOGFOODING_GUIDE.md`);

  if (!hasEnv || !databaseUrl) {
    console.log("\n⚠ Setup incomplete — configure .env first.");
    process.exit(0);
  }

  if (!dbReachable) {
    console.log("\n⚠ Database not reachable — fix DATABASE_URL before db:push/seed/self:test.");
    process.exit(0);
  }

  console.log("\n✓ Environment looks ready for db:push → db:seed → self:test");
}

main().catch((err) => {
  console.error("Setup check failed:", err);
  process.exit(1);
});
