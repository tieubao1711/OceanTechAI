import { prisma } from "@/server/db/prisma";

import { resolveCanonicalTopic } from "@/server/learning/integrity/topic-resolver";
import { topicLifecycleService } from "@/server/learning/integrity/topic-lifecycle.service";



export interface RecommendedAction {

  priority: number;

  title: string;

  reason: string;

  source: string;

  mentionCount?: number;

  duplicateWarning?: string;

}



interface TopicMention {

  topic: string;

  count: number;

  roles: Set<string>;

  sources: string[];

}



const TRACKED_TOPICS = [

  { key: "agent reputation", label: "Implement Agent Reputation" },

  { key: "reputation", label: "Implement Agent Reputation" },

  { key: "memory quality", label: "Improve Agent Memory Quality" },

  { key: "automated test", label: "Expand Automated Test Coverage" },

  { key: "inflation", label: "Review Economy Inflation Controls" },

  { key: "github", label: "Complete GitHub Execution Workflow" },

  { key: "executive", label: "Build Executive Dashboard" },

  { key: "timeline", label: "Add Project Timeline" },

  { key: "autonomous", label: "Enable Autonomous Suggestions" },

  { key: "execution retry", label: "Fix Execution Retry Gaps" },

  { key: "retry gap", label: "Fix Execution Retry Gaps" },

];



export class RecommendationEngine {

  async generate(projectId: string): Promise<RecommendedAction[]> {

    const lifecycleMap = await topicLifecycleService.loadLifecycleMap(projectId);

    const shouldSkipRecommendation = (text: string) => {
      const topicKey = resolveCanonicalTopic(text).topicKey;
      const lifecycle = lifecycleMap.get(topicKey);
      return lifecycle?.status === "VERIFIED" || lifecycle?.status === "IMPLEMENTED";
    };

    const [

      openProposals,

      rejectedProposals,

      journals,

      discussions,

      adrs,

      suggestions,

    ] = await Promise.all([

      prisma.proposal.count({

        where: { discussion: { projectId }, status: "PENDING" },

      }),

      prisma.proposal.findMany({

        where: { discussion: { projectId }, status: "REJECTED" },

        take: 5,

        orderBy: { updatedAt: "desc" },

      }),

      prisma.agentJournal.findMany({

        where: { projectId },

        include: { agent: { select: { role: true, name: true } } },

        orderBy: { createdAt: "desc" },

        take: 100,

      }),

      prisma.discussion.findMany({

        where: { projectId },

        select: { userPrompt: true, status: true },

        orderBy: { createdAt: "desc" },

        take: 50,

      }),

      prisma.adr.findMany({ where: { projectId } }),

      prisma.autonomousSuggestion.findMany({

        where: { projectId, status: "DRAFT" },

      }),

    ]);



    const actions: RecommendedAction[] = [];

    let priority = 1;



    if (openProposals > 0) {

      actions.push({

        priority: priority++,

        title: `Review ${openProposals} Open Proposal${openProposals > 1 ? "s" : ""}`,

        reason: "Founder approval is required before execution.",

        source: "open_proposals",

      });

    }



    const topicMap = new Map<string, TopicMention>();



    const scanText = (text: string, source: string, role?: string) => {

      const lower = text.toLowerCase();

      for (const t of TRACKED_TOPICS) {

        if (lower.includes(t.key)) {

          const existing = topicMap.get(t.label) ?? {

            topic: t.label,

            count: 0,

            roles: new Set<string>(),

            sources: [],

          };

          existing.count += 1;

          if (role) existing.roles.add(role);

          if (!existing.sources.includes(source)) existing.sources.push(source);

          topicMap.set(t.label, existing);

        }

      }

    };



    for (const j of journals) {

      scanText(`${j.title} ${j.content}`, "journal", j.agent.role);

    }

    for (const d of discussions) {

      scanText(d.userPrompt, "discussion");

    }

    for (const a of adrs) {

      scanText(`${a.title} ${a.summary ?? ""}`, "adr");

    }



    const sortedTopics = [...topicMap.values()].sort((a, b) => b.count - a.count);



    for (const topic of sortedTopics.slice(0, 5)) {

      if (shouldSkipRecommendation(topic.topic)) {

        continue;

      }



      const roleList = [...topic.roles].map((r) => r.replace(/_/g, " ")).join(", ");



      actions.push({

        priority: priority++,

        title: topic.topic,

        reason: [

          `Referenced in ${topic.count} source(s)`,

          roleList ? `Mentioned by: ${roleList}` : "",

        ]

          .filter(Boolean)

          .join(". "),

        source: "topic_analysis",

        mentionCount: topic.count,

      });

    }



    for (const p of rejectedProposals.slice(0, 2)) {

      if (shouldSkipRecommendation(p.title)) continue;

      actions.push({

        priority: priority++,

        title: `Revisit: ${p.title}`,

        reason: "Previously rejected — address risks before re-proposing.",

        source: "rejected_proposal",

      });

    }



    for (const s of suggestions.slice(0, 3)) {

      if (shouldSkipRecommendation(s.title)) continue;

      actions.push({

        priority: priority++,

        title: s.title,

        reason: s.reason,

        source: "autonomous_suggestion",

      });

    }



    const risks = await prisma.proposal.findMany({

      where: {

        discussion: { projectId },

        status: { in: ["PENDING", "APPROVED"] },

      },

      select: { risks: true, title: true },

      take: 10,

    });



    const riskTopics = risks.flatMap((r) => r.risks).slice(0, 3);

    for (const risk of riskTopics) {

      if (shouldSkipRecommendation(risk)) continue;

      actions.push({

        priority: priority++,

        title: `Mitigate risk: ${risk.slice(0, 60)}`,

        reason: "Flagged in active or pending proposals.",

        source: "open_risks",

      });

    }



    return actions.sort((a, b) => a.priority - b.priority);

  }

}



export const recommendationEngine = new RecommendationEngine();


