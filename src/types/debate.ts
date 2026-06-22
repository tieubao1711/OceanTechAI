import type { Agent, Discussion, DiscussionRound, Project, Workspace } from "@prisma/client";
import type { DiscussionMode } from "@/types/discussion-mode";
import type { ProjectKnowledgeSnapshot } from "@/server/knowledge/project-knowledge-types";

export const DEBATE_ROUNDS = [
  { roundNumber: 1, roundType: "PROPOSE" as const },
  { roundNumber: 2, roundType: "CRITIQUE" as const },
  { roundNumber: 3, roundType: "REFINE" as const },
  { roundNumber: 4, roundType: "VOTE" as const },
  { roundNumber: 5, roundType: "CONSENSUS" as const },
];

export type DebateContext = {
  discussion: Discussion;
  project: Project;
  workspace: Workspace;
  agents: Agent[];
  userPrompt: string;
  memoryContext: string;
  discussionMode: DiscussionMode;
  projectKnowledge: string;
  projectKnowledgeSnapshot: ProjectKnowledgeSnapshot;
};

export type RoundContext = DebateContext & {
  round: DiscussionRound;
  previousMessages: Array<{
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
  }>;
};
