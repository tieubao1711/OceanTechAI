import type { AvatarType, Department, AgentRank } from "@prisma/client";
import { prisma } from "@/server/db/prisma";
import { formatRoleLabel } from "./agent-profile";
import { agentInfluenceService } from "./agent-influence.service";
import { agentAvatarService } from "@/server/workforce/agent-avatar.service";
import { projectAssignmentService } from "@/server/workforce/project-assignment.service";
import { DEPARTMENT_LABELS } from "@/server/workforce/workforce-types";
import type {
  AgentBriefing,
  AgentCouncilMember,
  AgentIdentity,
  AgentProfile,
  DebateHistoryEntry,
  JournalTimelineEntry,
} from "./agent-types";
import { JOURNAL_TYPES } from "@/server/journals/journal-types";

const EXPERTISE_KEYWORDS: Record<string, string[]> = {
  Architecture: ["architecture", "scalability", "modular", "system design", "api design", "maintainability"],
  Governance: ["governance", "voting", "approval", "proposal", "reputation", "consensus"],
  Execution: ["execution", "github", "deploy", "implementation", "backend", "frontend"],
  Quality: ["test", "qa", "edge case", "regression", "quality"],
  Security: ["security", "risk", "red team", "vulnerability", "attack"],
  Product: ["product", "user", "mvp", "scope", "roadmap", "retention"],
  Economy: ["economy", "inflation", "treasury", "reward", "currency"],
};

const TOPIC_STOPWORDS = new Set([
  "the", "and", "for", "with", "from", "that", "this", "into", "about", "should",
  "would", "could", "have", "been", "their", "there", "when", "what", "which",
]);

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 3 && !TOPIC_STOPWORDS.has(w));
}

function countKeywords(texts: string[], keywords: string[]): number {
  const blob = texts.join(" ").toLowerCase();
  return keywords.filter((k) => blob.includes(k)).length;
}

