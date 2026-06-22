import { prisma } from "@/server/db/prisma";
import type { ConsensusResult } from "@/types/consensus";
import {
  buildDecisionRecordContent,
  buildDiscussionSummaryContent,
} from "@/server/governance/oceantechai-constitution";
import { JOURNAL_TYPES } from "./journal-types";

interface JournalDraft {
  agentRole: string;
  type: string;
  title: string;
  content: string;
}

const ECONOMY_KEYWORDS = ["economy", "treasury", "inflation", "gold", "currency", "reward"];
export class JournalGenerator {
  async generateFromDebate(discussionId: string, consensus: ConsensusResult) {
    const discussion = await prisma.discussion.findUniqueOrThrow({
      where: { id: discussionId },
      include: {
        proposal: true,
        rounds: {
          include: { messages: { include: { agent: true } } },
          orderBy: { roundNumber: "asc" },
        },
      },
    });

    const agents = await prisma.agent.findMany({
      where: { projectId: discussion.projectId, isActive: true },
    });
    const agentByRole = new Map(agents.map((a) => [a.role, a]));

    const allConcerns = discussion.rounds.flatMap((r) =>
      r.messages.flatMap((m) => m.concerns)
    );
    const allRisks = consensus.risks ?? [];
    const textBlob = [
      consensus.title,
      consensus.finalDecision,
      ...allConcerns,
      ...allRisks,
      ...(consensus.reasons ?? []),
    ]
      .join(" ")
      .toLowerCase();

    const participantNames = [
      ...new Set(
        discussion.rounds.flatMap((r) => r.messages.map((m) => m.agent.name))
      ),
    ];

    const mainViews = (discussion.rounds.find((r) => r.roundNumber === 1)?.messages ?? [])
      .map((m) => `${m.agent.name}: ${m.content.slice(0, 200)}`)
      .slice(0, 6);

    const nextActions = [
      ...(consensus.reasons ?? []).slice(0, 3).map((r) => `Thực hiện: ${r}`),
      "Founder xem xét và duyệt đề xuất chính thức.",
    ];

    const drafts: JournalDraft[] = [
      {
        agentRole: "product_manager",
        type: JOURNAL_TYPES.DISCUSSION_SUMMARY,
        title: `Tóm tắt thảo luận: ${consensus.title}`,
        content: buildDiscussionSummaryContent({
          topic: discussion.userPrompt,
          mainViews,
          risks: allRisks,
          conclusion: consensus.finalDecision,
          nextActions,
        }),
      },
      {
        agentRole: "product_manager",
        type: JOURNAL_TYPES.DECISION,
        title: `Quyết định dự thảo: ${consensus.title}`,
        content: buildDecisionRecordContent({
          title: consensus.title,
          date: new Date().toISOString().slice(0, 10),
          participants: participantNames,
          reason: discussion.userPrompt,
          decision: consensus.finalDecision,
          impact: `Phân loại phiếu: ${consensus.voteSummary.classification}`,
          status: "CHỜ_FOUNDER_DUYỆT",
        }),
      },
    ];

    if (this.matchesKeywords(textBlob, ECONOMY_KEYWORDS)) {
      drafts.push({
        agentRole: "economy_designer",
        type: JOURNAL_TYPES.LESSON_LEARNED,
        title: "Economy review before approval",
        content: `Lesson Learned\n\nTreasury and reward mechanics in "${consensus.title}" may cause inflation.\n\nNên review economy impact trước khi Founder approve.`,
      });
    }

    if (allConcerns.length >= 2 || allRisks.length >= 2) {
      drafts.push({
        agentRole: "qa_engineer",
        type: JOURNAL_TYPES.OBSERVATION,
        title: "Edge cases detected",
        content: `Observation\n\nFeature "${consensus.title}" có nhiều edge cases (${allConcerns.length} concerns, ${allRisks.length} risks).\n\nNên bổ sung automated tests trước khi ship.`,
      });
    }

    if (allRisks.length > 0) {
      drafts.push({
        agentRole: "red_team",
        type: JOURNAL_TYPES.WARNING,
        title: "Risks flagged in debate",
        content: `Warning\n\n${allRisks.map((r) => `- ${r}`).join("\n")}\n\nFounder nên review risks trước khi approve.`,
      });
    }

    drafts.push({
      agentRole: "product_manager",
      type: JOURNAL_TYPES.IDEA,
      title: `MVP scope for ${consensus.title}`,
      content: `Idea\n\nGiữ MVP scope ≤ 2 tuần cho "${consensus.finalDecision}".\n\nƯu tiên retention trước monetization.`,
    });

    drafts.push({
      agentRole: "system_architect",
      type: JOURNAL_TYPES.OBSERVATION,
      title: "Architecture alignment",
      content: `Observation\n\nSolution "${consensus.finalDecision}" nên align với PostgreSQL + REST /api/v1/ conventions đã chốt trong project memory.`,
    });

    const proposalId = discussion.proposal?.id;
    const created = [];

    for (const draft of drafts) {
      const agent = agentByRole.get(draft.agentRole);
      if (!agent) continue;

      const journal = await prisma.agentJournal.create({
        data: {
          agentId: agent.id,
          projectId: discussion.projectId,
          discussionId,
          proposalId,
          title: draft.title,
          content: draft.content,
          type: draft.type,
        },
      });
      created.push(journal);
    }

    return created;
  }

  private matchesKeywords(text: string, keywords: string[]): boolean {
    return keywords.some((k) => text.includes(k));
  }
}

export const journalGenerator = new JournalGenerator();
