import type { RecommendedAction } from "@/server/recommendations/recommendation-engine";
import type { IntegrityLearningRecord, RepeatedMistake } from "../learning-types";
import { resolveCanonicalTopic } from "./topic-resolver";
import {
  topicLifecycleService,
  type TopicLifecycle,
  type TopicLifecycleStatus,
} from "./topic-lifecycle.service";

export type ConsistencyIssue = {
  topic: string;
  topicKey: string;
  message: string;
  sections: string[];
};

export type ConsistencyReport = {
  consistent: boolean;
  verifiedTopicCount: number;
  issues: ConsistencyIssue[];
};

const CLOSED_STATUSES: TopicLifecycleStatus[] = ["VERIFIED", "IMPLEMENTED"];

export class RecommendationConsistencyService {
  async loadLifecycleMap(projectId: string) {
    return topicLifecycleService.loadLifecycleMap(projectId);
  }

  async checkProject(params: {
    projectId: string;
    recommendedActions: RecommendedAction[];
    repeatedMistakes: RepeatedMistake[];
    activeLearnings: IntegrityLearningRecord[];
    verifiedImprovementTitles: string[];
  }): Promise<ConsistencyReport> {
    const lifecycleMap = await topicLifecycleService.loadLifecycleMap(params.projectId);
    return this.check({
      lifecycleMap,
      recommendedActions: params.recommendedActions,
      repeatedMistakes: params.repeatedMistakes,
      activeLearnings: params.activeLearnings,
      verifiedImprovementTitles: params.verifiedImprovementTitles,
    });
  }

  check(params: {
    lifecycleMap: Map<string, TopicLifecycle>;
    recommendedActions: RecommendedAction[];
    repeatedMistakes: RepeatedMistake[];
    activeLearnings: IntegrityLearningRecord[];
    verifiedImprovementTitles: string[];
  }): ConsistencyReport {
    const issues: ConsistencyIssue[] = [];
    const verifiedTopicKeys = new Set<string>();

    for (const lifecycle of params.lifecycleMap.values()) {
      if (lifecycle.status === "VERIFIED") {
        verifiedTopicKeys.add(lifecycle.topicKey);
      }
    }

    for (const action of params.recommendedActions) {
      if (action.source === "open_proposals" || action.source === "open_risks") continue;

      const canonical = resolveCanonicalTopic(action.title);
      const lifecycle = params.lifecycleMap.get(canonical.topicKey);

      if (lifecycle && CLOSED_STATUSES.includes(lifecycle.status)) {
        issues.push({
          topic: action.title,
          topicKey: canonical.topicKey,
          message: `Recommended action conflicts with ${lifecycle.status} topic (${canonical.topicKey}) via ${lifecycle.source}`,
          sections: ["recommended_action", "verified_improvement"],
        });
      }
    }

    for (const mistake of params.repeatedMistakes) {
      const canonical = resolveCanonicalTopic(mistake.title);
      const lifecycle = params.lifecycleMap.get(canonical.topicKey);

      if (lifecycle && CLOSED_STATUSES.includes(lifecycle.status)) {
        issues.push({
          topic: mistake.title,
          topicKey: canonical.topicKey,
          message: `Repeated mistake conflicts with ${lifecycle.status} topic (${canonical.topicKey})`,
          sections: ["repeated_mistake", "verified_improvement"],
        });
      }
    }

    for (const learning of params.activeLearnings) {
      const canonical = resolveCanonicalTopic(learning.title);
      const lifecycle = params.lifecycleMap.get(canonical.topicKey);

      if (lifecycle?.status === "VERIFIED") {
        issues.push({
          topic: learning.title,
          topicKey: canonical.topicKey,
          message: `Active learning should not appear for verified topic (${canonical.topicKey})`,
          sections: ["active_learning", "verified_improvement"],
        });
      }
    }

    const activeTopicKeys = new Set(
      params.activeLearnings.map((l) => resolveCanonicalTopic(l.title).topicKey)
    );

    for (const topicKey of verifiedTopicKeys) {
      if (activeTopicKeys.has(topicKey)) {
        issues.push({
          topic: params.lifecycleMap.get(topicKey)?.canonicalTitle ?? topicKey,
          topicKey,
          message: `Same canonical topic (${topicKey}) appears in both Active Learnings and Verified Improvements`,
          sections: ["active_learning", "verified_improvement"],
        });
      }
    }

    for (const verifiedTitle of params.verifiedImprovementTitles) {
      const canonical = resolveCanonicalTopic(verifiedTitle);
      const inRecommendations = params.recommendedActions.some(
        (a) =>
          a.source !== "open_proposals" &&
          a.source !== "open_risks" &&
          resolveCanonicalTopic(a.title).topicKey === canonical.topicKey
      );
      const inMistakes = params.repeatedMistakes.some(
        (m) => resolveCanonicalTopic(m.title).topicKey === canonical.topicKey
      );
      if (inRecommendations || inMistakes) {
        issues.push({
          topic: verifiedTitle,
          topicKey: canonical.topicKey,
          message: `Verified topic (${canonical.topicKey}) still surfaced in recommendations or repeated mistakes`,
          sections: [
            ...(inRecommendations ? ["recommended_action"] : []),
            ...(inMistakes ? ["repeated_mistake"] : []),
            "verified_improvement",
          ],
        });
      }
    }

    return {
      consistent: issues.length === 0,
      verifiedTopicCount: verifiedTopicKeys.size,
      issues,
    };
  }

  dedupeByTopicKey<T extends { topicKey?: string; title: string }>(items: T[]): T[] {
    const seen = new Set<string>();
    const result: T[] = [];
    for (const item of items) {
      const key = item.topicKey ?? resolveCanonicalTopic(item.title).topicKey;
      if (seen.has(key)) continue;
      seen.add(key);
      result.push({ ...item, topicKey: key } as T);
    }
    return result;
  }
}

export const recommendationConsistencyService = new RecommendationConsistencyService();
