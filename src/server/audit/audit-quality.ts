import { z } from "zod";
import type { ProjectKnowledgeSnapshot } from "@/server/knowledge/project-knowledge-types";
import type {
  AuditFinding,
  AuditScore,
  ArchitectureAuditReport,
} from "./audit-types";

export const EVIDENCE_MIN_LENGTH = 20;
export const FILE_OR_MODULE_MIN_LENGTH = 3;

export const AuditFindingSchema = z.object({
  title: z.string().min(5),
  fileOrModule: z.string().min(FILE_OR_MODULE_MIN_LENGTH),
  evidence: z.string().min(EVIDENCE_MIN_LENGTH),
  impact: z.string().min(10),
  fixScope: z.enum(["small", "medium", "large"]),
  priority: z.enum(["low", "medium", "high", "critical"]),
});

export const AuditCritiqueSchema = z.object({
  targetFindingTitle: z.string().min(3),
  verdict: z.enum(["agree", "disagree", "missing_evidence", "wrong_priority"]),
  reason: z.string().min(10),
});

const GENERIC_ADVICE_PATTERNS = [
  /\bbetter\s+architecture\b/i,
  /\bneed\s+scalability\b/i,
  /\bneed\s+(more\s+)?tests?\b/i,
  /\bneed\s+more\s+testing\b/i,
  /\bapi\s+version/i,
  /\bneed\s+github\b/i,
  /\bneed\s+memory\b/i,
];

const GENERIC_LABEL_PATTERNS = [
  /^architecture$/i,
  /^scalability$/i,
  /^testing$/i,
  /^external integrations$/i,
];

const BROAD_CATEGORY_PATTERNS = [
  /^external integrations$/i,
  /^governance$/i,
  /^ai provider layer$/i,
  /^ai provider$/i,
  /^agent runner/i,
  /^debate engine$/i,
  /^github execution$/i,
  /^quality gates$/i,
  /^project knowledge/i,
  /^executive/i,
  /^memory architecture$/i,
];

export function isFileLevelReference(fileOrModule: string): boolean {
  const f = fileOrModule.trim();
  if (f.includes("src/")) return true;
  if (f.endsWith(".ts") || f.endsWith(".tsx") || f.endsWith(".prisma")) return true;
  return false;
}

export function isBroadCategoryReference(fileOrModule: string): boolean {
  const f = fileOrModule.trim();
  if (isFileLevelReference(f)) return false;
  return BROAD_CATEGORY_PATTERNS.some((p) => p.test(f));
}

export function parseAuditFindings(raw: unknown): AuditFinding[] {
  if (!Array.isArray(raw)) return [];
  const findings: AuditFinding[] = [];
  for (const item of raw) {
    const result = AuditFindingSchema.safeParse(item);
    if (result.success) findings.push(result.data);
  }
  return findings;
}

export function parseAuditCritiques(raw: unknown) {
  if (!Array.isArray(raw)) return [];
  const critiques = [];
  for (const item of raw) {
    const result = AuditCritiqueSchema.safeParse(item);
    if (result.success) critiques.push(result.data);
  }
  return critiques;
}

export function hasModuleReference(text: string, snapshot?: ProjectKnowledgeSnapshot): boolean {
  if (isFileLevelReference(text)) return true;
  const lower = text.toLowerCase();
  if (!snapshot) return false;
  const markers = [
    ...snapshot.existingServices.map((s) => s.toLowerCase()),
    ...snapshot.existingModules.map((m) => m.toLowerCase()),
  ];
  return markers.some((m) => lower.includes(m));
}

