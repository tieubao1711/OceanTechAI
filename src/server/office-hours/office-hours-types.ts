import type { Agent } from "@prisma/client";

export type OfficeHoursMessageRole = "founder" | "agent" | "system";

export type OfficeHoursMessageView = {
  id: string;
  role: OfficeHoursMessageRole;
  content: string;
  tokenInput?: number | null;
  tokenOutput?: number | null;
  tokenTotal?: number | null;
  provider?: string | null;
  model?: string | null;
  fallbackUsed: boolean;
  createdAt: Date;
};

export type OfficeHoursConversationView = {
  id: string;
  projectId: string;
  agentId: string;
  title: string | null;
  createdAt: Date;
  updatedAt: Date;
  messages: OfficeHoursMessageView[];
};

export type OfficeHoursConversationSummary = {
  id: string;
  title: string | null;
  updatedAt: Date;
  messageCount: number;
  preview: string | null;
};

export type OfficeHoursContextBundle = {
  projectName: string;
  projectDescription: string | null;
  assignments: string[];
  memoryBlock: string;
  journals: string[];
  debatePositions: string[];
  learningRecords: string[];
  projectKnowledge: string;
  recentMessages: Array<{ role: OfficeHoursMessageRole; content: string }>;
};

export type OfficeHoursRunResult = {
  content: string;
  provider: string;
  model: string;
  tokenInput?: number;
  tokenOutput?: number;
  tokenTotal?: number;
  fallbackUsed: boolean;
};

export const OFFICE_HOURS_LIMITS = {
  maxJournals: 5,
  maxDebateMessages: 5,
  maxLearningRecords: 5,
  maxConversationMessages: 10,
  maxCompactKnowledgeLines: 25,
} as const;

export type MockOfficeHoursMetadata = {
  agent: Agent;
  founderMessage: string;
};

export const SUGGESTED_PROMPTS = [
  "What should I ask you about this week?",
  "What risks do you see in this project?",
  "What did you learn from recent debates?",
  "What would you prioritize if you were Founder?",
  "What should become a formal discussion?",
] as const;
