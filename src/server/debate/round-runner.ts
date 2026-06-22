import type { Agent, RoundType, Stance, VoteValue } from "@prisma/client";
import { prisma } from "@/server/db/prisma";
import { agentRunner } from "@/server/agents/agent-runner";
import { memoryService } from "@/server/memory/memory.service";
import { assertAgentCanVote } from "@/server/invariants/debate-invariants";
import type { RoundContext } from "@/types/debate";
import type { StanceLiteral, VoteLiteral } from "@/types/agent-message";

function toPrismaStance(stance: StanceLiteral): Stance {
  const map: Record<StanceLiteral, Stance> = {
    support: "SUPPORT",
    oppose: "OPPOSE",
    neutral: "NEUTRAL",
    refine: "REFINE",
  };
  return map[stance];
}

function toPrismaVote(vote?: VoteLiteral): VoteValue | undefined {
  if (!vote) return undefined;
  const map: Record<VoteLiteral, VoteValue> = {
    yes: "YES",
    no: "NO",
    abstain: "ABSTAIN",
  };
  return map[vote];
}

export class RoundRunner {
  async runRound(params: {
    roundId: string;
    roundType: RoundType;
    roundNumber: number;
    agents: Agent[];
    context: Omit<RoundContext, "round" | "previousMessages">;
    previousMessages: RoundContext["previousMessages"];
  }) {
    const round = await prisma.discussionRound.findUniqueOrThrow({
      where: { id: params.roundId },
    });

    await prisma.discussionRound.update({
      where: { id: params.roundId },
      data: { status: "RUNNING" },
    });

    const isParallel = params.roundType === "PROPOSE" || params.roundType === "VOTE";

    const runAgent = async (agent: Agent) => {
      if (params.roundType === "VOTE") {
        assertAgentCanVote(agent);
      }

      const memoryContext = await memoryService.buildContextForDiscussion({
        workspaceId: params.context.workspace.id,
        projectId: params.context.project.id,
        agentRole: agent.role,
      });

      const roundContext: RoundContext = {
        ...params.context,
        round,
        previousMessages: params.previousMessages,
        memoryContext,
        userPrompt: params.context.discussion.userPrompt,
      };

      const result = await agentRunner.run(
        agent,
        params.roundType,
        roundContext,
        memoryContext
      );

      const message = await prisma.agentMessage.create({
        data: {
          roundId: params.roundId,
          agentId: agent.id,
          stance: toPrismaStance(result.message.stance),
          content: result.message.content,
          concerns: result.message.concerns,
          suggestions: result.message.suggestions,
          vote: toPrismaVote(result.message.vote),
          votingWeightSnapshot: agent.votingWeight,
          qualityScore: result.qualityScore,
          provider: result.provider,
          model: result.model,
          tokenInput: result.tokenInput,
          tokenOutput: result.tokenOutput,
          tokenTotal: result.tokenTotal,
          fallbackUsed: result.fallbackUsed,
        },
      });

      if (params.roundType === "VOTE" && result.message.vote) {
        await prisma.voteRecord.upsert({
          where: {
            discussionId_agentId: {
              discussionId: params.context.discussion.id,
              agentId: agent.id,
            },
          },
          create: {
            discussionId: params.context.discussion.id,
            agentId: agent.id,
            vote: toPrismaVote(result.message.vote)!,
            weight: agent.votingWeight,
            justification: result.message.content,
          },
          update: {
            vote: toPrismaVote(result.message.vote)!,
            weight: agent.votingWeight,
            justification: result.message.content,
          },
        });
      }

      return message;
    };

    if (isParallel) {
      await Promise.all(params.agents.map(runAgent));
    } else {
      for (const agent of params.agents) {
        await runAgent(agent);
      }
    }

    await prisma.discussionRound.update({
      where: { id: params.roundId },
      data: { status: "COMPLETED" },
    });
  }
}

export const roundRunner = new RoundRunner();
