/**
 * Architecture audit E2E — focused 3-round audit workflow (Phase 2.6).
 */
import { prisma } from "../src/server/db/prisma";
import { discussionService } from "../src/server/services/discussion.service";
import { projectKnowledgeService } from "../src/server/knowledge/project-knowledge.service";
import {
  classifyFindingSpecificity,
  parseArchitectureAuditReport,
} from "../src/server/audit/audit-quality";
import { DOGFOOD_PROJECT_ID } from "../src/lib/dogfood-ids";

const AUDIT_PROMPT =
  "Perform a complete architecture audit of OceanTechAI and identify the top 5 technical debts blocking future growth.";

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(`ASSERT FAILED: ${message}`);
}

async function main() {
  console.log("=== OceanTechAI Architecture Audit (Phase 2.6) ===\n");
  console.log(`AI_PROVIDER_MODE: ${process.env.AI_PROVIDER_MODE ?? "mock"}\n`);

  const project = await prisma.project.findUnique({
    where: { id: DOGFOOD_PROJECT_ID },
  });
  assert(!!project, `Project ${DOGFOOD_PROJECT_ID} not found. Run: npm run db:seed`);

  const snapshot = await projectKnowledgeService.buildForProject(project!.id);
  const compressed = projectKnowledgeService.formatForAuditPrompt(snapshot);
  console.log("Compressed audit context:");
  console.log(`  Chars: ${compressed.length} (~${Math.ceil(compressed.length / 4)} tokens)`);
  console.log(`  Modules: ${snapshot.existingModules.length}`);
  console.log(`  Tests:   ${snapshot.existingTests.length}`);
  console.log("");

  const discussion = await discussionService.createArchitectureAudit(
    project!.id,
    AUDIT_PROMPT
  );
  console.log(`✓ Created architecture_audit discussion: ${discussion.id}`);

  await discussionService.runDebate(discussion.id);
  console.log("✓ Audit completed");

  const full = await discussionService.getById(discussion.id);
  assert(full.status === "COMPLETED", `Expected COMPLETED, got ${full.status}`);
  assert(!!full.proposal, "Expected proposal from audit");

  const report = parseArchitectureAuditReport(full.consensusJson);
  assert(!!report, "Expected ArchitectureAuditReport in consensusJson");
  assert(report!.topFindings.length > 0, "Expected top findings");

  const classifications = { good: 0, bad: 0, neutral: 0 };
  for (const f of report!.topFindings) {
    classifications[classifyFindingSpecificity(f)]++;
  }

  const tokenUsage =
    report!.tokenUsage ||
    full.rounds.flatMap((r) => r.messages).reduce((s, m) => s + (m.tokenTotal ?? 0), 0);

  console.log("\n--- Audit Report ---");
  console.log(`  Top findings:     ${report!.topFindings.length}`);
  console.log(`  Token usage:      ${tokenUsage}`);
  console.log(`  Specificity:      ${report!.auditScore.specificity}%`);
  console.log(`  Evidence quality: ${report!.auditScore.evidenceQuality}%`);
  console.log(`  Impl readiness:   ${report!.auditScore.implementationReadiness}%`);

  console.log("\n--- Top Findings ---");
  for (const f of report!.topFindings) {
    console.log(`  [${f.priority}/${f.fixScope}] ${f.title}`);
    console.log(`    Module: ${f.fileOrModule}`);
    console.log(`    Evidence: ${f.evidence.slice(0, 80)}...`);
  }

  console.log("\n--- Debt Specificity (top findings) ---");
  console.log(`  Specific (GOOD):  ${classifications.good}`);
  console.log(`  Generic (BAD):    ${classifications.bad}`);
  console.log(`  Neutral:          ${classifications.neutral}`);

  assert(classifications.good >= 3, `Expected >= 3 GOOD findings, got ${classifications.good}`);
  assert(classifications.bad === 0, `Expected 0 BAD findings, got ${classifications.bad}`);
  assert(tokenUsage < 12000, `Token usage ${tokenUsage} exceeds 12k target`);
  assert(report!.auditScore.specificity >= 80, "Specificity score too low");
  assert(compressed.length < 10000, "Compressed context exceeds ~2500 token target");

  console.log("\n=== Architecture Audit PASSED ===");
  console.log(`Discussion: ${discussion.id}`);
  console.log(`Proposal:   ${full.proposal!.id}`);
  console.log(`\nOpen: http://localhost:3001/projects/${project!.id}/proposals/${full.proposal!.id}`);
}

main()
  .catch((err) => {
    console.error("\n❌ Architecture Audit FAILED");
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
