import type { Department } from "@prisma/client";

export type GlobalAgentView = {
  id: string;
  homeProjectId: string;
  homeProjectName: string;
  name: string;
  displayName: string;
  title: string;
  department: Department;
  departmentLabel: string;
  rank: string;
  role: string;
  expertise: string[];
  reputation: number;
  influenceScore: number;
  status: string;
  avatarEmoji: string;
  avatarColor: string;
  activeProjects: string[];
  profileHref: string;
  officeHoursHref: string;
};

export type GlobalProjectView = {
  id: string;
  name: string;
  description: string | null;
  workspaceName: string;
  leadName: string | null;
  teamSize: number;
  openDiscussions: number;
  openProposals: number;
  healthScore: number | null;
  href: string;
};

export type GlobalDiscussionView = {
  id: string;
  projectId: string;
  projectName: string;
  userPrompt: string;
  status: string;
  mode: string;
  createdAt: Date;
  proposalStatus: string | null;
  href: string;
};

export type GlobalLearningView = {
  verifiedImprovements: Array<{ title: string; projectName: string; projectId: string }>;
  repeatedMistakes: Array<{ title: string; projectName: string; status: string }>;
  topLearnings: Array<{ title: string; projectName: string; evidenceCount: number }>;
  recentAdrs: Array<{ title: string; projectName: string; projectId: string }>;
  improvementCycles: Array<{ title: string; status: string; projectName: string }>;
  healthScore: number;
};

export type SearchResultItem = {
  type: "agent" | "project" | "discussion" | "proposal" | "adr" | "learning";
  id: string;
  title: string;
  subtitle: string;
  href: string;
  projectName?: string;
};

export type FounderHomeSnapshots = {
  agents: GlobalAgentView[];
  projects: GlobalProjectView[];
  recentDiscussions: GlobalDiscussionView[];
  recentDecisions: Array<{ title: string; projectName: string; occurredAt: Date; href: string }>;
  learning: {
    verifiedCount: number;
    mistakesCount: number;
    activeLearningsCount: number;
    healthScore: number;
  };
  companyOverview: {
    totalAgents: number;
    activeAgents: number;
    projects: number;
    openDiscussions: number;
    openProposals: number;
    averageReputation: number;
  };
  topRisks: string[];
};
