import type { DecisionAction, Prisma } from "@prisma/client";
import { prisma } from "@/server/db/prisma";
import { memoryService } from "@/server/memory/memory.service";
import { JOURNAL_TYPES } from "@/server/journals/journal-types";
import { timelineService, TIMELINE_EVENT_TYPES } from "./timeline.service";
import { reputationService } from "./reputation.service";
import { learningCaptureService } from "@/server/learning/learning-capture.service";

type Tx = Prisma.TransactionClient;

export class DecisionLearningService {
  async recordOutcome(
    proposalId: string,
    action: DecisionAction,
    notes?: string,
    tx?: Tx
  ) {
    const db = tx ?? prisma;

    const proposal = await db.proposal.findUniqueOrThrow({
      where: { id: proposalId },
      include: {
        discussion: true,
        decisionLog: true,
      },
    });

    const projectId = proposal.discussion.projectId;
    const discussionId = proposal.discussionId;

    const lessons = this.extractLessons(proposal, action);
    const adr = await this.findRelatedAdr(db, projectId, proposal.title);

    const pmAgent = await db.agent.findFirst({
      where: { projectId, role: "product_manager" },
    });

    if (pmAgent) {
      await db.agentJournal.create({
        data: {
          agentId: pmAgent.id,
          projectId,
          discussionId,
          proposalId,
          adrId: adr?.id,
          type: JOURNAL_TYPES.DECISION,
          title: `Decision: ${proposal.title}`,
          content: [
            `Decision: ${proposal.title}`,
            `Outcome: ${action}`,
            "",
            "Lessons:",
            ...lessons.map((l) => `- ${l}`),
            notes ? `\nFounder notes: ${notes}` : "",
          ].join("\n"),
        },
      });
    }

    await memoryService.upsertEntry({
      scope: "DECISION",
      projectId,
      key: `decision_${proposal.id}`,
      value: [
        `Proposal: ${proposal.title}`,
        `Outcome: ${action}`,
        `Lessons: ${lessons.join("; ")}`,
        adr ? `ADR: ${adr.title}` : "",
      ].join("\n"),
      source: "decision_learning",
    });

    const timelineType =
      action === "APPROVED"
        ? TIMELINE_EVENT_TYPES.PROPOSAL_APPROVED
        : action === "REJECTED"
          ? TIMELINE_EVENT_TYPES.PROPOSAL_REJECTED
          : TIMELINE_EVENT_TYPES.PROPOSAL_CHANGES_REQUESTED;

    if (!tx) {
      await timelineService.recordEvent({
        projectId,
        title: `${proposal.title} — ${action}`,
        description: lessons.join("; "),
        eventType: timelineType,
        referenceId: proposalId,
      });
      await reputationService.updateAfterDecision(discussionId, action);
      await learningCaptureService.captureFromProposalApproval({
        projectId,
        proposalId,
        title: proposal.title,
        chosenSolution: proposal.chosenSolution,
        risks: proposal.risks,
        action,
        discussionId,
      });
    }

    return { lessons, adrId: adr?.id };
  }

  private extractLessons(
    proposal: {
      title: string;
      chosenSolution: string;
      risks: string[];
      status: string;
    },
    action: DecisionAction
  ): string[] {
    const lessons: string[] = [];

    if (action === "APPROVED") {
      lessons.push(`Accepted solution: ${proposal.chosenSolution}`);
      if (proposal.risks.some((r) => r.toLowerCase().includes("inflation"))) {
        lessons.push("Need inflation control for economy features.");
      }
      lessons.push("Document decision in ADR and generated files.");
    } else if (action === "REJECTED") {
      lessons.push("Founder rejected — revisit assumptions before re-proposing.");
      if (proposal.risks.length > 0) {
        lessons.push(`Key risks blocked approval: ${proposal.risks[0]}`);
      }
    } else {
      lessons.push("Founder requested changes — narrow MVP scope.");
    }

    return lessons;
  }

  private async findRelatedAdr(
    db: Tx | typeof prisma,
    projectId: string,
    proposalTitle: string
  ) {
    const adrs = await db.adr.findMany({ where: { projectId } });
    const lower = proposalTitle.toLowerCase();
    return (
      adrs.find((a) => lower.includes(a.slug.replace(/-/g, " "))) ??
      adrs.find((a) => a.title.toLowerCase().includes("approval")) ??
      null
    );
  }
}

export const decisionLearningService = new DecisionLearningService();
