import { prisma } from "@/server/db/prisma";
import { DEBATE_ROUNDS } from "@/types/debate";
import type { ConsensusResult } from "@/types/consensus";
import { parseConsensusResult } from "@/server/contracts/consensus.contract";
import {
  assertActiveAgentsForDebate,
  assertDiscussionCanRun,
} from "@/server/invariants/debate-invariants";
import { assertConsensusQuality } from "@/server/quality/consensus-quality";
import { roundRunner } from "./round-runner";
import { consensusEngine } from "./consensus-engine";
import { proposalGenerator } from "@/server/proposals/proposal-generator";
import { journalService } from "@/server/journals/journal.service";
import { reputationService } from "@/server/insights/reputation.service";
import { timelineService, TIMELINE_EVENT_TYPES } from "@/server/insights/timeline.service";
import { projectKnowledgeService } from "@/server/knowledge/project-knowledge.service";
import { parseDiscussionMode } from "@/types/discussion-mode";
import { debateParticipantService } from "@/server/workforce/debate-participant.service";

export class DebateOrchestrator {
  async run(discussionId: string): Promise<ConsensusResult> {
    const discussion = await prisma.discussion.findUniqueOrThrow({
      where: { id: discussionId },
      include: {
        project: { include: { workspace: true } },
        rounds: { include: { messages: { include: { agent: true } } } },
      },
    });

    assertDiscussionCanRun(discussion.status);

    const agents = await debateParticipantService.getParticipantsForDebate({
      projectId: discussion.projectId,
      topic: discussion.userPrompt,
    });

    assertActiveAgentsForDebate(agents);

    await prisma.discussion.update({
      where: { id: discussionId },
      data: { status: "RUNNING", lastError: null },
    });

    try {
      const discussionMode = parseDiscussionMode(discussion.mode);
      const projectKnowledgeSnapshot = await projectKnowledgeService.buildForProject(
        discussion.projectId
      );
      const projectKnowledge = projectKnowledgeService.formatForPrompt(
        projectKnowledgeSnapshot,
        discussionMode
      );

      const baseContext = {
        discussion: { ...discussion, status: "RUNNING" as const },
        project: discussion.project,
        workspace: discussion.project.workspace,
        agents,
        userPrompt: discussion.userPrompt,
        memoryContext: "",
        discussionMode,
        projectKnowledge,
        projectKnowledgeSnapshot,
      };

      const previousMessages: Array<{
        roundNumber: number;
        roundType: string;
        agentId: string;
        agentName: string;
        agentRole: string;
        stance: string;
        content: string;
        concerns: string[];
        suggestions: string[];
        vote?: string | null;
      }> = [];

      for (const roundDef of DEBATE_ROUNDS) {
        if (roundDef.roundType === "CONSENSUS") continue;

        const round = await prisma.discussionRound.upsert({
          where: {
            discussionId_roundNumber: {
              discussionId,
              roundNumber: roundDef.roundNumber,
            },
          },
          create: {
            discussionId,
            roundNumber: roundDef.roundNumber,
            roundType: roundDef.roundType,
            status: "PENDING",
          },
          update: {},
        });

        await roundRunner.runRound({
          roundId: round.id,
          roundType: roundDef.roundType,
          roundNumber: roundDef.roundNumber,
          agents,
          context: baseContext,
          previousMessages,
        });

        const completedRound = await prisma.discussionRound.findUniqueOrThrow({
          where: { id: round.id },
          include: { messages: { include: { agent: true } } },
        });

        for (const msg of completedRound.messages) {
          previousMessages.push({
            roundNumber: roundDef.roundNumber,
            roundType: roundDef.roundType,
            agentId: msg.agentId,
            agentName: msg.agent.name,
            agentRole: msg.agent.role,
            stance: msg.stance,
            content: msg.content,
            concerns: msg.concerns,
            suggestions: msg.suggestions,
            vote: msg.vote,
          });
        }
      }

      const allRounds = await prisma.discussionRound.findMany({
        where: { discussionId },
        include: { messages: { include: { agent: true } } },
        orderBy: { roundNumber: "asc" },
      });

      const consensus = parseConsensusResult(
        consensusEngine.aggregate({
          userPrompt: discussion.userPrompt,
          rounds: allRounds,
        })
      ) as ConsensusResult;

      const consensusQualityScore = assertConsensusQuality(consensus);

      await prisma.discussionRound.upsert({
        where: {
          discussionId_roundNumber: { discussionId, roundNumber: 5 },
        },
        create: {
          discussionId,
          roundNumber: 5,
          roundType: "CONSENSUS",
          status: "COMPLETED",
        },
        update: { status: "COMPLETED" },
      });

      await prisma.discussion.update({
        where: { id: discussionId },
        data: {
          status: "COMPLETED",
          consensusJson: consensus as object,
          lastError: null,
        },
      });

      const proposal = await proposalGenerator.create(
        discussionId,
        consensus,
        consensusQualityScore
      );

      await journalService.generateFromDebate(discussionId, consensus);
      await reputationService.updateAfterDebate(discussionId);

      await timelineService.recordEvent({
        projectId: discussion.projectId,
        title: `Debate completed: ${consensus.title}`,
        description: consensus.finalDecision,
        eventType: TIMELINE_EVENT_TYPES.DISCUSSION_COMPLETED,
        referenceId: discussionId,
      });

      await timelineService.recordEvent({
        projectId: discussion.projectId,
        title: `Proposal created: ${consensus.title}`,
        eventType: TIMELINE_EVENT_TYPES.PROPOSAL_CREATED,
        referenceId: proposal.id,
      });

      return consensus;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await prisma.discussion.update({
        where: { id: discussionId },
        data: { status: "FAILED", lastError: message },
      });
      throw err;
    }
  }
}

export const debateOrchestrator = new DebateOrchestrator();
