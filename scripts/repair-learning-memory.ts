/**
 * Idempotent repair job for Learning Integrity (Cycle #002.1).
 * Canonicalizes topic keys, merges duplicates, syncs debt lifecycle with verified cycles.
 *
 * Usage: npx tsx scripts/repair-learning-memory.ts [projectId]
 */
import { prisma } from "../src/server/db/prisma";
import { learningCaptureService } from "../src/server/learning/learning-capture.service";

async function main() {
  const projectIdArg = process.argv[2];

  const projects = projectIdArg
    ? await prisma.project.findMany({ where: { id: projectIdArg } })
    : await prisma.project.findMany({ select: { id: true, name: true } });

  if (projects.length === 0) {
    console.error("No projects found.");
    process.exit(1);
  }

  console.log("=== OceanTechAI Learning Memory Repair (Cycle #002.1) ===\n");

  for (const project of projects) {
    console.log(`Repairing project: ${project.name} (${project.id})`);
    const result = await learningCaptureService.repairProjectMemory(project.id);
    console.log(`  Memories merged:           ${result.memoriesMerged}`);
    console.log(`  Memories archived:         ${result.memoriesArchived}`);
    console.log(`  Verified-topic archived:   ${result.verifiedMemoriesArchived ?? 0}`);
    console.log(`  Debt tracks canonicalized: ${result.debtTracksCanonicalized ?? 0}`);
    console.log(`  Legacy removed:            ${result.legacyRemoved}`);
    console.log(`  Cycles deduped:            ${result.cyclesDeduped}`);
    console.log(`  Canonical records:         ${result.canonicalRecords}`);
    console.log(`  Stale entries removed:     ${result.staleEntriesRemoved ?? 0}`);

    const center = await learningCaptureService.getLearningCenterData(project.id);
    const recommendations = await import("../src/server/recommendations/recommendation-engine").then(
      (m) => m.recommendationEngine.generate(project.id)
    );
    const consistency = await import("../src/server/learning/integrity/recommendation-consistency.service").then(
      (m) =>
        m.recommendationConsistencyService.checkProject({
          projectId: project.id,
          recommendedActions: recommendations,
          repeatedMistakes: center.repeatedMistakes,
          activeLearnings: center.activeLearnings,
          verifiedImprovementTitles: center.verifiedImprovements.map((c) => c.title),
        })
    );

    console.log(`  Health score:              ${center.health.memoryHealthScore} / 100`);
    console.log(
      `  Consistency check:          ${consistency.consistent ? "CONSISTENT" : "INCONSISTENT"}`
    );
    if (!consistency.consistent) {
      for (const issue of consistency.issues.slice(0, 5)) {
        console.log(`    - [${issue.topicKey}] ${issue.message}`);
      }
    }
    console.log("");
  }

  console.log("Repair complete (idempotent — safe to re-run).");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
