import fs from "fs";
import path from "path";
import type { AuditFileMapEntry, ProjectKnowledgeSnapshot } from "./project-knowledge-types";

const AUDIT_FILE_CATEGORIES: AuditFileMapEntry[] = [
  {
    category: "AI Provider Layer",
    files: [
      "src/server/ai/providers/openai-provider.ts",
      "src/server/ai/providers/model-router.ts",
      "src/server/ai/providers/provider-registry.ts",
      "src/server/agents/agent-runner.ts",
    ],
  },
  {
    category: "Governance",
    files: [
      "src/server/governance/voting.service.ts",
      "src/server/governance/governance.service.ts",
      "src/server/governance/decision-classifier.ts",
    ],
  },
  {
    category: "GitHub Execution",
    files: [
      "src/server/execution/execution.service.ts",
      "src/server/integrations/github/github-client.ts",
      "src/server/integrations/repository/repository-integration.service.ts",
    ],
  },
  {
    category: "Debate Engine",
    files: [
      "src/server/debate/debate-orchestrator.ts",
      "src/server/debate/round-runner.ts",
      "src/server/debate/consensus-engine.ts",
    ],
  },
  {
    category: "Architecture Audit",
    files: [
      "src/server/audit/audit-orchestrator.ts",
      "src/server/audit/audit-consensus.ts",
      "src/server/audit/audit-quality.ts",
      "src/server/audit/audit-agent-runner.ts",
    ],
  },
  {
    category: "Project Knowledge",
    files: [
      "src/server/knowledge/project-knowledge-builder.ts",
      "src/server/knowledge/project-knowledge.service.ts",
    ],
  },
  {
    category: "Quality Gates",
    files: [
      "src/server/quality/agent-message-quality.ts",
      "src/server/quality/consensus-quality.ts",
    ],
  },
  {
    category: "Executive & Insights",
    files: [
      "src/server/insights/reputation.service.ts",
      "src/server/insights/executive-briefing.service.ts",
      "src/server/recommendations/recommendation-engine.ts",
    ],
  },
];

const MODULE_LABELS: Record<string, string> = {
  debate: "Debate Engine",
  governance: "Governance",
  memory: "Memory Architecture",
  proposals: "Proposal & Markdown Generation",
  execution: "GitHub Execution",
  integrations: "External Integrations",
  recommendations: "Recommendation Engine",
  journals: "Agent Journal System",
  insights: "Executive Briefing & Decision Learning",
  autonomous: "Autonomous Suggestions",
  agents: "Agent Runner & Profiles",
  quality: "Quality Gates",
  ai: "AI Provider Layer",
  knowledge: "Project Knowledge Snapshot",
};

function workspaceRoot(): string {
  return process.cwd();
}

function readTextSafe(filePath: string): string {
  try {
    return fs.readFileSync(filePath, "utf8");
  } catch {
    return "";
  }
}

