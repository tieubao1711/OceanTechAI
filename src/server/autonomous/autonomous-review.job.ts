import { prisma } from "@/server/db/prisma";
import { recommendationEngine } from "@/server/recommendations/recommendation-engine";
import { timelineService, TIMELINE_EVENT_TYPES } from "@/server/insights/timeline.service";
import { resolveCanonicalTopic } from "@/server/learning/integrity/topic-resolver";
import { topicLifecycleService } from "@/server/learning/integrity/topic-lifecycle.service";

function shouldSkipClosedTopic(
  title: string,
  lifecycleMap: Awaited<ReturnType<typeof topicLifecycleService.loadLifecycleMap>>
) {
  const topicKey = resolveCanonicalTopic(title).topicKey;
  const lifecycle = lifecycleMap.get(topicKey);
  return lifecycle?.status === "VERIFIED" || lifecycle?.status === "IMPLEMENTED";
}

export class AutonomousReviewJob {
  /** Manual trigger for MVP. Later: daily scheduler. */
  async run(projectId: string) {
    const [recommendations, lifecycleMap] = await Promise.all([
      recommendationEngine.generate(projectId),
      topicLifecycleService.loadLifecycleMap(projectId),
    ]);
    const topicRecs = recommendations.filter((r) => r.source === "topic_analysis");

    const created = [];

    for (const rec of topicRecs.slice(0, 5)) {
      if (shouldSkipClosedTopic(rec.title, lifecycleMap)) continue;

      const existing = await prisma.autonomousSuggestion.findFirst({
        where: {
          projectId,
          title: rec.title,
          status: { in: ["DRAFT", "DISCUSSION_CREATED"] },
        },
      });
      if (existing) continue;

      const suggestion = await prisma.autonomousSuggestion.create({
        data: {
          projectId,
          title: rec.title,
          reason: rec.reason,
          priority: rec.priority,
          status: "DRAFT",
          metadata: {
            source: rec.source,
            mentionCount: rec.mentionCount,
          },
        },
      });
      created.push(suggestion);
    }

    if (created.length > 0) {
      await timelineService.recordEvent({
        projectId,
        title: `Autonomous review: ${created.length} suggestion(s)`,
        description: created.map((s) => s.title).join("; "),
        eventType: TIMELINE_EVENT_TYPES.SUGGESTION_CREATED,
      });
    }

    return { created, skipped: topicRecs.length - created.length };
  }

  async listSuggestions(projectId: string, status?: string) {
    const [suggestions, lifecycleMap] = await Promise.all([
      prisma.autonomousSuggestion.findMany({
        where: {
          projectId,
          ...(status ? { status } : { status: { in: ["DRAFT", "DISCUSSION_CREATED"] } }),
        },
        orderBy: [{ priority: "asc" }, { createdAt: "desc" }],
      }),
      topicLifecycleService.loadLifecycleMap(projectId),
    ]);

    return suggestions.filter((s) => !shouldSkipClosedTopic(s.title, lifecycleMap));
  }

  async ignoreSuggestion(suggestionId: string) {
    return prisma.autonomousSuggestion.update({
      where: { id: suggestionId },
      data: { status: "IGNORED" },
    });
  }

  async archiveSuggestion(suggestionId: string) {
    return prisma.autonomousSuggestion.update({
      where: { id: suggestionId },
      data: { status: "ARCHIVED" },
    });
  }

  async markDiscussionCreated(suggestionId: string, discussionId: string) {
    return prisma.autonomousSuggestion.update({
      where: { id: suggestionId },
      data: { status: "DISCUSSION_CREATED", discussionId },
    });
  }
}

export const autonomousReviewJob = new AutonomousReviewJob();