export function validateFinding(
  finding: AuditFinding,
  snapshot?: ProjectKnowledgeSnapshot
): { valid: boolean; reason?: string } {
  if (finding.fileOrModule.trim().length < FILE_OR_MODULE_MIN_LENGTH) {
    return { valid: false, reason: "fileOrModule too short" };
  }
  if (finding.evidence.trim().length < EVIDENCE_MIN_LENGTH) {
    return { valid: false, reason: "evidence below threshold" };
  }
  if (!isFileLevelReference(finding.fileOrModule)) {
    return { valid: false, reason: "fileOrModule must be a src/ file path, not a broad category" };
  }
  const blob = `${finding.title} ${finding.fileOrModule} ${finding.evidence}`;
  if (GENERIC_ADVICE_PATTERNS.some((p) => p.test(blob))) {
    return { valid: false, reason: "generic architectural advice" };
  }
  if (GENERIC_LABEL_PATTERNS.some((p) => p.test(finding.fileOrModule.trim()))) {
    return { valid: false, reason: "generic category label, not a file path" };
  }
  if (snapshot?.auditFileMap?.length) {
    const knownFiles = snapshot.auditFileMap.flatMap((e) => e.files);
    const matchesKnown = knownFiles.some(
      (f) =>
        finding.fileOrModule.includes(f) ||
        f.includes(finding.fileOrModule.replace(/^src\//, ""))
    );
    if (!matchesKnown && !finding.fileOrModule.startsWith("src/server/")) {
      return { valid: false, reason: "fileOrModule not in FILE-LEVEL AUDIT MAP" };
    }
  }
  return { valid: true };
}

export function filterValidFindings(
  findings: AuditFinding[],
  snapshot?: ProjectKnowledgeSnapshot
): AuditFinding[] {
  return findings.filter((f) => validateFinding(f, snapshot).valid).slice(0, 5);
}

export function isGenericAdvice(text: string): boolean {
  return (
    GENERIC_ADVICE_PATTERNS.some((p) => p.test(text)) ||
    GENERIC_LABEL_PATTERNS.some((p) => p.test(text.trim()))
  );
}

export function classifyFindingSpecificity(finding: AuditFinding): "good" | "bad" | "neutral" {
  const blob = `${finding.title} ${finding.fileOrModule} ${finding.evidence}`;
  if (isGenericAdvice(blob) || GENERIC_LABEL_PATTERNS.some((p) => p.test(finding.title.trim()))) {
    return "bad";
  }
  if (isFileLevelReference(finding.fileOrModule)) return "good";
  if (isBroadCategoryReference(finding.fileOrModule)) return "neutral";
  return "neutral";
}

export function classifyDebtSpecificity(text: string): "good" | "bad" | "neutral" {
  const lower = text.toLowerCase();
  if (isGenericAdvice(lower)) return "bad";
  if (isFileLevelReference(text)) return "good";
  if (BROAD_CATEGORY_PATTERNS.some((p) => p.test(text.trim()))) return "neutral";
  return "neutral";
}

const PRIORITY_WEIGHT: Record<AuditFinding["priority"], number> = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1,
};

const FIX_SCOPE_WEIGHT: Record<AuditFinding["fixScope"], number> = {
  small: 3,
  medium: 2,
  large: 1,
};

export function rankFindings(findings: AuditFinding[]): AuditFinding[] {
  return [...findings].sort((a, b) => {
    const pw = PRIORITY_WEIGHT[b.priority] - PRIORITY_WEIGHT[a.priority];
    if (pw !== 0) return pw;
    return FIX_SCOPE_WEIGHT[b.fixScope] - FIX_SCOPE_WEIGHT[a.fixScope];
  });
}

export function normalizeFindingKey(finding: AuditFinding): string {
  return `${finding.title.toLowerCase().trim()}|${finding.fileOrModule.toLowerCase().trim()}`;
}

export function mergeDuplicateFindings(findings: AuditFinding[]): AuditFinding[] {
  const seen = new Map<string, AuditFinding>();
  for (const f of rankFindings(findings)) {
    const key = normalizeFindingKey(f);
    if (!seen.has(key)) seen.set(key, f);
  }
  return rankFindings([...seen.values()]);
}

export function calculateAuditScore(
  findings: AuditFinding[],
  snapshot?: ProjectKnowledgeSnapshot
): AuditScore {
  if (findings.length === 0) {
    return {
      specificity: 0,
      evidenceQuality: 0,
      implementationReadiness: 0,
      hallucinationRisk: 100,
    };
  }

  let specific = 0;
  let evidenceOk = 0;
  let ready = 0;
  let generic = 0;

  for (const f of findings) {
    const blob = `${f.title} ${f.fileOrModule} ${f.evidence} ${f.impact}`;
    if (isFileLevelReference(f.fileOrModule)) specific++;
    if (f.evidence.length >= EVIDENCE_MIN_LENGTH && validateFinding(f, snapshot).valid) {
      evidenceOk++;
    }
    if (
      (f.fixScope === "small" || f.fixScope === "medium") &&
      isFileLevelReference(f.fileOrModule)
    ) {
      ready++;
    }
    if (isGenericAdvice(blob)) generic++;
  }

  const n = findings.length;
  return {
    specificity: Math.round((specific / n) * 100),
    evidenceQuality: Math.round((evidenceOk / n) * 100),
    implementationReadiness: Math.round((ready / n) * 100),
    hallucinationRisk: Math.round((generic / n) * 100),
  };
}

export function parseArchitectureAuditReport(raw: unknown): ArchitectureAuditReport | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;
  if (!Array.isArray(obj.topFindings)) return null;
  const topFindings = parseAuditFindings(obj.topFindings);
  const auditScore = obj.auditScore as AuditScore | undefined;
  if (!auditScore) return null;
  return {
    topFindings,
    strengths: Array.isArray(obj.strengths) ? (obj.strengths as string[]) : [],
    risks: Array.isArray(obj.risks) ? (obj.risks as string[]) : [],
    recommendations: Array.isArray(obj.recommendations)
      ? (obj.recommendations as string[])
      : [],
    tokenUsage: typeof obj.tokenUsage === "number" ? obj.tokenUsage : 0,
    auditScore,
    completedAt: typeof obj.completedAt === "string" ? obj.completedAt : "",
  };
}

export function buildAuditRetryPrompt(
  issues: string[],
  auditFileMap?: ProjectKnowledgeSnapshot["auditFileMap"]
): string {
  const fileLines = auditFileMap?.flatMap((e) => e.files.map((f) => `- ${f}`)) ?? [];
  return [
    "Your audit findings failed evidence requirements.",
    "fileOrModule MUST be a file path from FILE-LEVEL AUDIT MAP (e.g. src/server/governance/voting.service.ts).",
    "Do NOT use broad categories: Governance, External Integrations, AI Provider Layer.",
    "Each evidence field must cite observable code behavior (min 20 chars).",
    "Do NOT suggest generic improvements (testing, API versioning, scalability, architecture).",
    "Max 5 findings.",
    fileLines.length ? "Allowed files:" : "",
    ...fileLines.slice(0, 20),
    "Issues:",
    ...issues.map((i) => `- ${i}`),
  ]
    .filter(Boolean)
    .join("\n");
}