function listDirs(dirPath: string): string[] {
  try {
    return fs
      .readdirSync(dirPath, { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .map((e) => e.name)
      .sort();
  } catch {
    return [];
  }
}

function globFiles(dir: string, pattern: RegExp, max = 50): string[] {
  const results: string[] = [];
  function walk(current: string) {
    if (results.length >= max) return;
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(current, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (results.length >= max) break;
      const full = path.join(current, entry.name);
      if (entry.isDirectory() && !entry.name.startsWith(".") && entry.name !== "node_modules") {
        walk(full);
      } else if (entry.isFile() && pattern.test(entry.name)) {
        results.push(path.relative(workspaceRoot(), full).replace(/\\/g, "/"));
      }
    }
  }
  walk(dir);
  return results.sort();
}

function extractPrismaModels(schema: string): string[] {
  return [...schema.matchAll(/^model\s+(\w+)\s+\{/gm)].map((m) => m[1]);
}

function extractPackageScripts(pkg: { scripts?: Record<string, string> }): string[] {
  return Object.keys(pkg.scripts ?? {}).sort();
}

function extractIntegrations(serverDir: string): string[] {
  const integrationsDir = path.join(serverDir, "integrations");
  const names = listDirs(integrationsDir).map((d) => d.replace(/-/g, " "));
  const deps: string[] = [];
  const pkg = JSON.parse(readTextSafe(path.join(workspaceRoot(), "package.json")) || "{}");
  if (pkg.dependencies?.openai) deps.push("OpenAI");
  if (names.some((n) => n.includes("github"))) deps.push("GitHub");
  return [...new Set([...deps, ...names.map((n) => n.charAt(0).toUpperCase() + n.slice(1))])];
}

function extractFeatures(docsDir: string): string[] {
  const features: string[] = [];
  const decisions = globFiles(docsDir, /^ADR-.*\.md$/i, 20);
  for (const adr of decisions) {
    features.push(adr.replace("docs/decisions/", "").replace(".md", ""));
  }
  const companyDocs = globFiles(path.join(docsDir, "company"), /\.md$/i, 10);
  const archDocs = globFiles(path.join(docsDir, "architecture"), /\.md$/i, 10);
  return [
    ...features,
    ...companyDocs.map((f) => f.replace("docs/", "")),
    ...archDocs.map((f) => f.replace("docs/", "")),
  ].slice(0, 30);
}

function buildAuditFileMap(root: string): AuditFileMapEntry[] {
  return AUDIT_FILE_CATEGORIES.map((entry) => ({
    category: entry.category,
    files: entry.files.filter((f) => {
      try {
        return fs.existsSync(path.join(root, f));
      } catch {
        return false;
      }
    }),
  })).filter((entry) => entry.files.length > 0);
}

function buildArchitectureSummary(snapshot: Omit<ProjectKnowledgeSnapshot, "architectureSummary">): string {
  return [
    "OceanTechAI Workspace is an AI Company Operating System built on Next.js 15, TypeScript, Prisma, PostgreSQL.",
    `Pipeline: User Input → AI Debate → Consensus → Founder Approval → Execution.`,
    `Server modules: ${snapshot.existingModules.join(", ")}.`,
    `Integrations: ${snapshot.existingIntegrations.join(", ")}.`,
    `Test suite: ${snapshot.existingTests.length} unit/integration test files.`,
  ].join(" ");
}

export class ProjectKnowledgeBuilder {
  buildFromFilesystem(): ProjectKnowledgeSnapshot {
    const root = workspaceRoot();
    const serverDir = path.join(root, "src", "server");
    const appDir = path.join(root, "src", "app");
    const docsDir = path.join(root, "docs");
    const testsDir = path.join(root, "tests");

    const moduleDirs = listDirs(serverDir).filter(
      (d) => !["db", "contracts", "errors", "invariants"].includes(d)
    );

    const existingModules = moduleDirs.map((d) => MODULE_LABELS[d] ?? d);

    const existingServices = globFiles(serverDir, /\.service\.ts$/, 40).map((f) =>
      path.basename(f).replace(".service.ts", "")
    );

    const existingPages = globFiles(appDir, /^page\.tsx$/, 30).map((f) => {
      const route = path.dirname(f).replace("src/app", "").replace(/\\/g, "/") || "/";
      return route;
    });

    const existingTests = globFiles(testsDir, /\.test\.ts$/, 50);

    const pkgRaw = readTextSafe(path.join(root, "package.json"));
    const pkg = pkgRaw ? JSON.parse(pkgRaw) : {};

    const schema = readTextSafe(path.join(root, "prisma", "schema.prisma"));
    const prismaModels = extractPrismaModels(schema);

    const adrFiles = globFiles(path.join(docsDir, "decisions"), /^ADR-.*\.md$/i, 10);
    const recentADRs = adrFiles.map((f) => {
      const content = readTextSafe(path.join(root, f));
      const title = content.match(/^#\s+(.+)$/m)?.[1] ?? f;
      return title;
    });

    const knownConstraints = [
      "Founder approval required before generated files and GitHub execution",
      "No auto-execute on approve or autonomous suggestions",
      "No SaaS, billing, or multi-user (MVP constraint)",
      "Human action mandatory for GitHub execution",
      "Mock mode must remain functional without API keys",
    ];

    const readme = readTextSafe(path.join(root, "README.md"));
    if (readme.includes("Dogfooding")) {
      knownConstraints.push("OceanTechAI dogfoods itself via OceanTechAI Core project");
    }

    const partial = {
      existingModules,
      existingFeatures: extractFeatures(docsDir),
      existingTests,
      existingPages,
      existingServices,
      existingIntegrations: extractIntegrations(serverDir),
      knownConstraints,
      recentADRs,
      recentDecisions: [
        "ADR-001: AI Debate Required",
        "ADR-002: Human Approval Required",
        "ADR-003: Markdown as Source of Truth",
        "ADR-004: Self-Improvement Requires Founder Approval",
      ],
      prismaModels,
      packageScripts: extractPackageScripts(pkg),
      auditFileMap: buildAuditFileMap(root),
    };

    return {
      architectureSummary: buildArchitectureSummary(partial),
      ...partial,
    };
  }
}

export const projectKnowledgeBuilder = new ProjectKnowledgeBuilder();
