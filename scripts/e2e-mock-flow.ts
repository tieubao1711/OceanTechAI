/**
 * E2E mock flow — runs full pipeline via service layer (no UI).
 * Requires: DATABASE_URL set, seed data present (npm run db:seed).
 */
import { prisma } from "../src/server/db/prisma";
import { discussionService } from "../src/server/services/discussion.service";
import { proposalService } from "../src/server/services/proposal.service";
import { markdownGenerator } from "../src/server/proposals/markdown-generator";
import { GovernanceError } from "../src/server/errors/governance-error";
import { parseConsensusResult } from "../src/server/contracts/consensus.contract";

const PROMPT =
  "Design Crew System for the MMO game with ranks, treasury, missions, and crew wars.";

const EXPECTED_FILES = [
  "docs/features/crew-system.md",
  "docs/architecture/crew-system.md",
  "docs/api/crew-system.md",
  "tasks/crew-system.cursor.md",
];

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(`ASSERT FAILED: ${message}`);
}

async function main() {
  console.log("=== OceanTechAI E2E Mock Flow ===\n");

  const project = await prisma.project.findFirst({
    where: { id: "seed-project" },
    include: { agents: { where: { isActive: true } } },
  });

  assert(!!project, "Seed project not found. Run: npm run db:seed");
  console.log(`✓ Loaded project: ${project!.name} (${project!.id})`);
  console.log(`  Active agents: ${project!.agents.length}`);

  const discussion = await discussionService.create({
    projectId: project!.id,
    userPrompt: PROMPT,
  });
  console.log(`\n✓ Created discussion: ${discussion.id}`);

  const consensus = await discussionService.runDebate(discussion.id);
  console.log(`✓ Debate completed`);

  const fullDiscussion = await discussionService.getById(discussion.id);
  const rounds = fullDiscussion.rounds;

  assert(rounds.length === 5, `Expected 5 rounds, got ${rounds.length}`);
  console.log(`✓ 5 DiscussionRounds created`);

  const round1 = rounds.find((r) => r.roundNumber === 1)!;
  assert(
    round1.messages.length >= project!.agents.length,
    `Round 1 expected ${project!.agents.length} messages, got ${round1.messages.length}`
  );
  console.log(`✓ Round 1: ${round1.messages.length} agent messages`);

  const voteRecords = await prisma.voteRecord.findMany({
    where: { discussionId: discussion.id },
  });
  assert(voteRecords.length > 0, "Expected VoteRecords from Round 4");
  console.log(`✓ Round 4: ${voteRecords.length} VoteRecords`);

  assert(!!fullDiscussion.consensusJson, "Expected consensusJson on discussion");
  const parsed = parseConsensusResult(fullDiscussion.consensusJson);
  assert(!!parsed.voteSummary, "Expected voteSummary in consensus");
  console.log(
    `✓ Consensus: classification=${parsed.voteSummary.classification}, yes=${parsed.voteSummary.yes}, no=${parsed.voteSummary.no}`
  );

  const proposal = await prisma.proposal.findUnique({
    where: { discussionId: discussion.id },
  });
  assert(!!proposal, "Expected proposal");
  assert(proposal!.status === "PENDING", `Expected PENDING, got ${proposal!.status}`);
  console.log(`✓ Proposal created: ${proposal!.id} (PENDING)`);

  let preApprovalFailed = false;
  try {
    await prisma.$transaction(async (tx) => {
      await markdownGenerator.generate(tx, proposal!);
    });
  } catch (err) {
    if (err instanceof GovernanceError && err.code === "PROPOSAL_APPROVAL_REQUIRED") {
      preApprovalFailed = true;
    } else {
      throw err;
    }
  }
  assert(preApprovalFailed, "Generate before approval should throw PROPOSAL_APPROVAL_REQUIRED");
  console.log(`✓ Pre-approval generate correctly blocked`);

  const user = await prisma.user.findFirst();
  assert(!!user, "No user found");
  await proposalService.approve(proposal!.id, user!.id, "E2E test approval");
  console.log(`✓ Proposal approved`);

  const approved = await proposalService.getById(proposal!.id);
  assert(approved.status === "APPROVED", "Proposal should be APPROVED");
  assert(!!approved.decisionLog, "Expected DecisionLog");
  assert(approved.generatedFiles.length === 4, `Expected 4 files, got ${approved.generatedFiles.length}`);
  console.log(`✓ Generated ${approved.generatedFiles.length} files`);
  console.log(`✓ DecisionLog: ${approved.decisionLog!.action} by ${approved.decisionLog!.decider.name}`);

  const paths = approved.generatedFiles.map((f) => f.path).sort();
  for (const expected of EXPECTED_FILES) {
    assert(paths.includes(expected), `Missing generated file: ${expected}`);
  }
  console.log(`✓ All expected file paths present`);

  console.log("\n=== E2E SUMMARY ===");
  console.log(`Discussion:  ${discussion.id}`);
  console.log(`Proposal:    ${proposal!.id}`);
  console.log(`Vote:        yes=${parsed.voteSummary.yes} no=${parsed.voteSummary.no} abstain=${parsed.voteSummary.abstain}`);
  console.log(`Files:`);
  paths.forEach((p) => console.log(`  - ${p}`));
  console.log("\n✅ E2E mock flow PASSED");
}

main()
  .catch((err) => {
    console.error("\n❌ E2E mock flow FAILED");
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
