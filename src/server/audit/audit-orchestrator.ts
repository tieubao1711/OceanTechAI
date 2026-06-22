import type { Stance } from "@prisma/client";
import { prisma } from "@/server/db/prisma";
import {
  assertActiveAgentsForDebate,
  assertDiscussionCanRun,
} from "@/server/invariants/debate-invariants";
import { projectKnowledgeService } from "@/server/knowledge/project-knowledge.service";
import { journalService } from "@/server/journals/journal.service";
import { timelineService, TIMELINE_EVENT_TYPES } from "@/server/insights/timeline.service";
import { AUDIT_AGENT_ROLES, type ArchitectureAuditReport, type AuditContext } from "./audit-types";
import { auditAgentRunner } from "./audit-agent-runner";
import { auditConsensusEngine, buildAuditSummary } from "./audit-consensus";
import { auditProposalGenerator } from "./audit-proposal-generator";
import { learningCaptureService } from "@/server/learning/learning-capture.service";
import type { ConsensusResult } from "@/types/consensus";

function reportToConsensus(
  report: ArchitectureAuditReport,
  userPrompt: string
): ConsensusResult {
  return {
    title: userPrompt.slice(0, 80),
    finalDecision: report.recommendations.join("\n"),
    alternativesConsidered: report.strengths,
    reasons: report.topFindings.map((f) => `${f.title}: ${f.evidence}`),
    risks: report.risks,
    openQuestions: [],
    voteSummary: {
      yes: 0,
      no: 0,
      abstain: 0,
      raw: { yes: 0, no: 0, abstain: 0 },
      classification: "strong",
      dissenting: [],
      redTeamDissent: false,
    },
  };
}

function toPrismaStance(stance: string): Stance {
  const map: Record<string, Stance> = {
    support: "SUPPORT",
    oppose: "OPPOSE",
    neutral: "NEUTRAL",
    refine: "REFINE",
  };
  return map[stance] ?? "NEUTRAL";
}

export class AuditOrchestrator {
  async run(discussionId: string): Promise<ArchitectureAuditReport> {
    const discussion = await prisma.discussion.findUniqueOrThrow({
      where: { id: discussionId },
      include: { project: { include: { workspace: true } } },
    });

    assertDiscussionCanRun(discussion.status);

    const allAgents = await prisma.agent.findMany({
      where: { projectId: discussion.projectId, isActive: true },
      orderBy: { createdAt: "asc" },
    });

    const auditAgents = allAgents.filter((a) =>
      AUDIT_AGENT_ROLES.includes(a.role as (typeof AUDIT_AGENT_ROLES)[number])
    );

    assertActiveAgentsForDebate(auditAgents);

    await prisma.discussion.update({
      where: { id: discussionId },
      data: { status: "RUNNING", lastError: null },
    });

    try {
      const snapshot = await projectKnowledgeService.buildForProject(discussion.projectId);
      const projectKnowledge = projectKnowledgeService.formatForAuditPrompt(snapshot);

      const context: AuditContext = {
        discussionId,
        projectId: discussion.projectId,
        userPrompt: discussion.userPrompt,
        projectKnowledge,
        snapshot,
        agents: auditAgents,
      };

      let tokenUsage = 0;

      const round1 = await prisma.discussionRound.upsert({
        where: {
          discussionId_roundNumber: { discussionId, roundNumber: 1 },
        },
        create: {
          discussionId,
          roundNumber: 1,
          roundType: "PROPOSE",
          status: "RUNNING",
        },
        update: { status: "RUNNING" },
      });

      const round1Results = await Promise.all(
        auditAgents.map((agent) => auditAgentRunner.runFindings(agent, context))
      );

      for (const r of round1Results) {
        tokenUsage += r.tokenTotal;
        await prisma.agentMessage.create({
          data: {
            roundId: round1.id,
            agentId: r.agentId,
            stance: toPrismaStance("support"),
            content: r.content,
            concerns: r.concerns,
            suggestions: r.suggestions,
            qualityScore: r.qualityScore,
            provider: r.provider,
            model: r.model,
            tokenTotal: r.tokenTotal,
          },
        });
      }

      await prisma.discussionRound.update({
        where: { id: round1.id },
        data: { status: "COMPLETED" },
      });

      const auditSummary = buildAuditSummary(round1Results);

      const round2 = await prisma.discussionRound.upsert({
        where: {
          discussionId_roundNumber: { discussionId, roundNumber: 2 },
        },
        create: {
          discussionId,
          roundNumber: 2,
          roundType: "CRITIQUE",
          status: "RUNNING",
        },
        update: { status: "RUNNING" },
      });

      const round2Results = [];
      for (const agent of auditAgents) {
        const r = await auditAgentRunner.runCritique(agent, context, auditSummary);
        tokenUsage += r.tokenTotal;
        round2Results.push(r);
        await prisma.agentMessage.create({
          data: {
            roundId: round2.id,
            agentId: r.agentId,
            stance: toPrismaStance("neutral"),
            content: r.content,
            concerns: r.concerns,
            suggestions: [],
            provider: r.provider,
            model: r.model,
            tokenTotal: r.tokenTotal,
          },
        });
      }

      await prisma.discussionRound.update({
        where: { id: round2.id },
        data: { status: "COMPLETED" },
      });

      const report = auditConsensusEngine.merge({
        round1: round1Results,
        round2: round2Results,
        snapshot,
        tokenUsage,
      });

      await prisma.discussionRound.upsert({
        where: {
          discussionId_roundNumber: { discussionId, roundNumber: 3 },
        },
        create: {
          discussionId,
          roundNumber: 3,
          roundType: "CONSENSUS",
          status: "COMPLETED",
        },
        update: { status: "COMPLETED" },
      });

      await prisma.discussion.update({
        where: { id: discussionId },
        data: {
          status: "COMPLETED",
          consensusJson: report as object,
          lastError: null,
        },
      });

      const proposal = await auditProposalGenerator.create(discussionId, report);

      await journalService.generateFromDebate(
        discussionId,
        reportToConsensus(report, discussion.userPrompt)
      );

      await timelineService.recordEvent({
        projectId: discussion.projectId,
        title: `Architecture audit completed`,
        description: `Top debt: ${report.topFindings[0]?.title ?? "none"}`,
        eventType: TIMELINE_EVENT_TYPES.DISCUSSION_COMPLETED,
        referenceId: discussionId,
      });

      await timelineService.recordEvent({
        projectId: discussion.projectId,
        title: `Audit proposal: Top ${report.topFindings.length} technical debts`,
        eventType: TIMELINE_EVENT_TYPES.PROPOSAL_CREATED,
        referenceId: proposal.id,
      });

      await learningCaptureService.captureFromAudit({
        projectId: discussion.projectId,
        discussionId,
        report,
        proposalId: proposal.id,
      });

      return report;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await prisma.discussion.update({
        where: { id: discussionId },
        data: { status: "FAILED", lastError: message },
      });
      throw err;
    }
  }
}

export const auditOrchestrator = new AuditOrchestrator();
