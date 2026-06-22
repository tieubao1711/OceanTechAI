import type { AgentRank, AvatarType, Department } from "@prisma/client";

export type AgentCapacity = {
  agentId: string;
  allocationTotal: number;
  availableCapacity: number;
  isOverallocated: boolean;
};

export type ProjectAssignmentView = {
  id: string;
  projectId: string;
  projectName: string;
  agentId: string;
  agentName: string;
  role: string;
  allocationPercent: number;
  isLead: boolean;
  assignedAt: Date;
  assignedBy: string;
};

export type OrganizationAgentNode = {
  id: string;
  name: string;
  role: string;
  department: Department;
  title: string;
  rank: AgentRank;
  managerAgentId: string | null;
  managerName: string | null;
  workforceStatus: string;
  avatarEmoji: string;
  avatarColor: string;
};

export type OrganizationDepartmentNode = {
  department: Department;
  label: string;
  agents: OrganizationAgentNode[];
};

export type OrganizationChart = {
  founderLabel: string;
  departments: OrganizationDepartmentNode[];
};

export type CompanyOverview = {
  totalAgents: number;
  activeAgents: number;
  retiredAgents: number;
  suspendedAgents: number;
  departments: Array<{ department: Department; count: number }>;
  projects: number;
  assignments: number;
  averageReputation: number;
  utilizationRate: number;
  overallocatedAgents: number;
  promotionCandidates: number;
};

export type CouncilAgentUpgrade = {
  avatarEmoji: string;
  avatarColor: string;
  avatarType: AvatarType;
  department: Department;
  title: string;
  rank: AgentRank;
  projects: string[];
  allocationTotal: number;
  isOverallocated: boolean;
};

export type PromotionCandidate = {
  agentId: string;
  name: string;
  currentRank: AgentRank;
  suggestedRank: AgentRank;
  reputation: number;
  influenceScore: number;
  acceptedCount: number;
  reason: string;
};

export type ProjectTeamView = {
  projectId: string;
  projectName: string;
  leads: ProjectAssignmentView[];
  members: ProjectAssignmentView[];
};

export type ProjectTeamMemberView = {
  assignmentId: string;
  agentId: string;
  homeProjectId: string;
  agentName: string;
  title: string;
  department: Department;
  departmentLabel: string;
  projectRole: string;
  allocationPercent: number;
  isLead: boolean;
  status: string;
  reputation: number;
  influenceScore: number;
  avatarEmoji: string;
  avatarColor: string;
  isOverallocated: boolean;
};

export type ProjectTeamPageData = {
  projectId: string;
  projectName: string;
  members: ProjectTeamMemberView[];
  warnings: string[];
  teamHealth: TeamHealthReport;
  recentEvents: AssignmentEventView[];
  availableAgents: Array<{ id: string; name: string; title: string | null; department: string }>;
};

export type AssignmentEventView = {
  id: string;
  agentId: string;
  type: string;
  message: string;
  createdAt: Date;
};

export type TeamHealthReport = {
  status: "healthy" | "warning" | "critical";
  messages: string[];
  missingRoles: string[];
  unnecessaryRoles: string[];
  suggestedAgents: string[];
};

export type SidebarAgentView = {
  id: string;
  homeProjectId: string;
  homeProjectName: string;
  chatProjectId: string;
  name: string;
  displayName: string;
  title: string;
  department: string;
  role: string;
  avatarEmoji: string;
  avatarColor: string;
  canChat: boolean;
  lastMessagePreview: string | null;
  conversationId: string | null;
};

export const DEPARTMENT_LABELS: Record<Department, string> = {
  PRODUCT: "Product",
  ENGINEERING: "Engineering",
  QA: "QA",
  SECURITY: "Security",
  OPERATIONS: "Operations",
  RESEARCH: "Research",
};

export const RANK_ORDER: Record<AgentRank, number> = {
  INTERN: 1,
  JUNIOR: 2,
  SENIOR: 3,
  LEAD: 4,
  DIRECTOR: 5,
};