function extractTopTopics(texts: string[], limit = 5): string[] {
  const counts = new Map<string, number>();
  for (const text of texts) {
    for (const token of tokenize(text)) {
      counts.set(token, (counts.get(token) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([word]) => word.charAt(0).toUpperCase() + word.slice(1));
}

function dominantStance(stances: string[]): string {
  if (stances.length === 0) return "Observer";
  const counts = new Map<string, number>();
  for (const s of stances) counts.set(s, (counts.get(s) ?? 0) + 1);
  const top = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  switch (top) {
    case "SUPPORT":
      return "Advocate";
    case "OPPOSE":
      return "Critic";
    case "REFINE":
      return "Refiner";
    case "NEUTRAL":
      return "Neutral analyst";
    default:
      return "Participant";
  }
}

export class AgentIdentityService {
  deriveIdentity(params: {
    role: string;
    expertise: string[];
    acceptedCount: number;
    rejectedCount: number;
    proposalCount: number;
    journalTypes: string[];
    messageStances: string[];
    messageConcerns: string[];
    messageSuggestions: string[];
    journalContents: string[];
    messageContents: string[];
    votesYesOnRejected: number;
    votesYesOnApproved: number;
    avgQuality: number;
  }): AgentIdentity {
    const strengths: string[] = [];
    const weaknesses: string[] = [];
    const behavioralTraits: string[] = [];

    const totalDecisions = params.acceptedCount + params.rejectedCount;
    const acceptanceRate = totalDecisions > 0 ? params.acceptedCount / totalDecisions : 0;

    if (params.acceptedCount >= 2 && acceptanceRate >= 0.6) {
      strengths.push("Trusted by governance");
    }
    if (params.journalTypes.filter((t) => t === JOURNAL_TYPES.WARNING).length >= 2) {
      strengths.push("Risk identification");
    }
    if (params.messageConcerns.length >= 5) {
      strengths.push("Raises useful risks");
    }
    if (params.avgQuality >= 70) {
      strengths.push("High-quality contributions");
    }
    if (params.votesYesOnApproved >= 2) {
      strengths.push("Aligned with approved decisions");
    }
    if (params.proposalCount >= 3) {
      strengths.push("Consistent debate participation");
    }

    if (params.rejectedCount >= 2 && params.votesYesOnRejected >= 1) {
      weaknesses.push("Overconfidence in rejected proposals");
    }
    const opposeCount = params.messageStances.filter((s) => s === "OPPOSE").length;
    const supportCount = params.messageStances.filter((s) => s === "SUPPORT").length;
    if (opposeCount > supportCount * 1.5 && opposeCount >= 3) {
      weaknesses.push("Frequently dissenting");
    }
    if (params.proposalCount === 0) {
      weaknesses.push("Limited debate engagement");
    }
    if (params.avgQuality < 55 && params.proposalCount >= 2) {
      weaknesses.push("Inconsistent message quality");
    }
    const refineHeavy = params.messageStances.filter((s) => s === "REFINE").length;
    if (refineHeavy >= 4 && params.messageSuggestions.length >= 6) {
      weaknesses.push("Sometimes over-engineers solutions");
    }

    if (opposeCount >= 3) behavioralTraits.push("Critical thinker");
    if (refineHeavy >= 3) behavioralTraits.push("Detail-oriented refiner");
    if (supportCount >= 3) behavioralTraits.push("Collaborative supporter");
    if (params.journalTypes.includes(JOURNAL_TYPES.IDEA)) behavioralTraits.push("Ideation-focused");
    if (params.journalTypes.includes(JOURNAL_TYPES.WARNING)) behavioralTraits.push("Risk-aware");

    const expertiseAreas = [...params.expertise];
    for (const [area, keywords] of Object.entries(EXPERTISE_KEYWORDS)) {
      const hits = countKeywords(
        [...params.journalContents, ...params.messageContents],
        keywords
      );
      if (hits >= 2 && !expertiseAreas.some((e) => e.toLowerCase().includes(area.toLowerCase()))) {
        expertiseAreas.push(area);
      }
    }

    const preferredTopics = extractTopTopics([
      ...params.journalContents,
      ...params.messageSuggestions.join(" "),
    ]);
    const avoidedTopics =
      params.proposalCount > 0 && params.messageContents.length < 2
        ? extractTopTopics(params.messageConcerns, 3)
        : [];

    return {
      strengths: [...new Set(strengths)].slice(0, 6),
      weaknesses: [...new Set(weaknesses)].slice(0, 4),
      expertiseAreas: [...new Set(expertiseAreas)].slice(0, 8),
      behavioralTraits: [...new Set(behavioralTraits)].slice(0, 5),
      preferredTopics: preferredTopics.slice(0, 6),
      avoidedTopics: avoidedTopics.slice(0, 4),
    };
  }

  buildBriefing(params: {
    name: string;
    role: string;
    identity: AgentIdentity;
  }): AgentBriefing {
    const roleLabel = formatRoleLabel(params.role);
    const shortName = params.name.split("—")[0]?.trim() ?? params.name;

    const strongIn =
      params.identity.strengths.length > 0
        ? params.identity.expertiseAreas.slice(0, 4)
        : params.identity.expertiseAreas.slice(0, 3);

    const frequentlyRecommends = params.identity.preferredTopics.slice(0, 4);
    const risks =
      params.identity.weaknesses.length > 0
        ? params.identity.weaknesses
        : ["No significant risks identified yet"];

    const summary = [
      `${shortName} is the primary ${roleLabel.toLowerCase()} advisor for this project.`,
      strongIn.length > 0 ? `Strong in: ${strongIn.join(", ")}.` : "",
      frequentlyRecommends.length > 0
        ? `Frequently recommends: ${frequentlyRecommends.join(", ")}.`
        : "",
      risks[0] ? `Risk: ${risks[0].toLowerCase()}.` : "",
    ]
      .filter(Boolean)
      .join("\n\n");

    return {
      summary,
      roleDescription: `${shortName} serves as ${roleLabel}, shaping decisions through debate participation and organizational memory.`,
      strongIn,
      frequentlyRecommends,
      risks,
    };
  }

  async getLastActivity(agentId: string, projectId: string): Promise<Date | null> {
    const [lastMessage, lastJournal, agent] = await Promise.all([
      prisma.agentMessage.findFirst({
        where: { agentId, round: { discussion: { projectId } } },
        orderBy: { createdAt: "desc" },
        select: { createdAt: true },
      }),
      prisma.agentJournal.findFirst({
        where: { agentId, projectId },
        orderBy: { createdAt: "desc" },
        select: { createdAt: true },
      }),
      prisma.agent.findUnique({ where: { id: agentId }, select: { updatedAt: true } }),
    ]);

    const dates = [
      lastMessage?.createdAt,
      lastJournal?.createdAt,
      agent?.updatedAt,
    ].filter((d): d is Date => d != null);

    if (dates.length === 0) return null;
    return new Date(Math.max(...dates.map((d) => d.getTime())));
  }

  async buildCouncilMember(agent: {
    id: string;
    name: string;
    role: string;
    isActive: boolean;
    reputationScore: number;
    acceptedCount: number;
    rejectedCount: number;
    proposalCount: number;
    department?: Department;
    title?: string | null;
    rank?: AgentRank;
    avatarType?: AvatarType;
    avatarSeed?: string | null;
    workforceStatus?: string;
  }, projectId: string): Promise<AgentCouncilMember> {
    const [lastActivity, warningCount, assignments, capacity] = await Promise.all([
      this.getLastActivity(agent.id, projectId),
      prisma.agentJournal.count({
        where: { agentId: agent.id, projectId, type: JOURNAL_TYPES.WARNING },
      }),
      projectAssignmentService.listByAgent(agent.id),
      projectAssignmentService.getAgentCapacity(agent.id),
    ]);

    const influenceScore = agentInfluenceService.calculateScore({
      acceptedCount: agent.acceptedCount,
      rejectedCount: agent.rejectedCount,
      proposalCount: agent.proposalCount,
      reputationScore: agent.reputationScore,
      warningJournalCount: warningCount,
    });

    const avatar = agentAvatarService.resolve(
      agent.avatarSeed ?? agent.name,
      agent.avatarType ?? "CORPORATE"
    );

    const status =
      agent.workforceStatus === "RETIRED"
        ? "retired"
        : agent.workforceStatus === "SUSPENDED"
          ? "suspended"
          : agent.isActive
            ? "active"
            : "dormant";

    return {
      id: agent.id,
      name: agent.name,
      role: agent.role,
      status,
      reputation: agent.reputationScore,
      acceptedCount: agent.acceptedCount,
      rejectedCount: agent.rejectedCount,
      proposalCount: agent.proposalCount,
      lastActivity,
      influenceScore,
      avatarEmoji: avatar.emoji,
      avatarColor: avatar.color,
      department: DEPARTMENT_LABELS[agent.department ?? "ENGINEERING"],
      title: agent.title ?? formatRoleLabel(agent.role),
      rank: agent.rank ?? "SENIOR",
      projects: assignments.map((a) => a.projectName),
      allocationTotal: capacity.allocationTotal,
      isOverallocated: capacity.isOverallocated,
    };
  }

  async getDebateHistory(agentId: string, projectId: string, limit = 20): Promise<DebateHistoryEntry[]> {
    const discussions = await prisma.discussion.findMany({
      where: {
        projectId,
        rounds: { some: { messages: { some: { agentId } } } },
      },
      include: {
        proposal: { select: { title: true, status: true } },
        rounds: {
          include: {
            messages: {
              where: { agentId },
              select: { stance: true, vote: true, createdAt: true },
            },
          },
          orderBy: { roundNumber: "asc" },
        },
      },
      orderBy: { updatedAt: "desc" },
      take: limit,
    });

    const voteRecords = await prisma.voteRecord.findMany({
      where: {
        agentId,
        discussionId: { in: discussions.map((d) => d.id) },
      },
    });
    const voteByDiscussion = new Map(voteRecords.map((v) => [v.discussionId, v.vote]));

    return discussions.map((d) => {
      const stances = d.rounds.flatMap((r) => r.messages.map((m) => m.stance));
      const title =
        d.proposal?.title ??
        (d.userPrompt.length > 80 ? `${d.userPrompt.slice(0, 80)}…` : d.userPrompt);

      return {
        discussionId: d.id,
        title,
        roleInDebate: dominantStance(stances),
        vote: voteByDiscussion.get(d.id) ?? d.rounds.flatMap((r) => r.messages).find((m) => m.vote)?.vote ?? null,
        outcome: d.proposal?.status ?? (d.status === "COMPLETED" ? "COMPLETED" : null),
        occurredAt: d.rounds.flatMap((r) => r.messages).at(-1)?.createdAt ?? d.updatedAt,
      };
    });
  }

  async getJournalTimeline(agentId: string, projectId: string, limit = 30): Promise<JournalTimelineEntry[]> {
    const journals = await prisma.agentJournal.findMany({
      where: { agentId, projectId },
      orderBy: { createdAt: "desc" },
      take: limit,
    });

    return journals.map((j) => ({
      id: j.id,
      type: j.type,
      title: j.title,
      content: j.content,
      createdAt: j.createdAt,
    }));
  }

  async getAgentProfile(projectId: string, agentId: string): Promise<AgentProfile> {
    const agent = await prisma.agent.findFirstOrThrow({
      where: { id: agentId, projectId },
    });

    const discussionIds = (
      await prisma.discussion.findMany({
        where: { projectId },
        select: { id: true },
      })
    ).map((d) => d.id);

    const [messages, journals, votes, member, proposals] = await Promise.all([
      prisma.agentMessage.findMany({
        where: { agentId, round: { discussion: { projectId } } },
        select: {
          stance: true,
          concerns: true,
          suggestions: true,
          content: true,
          qualityScore: true,
        },
      }),
      prisma.agentJournal.findMany({
        where: { agentId, projectId },
        select: { type: true, title: true, content: true },
      }),
      prisma.voteRecord.findMany({
        where: {
          agentId,
          discussionId: { in: discussionIds },
        },
      }),
      this.buildCouncilMember(agent, projectId),
      prisma.proposal.findMany({
        where: { discussion: { projectId } },
        select: { discussionId: true, status: true },
      }),
    ]);

    const avgQuality =
      messages.filter((m) => m.qualityScore != null).length > 0
        ? messages.reduce((s, m) => s + (m.qualityScore ?? 0), 0) /
          messages.filter((m) => m.qualityScore != null).length
        : 70;

    const proposalStatusByDiscussion = new Map(
      proposals.map((p) => [p.discussionId, p.status])
    );

    let votesYesOnApproved = 0;
    let votesYesOnRejected = 0;
    for (const v of votes) {
      if (v.vote !== "YES") continue;
      const status = proposalStatusByDiscussion.get(v.discussionId);
      if (status === "APPROVED") votesYesOnApproved++;
      if (status === "REJECTED") votesYesOnRejected++;
    }

    const identity = this.deriveIdentity({
      role: agent.role,
      expertise: agent.expertise,
      acceptedCount: agent.acceptedCount,
      rejectedCount: agent.rejectedCount,
      proposalCount: agent.proposalCount,
      journalTypes: journals.map((j) => j.type),
      messageStances: messages.map((m) => m.stance),
      messageConcerns: messages.flatMap((m) => m.concerns),
      messageSuggestions: messages.flatMap((m) => m.suggestions),
      journalContents: journals.map((j) => `${j.title} ${j.content}`),
      messageContents: messages.map((m) => m.content),
      votesYesOnRejected,
      votesYesOnApproved,
      avgQuality,
    });

    const briefing = this.buildBriefing({
      name: agent.name,
      role: agent.role,
      identity,
    });

    const [debateHistory, journalTimeline] = await Promise.all([
      this.getDebateHistory(agentId, projectId, 20),
      this.getJournalTimeline(agentId, projectId, 30),
    ]);

    return {
      member,
      expertise: agent.expertise,
      systemPrompt: agent.systemPrompt,
      votingWeight: agent.votingWeight,
      identity,
      briefing,
      debateHistory,
      journalTimeline,
    };
  }
}

export const agentIdentityService = new AgentIdentityService();
