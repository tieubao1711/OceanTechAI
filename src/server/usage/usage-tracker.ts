import { prisma } from "@/server/db/prisma";

export type DiscussionUsageSummary = {
  discussionId: string;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalTokens: number;
  messageCount: number;
  fallbackCount: number;
};

export async function getDiscussionUsageSummary(
  discussionId: string
): Promise<DiscussionUsageSummary> {
  const messages = await prisma.agentMessage.findMany({
    where: { round: { discussionId } },
    select: {
      tokenInput: true,
      tokenOutput: true,
      tokenTotal: true,
      fallbackUsed: true,
    },
  });

  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  let totalTokens = 0;
  let fallbackCount = 0;

  for (const m of messages) {
    totalInputTokens += m.tokenInput ?? 0;
    totalOutputTokens += m.tokenOutput ?? 0;
    totalTokens += m.tokenTotal ?? 0;
    if (m.fallbackUsed) fallbackCount += 1;
  }

  return {
    discussionId,
    totalInputTokens,
    totalOutputTokens,
    totalTokens,
    messageCount: messages.length,
    fallbackCount,
  };
}
