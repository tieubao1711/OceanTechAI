/**
 * OceanTechAI self-test — full dogfooding flow via service layer (mock AI).
 * Requires: DATABASE_URL, schema pushed (npm run db:push).
 */
import { prisma } from "../src/server/db/prisma";
import { discussionService } from "../src/server/services/discussion.service";
import { proposalService } from "../src/server/services/proposal.service";
import { projectService } from "../src/server/services/project.service";
import { governanceService } from "../src/server/governance/governance.service";
import { adrService } from "../src/server/insights/adr.service";
import { timelineService } from "../src/server/insights/timeline.service";
import { autonomousReviewJob } from "../src/server/autonomous/autonomous-review.job";
import { executiveBriefingService } from "../src/server/insights/executive-briefing.service";
import { memoryService } from "../src/server/memory/memory.service";
import {
  DOGFOOD_PROJECT_ID,
  DOGFOOD_WORKSPACE_ID,
} from "../src/lib/dogfood-ids";

const SELF_TEST_PROMPT =
  "Design Agent Reputation System v2 for OceanTechAI.";

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(`ASSERT FAILED: ${message}`);
}

async function ensureDogfoodProject() {
  let user = await prisma.user.findFirst();
  if (!user) {
    user = await prisma.user.create({
      data: { email: "founder@oceantechai.local", name: "Founder" },
    });
  }

  const workspace = await prisma.workspace.upsert({
    where: { id: DOGFOOD_WORKSPACE_ID },
    update: {},
    create: {
      id: DOGFOOD_WORKSPACE_ID,
      name: "OceanTechAI Self-Test",
      description: "Dogfooding workspace — OceanTechAI manages itself.",
      ownerId: user.id,
    },
  });

  await governanceService.seedWorkspaceRules(workspace.id);

  const project = await prisma.project.upsert({
    where: { id: DOGFOOD_PROJECT_ID },
    update: {},
    create: {
      id: DOGFOOD_PROJECT_ID,
      name: "OceanTechAI Core",
      description: "OceanTechAI operating system — dogfood project for self-improvement.",
      workspaceId: workspace.id,
    },
  });

  await projectService.seedDefaultAgents(project.id);
  await adrService.seedForProject(project.id);
  await timelineService.seedProjectMilestones(project.id, project.name, project.createdAt);

  await memoryService.upsertEntry({
    scope: "PROJECT",
    projectId: project.id,
    key: "dogfood_mission",
    value: "OceanTechAI should dogfood itself before serving external teams.",
    source: "self-test",
  });

  return { user, project };
}

async function main() {
  console.log("=== OceanTechAI Self-Test ===\n");
  console.log(`AI_PROVIDER_MODE: ${process.env.AI_PROVIDER_MODE ?? "mock"}\n`);

  const { user, project } = await ensureDogfoodProject();
  console.log(`✓ Workspace: OceanTechAI Self-Test (${DOGFOOD_WORKSPACE_ID})`);
  console.log(`✓ Project:   OceanTechAI Core (${project.id})`);

  const agents = await prisma.agent.findMany({
    where: { projectId: project.id, isActive: true },
  });
  assert(agents.length >= 4, `Expected active agents, got ${agents.length}`);
  console.log(`✓ Active agents: ${agents.length}`);

  const discussion = await discussionService.create({
    projectId: project.id,
    userPrompt: SELF_TEST_PROMPT,
  });
  console.log(`\n✓ Created discussion: ${discussion.id}`);

  await discussionService.runDebate(discussion.id);
  console.log(`✓ Debate completed`);

  const fullDiscussion = await discussionService.getById(discussion.id);
  assert(fullDiscussion.status === "COMPLETED", `Expected COMPLETED, got ${fullDiscussion.status}`);
  console.log(`✓ Discussion status: COMPLETED`);

  const proposal = await prisma.proposal.findUnique({
    where: { discussionId: discussion.id },
  });
  assert(!!proposal, "Expected proposal");
  assert(proposal!.status === "PENDING", `Expected PENDING proposal`);
  console.log(`✓ Proposal created: ${proposal!.id}`);

  const journals = await prisma.agentJournal.findMany({
    where: { discussionId: discussion.id },
  });
  assert(journals.length > 0, `Expected journals, got ${journals.length}`);
  console.log(`✓ Journals created: ${journals.length}`);

  const timelineEvents = await prisma.timelineEvent.findMany({
    where: { projectId: project.id },
  });
  assert(timelineEvents.length > 0, "Expected timeline events");
  const hasDebateEvent = timelineEvents.some((e) =>
    e.title.toLowerCase().includes("debate") || e.eventType === "DISCUSSION_COMPLETED"
  );
  assert(hasDebateEvent, "Expected debate-related timeline event");
  console.log(`✓ Timeline events: ${timelineEvents.length}`);

  const agentsAfterDebate = await prisma.agent.findMany({
    where: { projectId: project.id },
  });
  const participated = agentsAfterDebate.some((a) => a.proposalCount > 0);
  assert(participated, "Expected reputation participation (proposalCount > 0)");
  console.log(`✓ Reputation updated (proposalCount incremented)`);

  await proposalService.approve(proposal!.id, user.id, "Self-test approval");
  console.log(`✓ Proposal approved`);

  const approved = await proposalService.getById(proposal!.id);
  assert(approved.status === "APPROVED", "Proposal should be APPROVED");
  assert(approved.generatedFiles.length >= 4, `Expected generated files, got ${approved.generatedFiles.length}`);
  console.log(`✓ Generated files: ${approved.generatedFiles.length}`);

  const review = await autonomousReviewJob.run(project.id);
  console.log(`✓ Autonomous review: ${review.created.length} suggestion(s) created`);

  const suggestions = await prisma.autonomousSuggestion.findMany({
    where: { projectId: project.id, status: "DRAFT" },
  });
  assert(suggestions.length > 0, "Expected at least one autonomous suggestion");
  console.log(`✓ Autonomous suggestions: ${suggestions.length}`);

  const brief = await executiveBriefingService.generateMorningBrief(project.id);
  assert(
    brief.recommendedActions.length > 0,
    "Expected recommended actions in executive briefing"
  );
  console.log(`✓ Executive briefing: ${brief.recommendedActions.length} recommended action(s)`);

  const topAgents = await prisma.agent.findMany({
    where: { projectId: project.id, isActive: true },
    orderBy: { reputationScore: "desc" },
    take: 3,
  });

  console.log("\n=== OceanTechAI Self-Test Passed ===\n");
  console.log(`Discussion:      ${discussion.id}`);
  console.log(`Proposal:        ${proposal!.id}`);
  console.log(`Generated Files: ${approved.generatedFiles.length}`);
  console.log(`Journals:        ${journals.length}`);
  console.log(`Timeline Events: ${timelineEvents.length}`);
  console.log(`Suggestions:     ${suggestions.length}`);
  console.log(`Top Agents:`);
  for (const a of topAgents) {
    console.log(`  - ${a.name}: reputation ${a.reputationScore.toFixed(1)} (debates ${a.proposalCount})`);
  }
  console.log(`\nOpen in browser:`);
  console.log(`  http://localhost:3001/projects/${project.id}/executive`);
  console.log(`  http://localhost:3001/projects/${project.id}/timeline`);
  console.log(`  http://localhost:3001/projects/${project.id}/proposals/${proposal!.id}`);
  console.log("\n✅ Self-test PASSED");
}

main()
  .catch((err) => {
    console.error("\n❌ OceanTechAI Self-Test FAILED");
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
