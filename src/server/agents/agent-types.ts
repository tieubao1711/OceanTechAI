export type AgentIdentity = {
  strengths: string[];
  weaknesses: string[];
  expertiseAreas: string[];
  behavioralTraits: string[];
  preferredTopics: string[];
  avoidedTopics: string[];
};

export type AgentBriefing = {
  summary: string;
  roleDescription: string;
  strongIn: string[];
  frequentlyRecommends: string[];
  risks: string[];
};

export type DebateHistoryEntry = {
  discussionId: string;
  title: string;
  roleInDebate: string;
  vote: string | null;
  outcome: string | null;
  occurredAt: Date;
};

export type JournalTimelineEntry = {
  id: string;
  type: string;
  title: string;
  content: string;
  createdAt: Date;
};

export type AgentCouncilMember = {
  id: string;
  name: string;
  role: string;
  status: "active" | "dormant" | "suspended" | "retired";
  reputation: number;
  acceptedCount: number;
  rejectedCount: number;
  proposalCount: number;
  lastActivity: Date | null;
  influenceScore: number;
  avatarEmoji: string;
  avatarColor: string;
  department: string;
  title: string;
  rank: string;
  projects: string[];
  allocationTotal: number;
  isOverallocated: boolean;
};

export type AgentProfile = {
  member: AgentCouncilMember;
  expertise: string[];
  systemPrompt: string;
  votingWeight: number;
  identity: AgentIdentity;
  briefing: AgentBriefing;
  debateHistory: DebateHistoryEntry[];
  journalTimeline: JournalTimelineEntry[];
};

export type CouncilInsights = {
  members: AgentCouncilMember[];
  topContributors: AgentCouncilMember[];
  mostTrusted: AgentCouncilMember[];
  requiringReview: AgentCouncilMember[];
};
