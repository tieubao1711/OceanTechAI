import type { DecisionAction } from "@prisma/client";

import { prisma } from "@/server/db/prisma";

import type { ArchitectureAuditReport, AuditFinding } from "@/server/audit/audit-types";

import { parseArchitectureAuditReport } from "@/server/audit/audit-quality";

import type { ExecutionResult } from "@/server/execution/execution-plan";

import { timelineService, TIMELINE_EVENT_TYPES } from "@/server/insights/timeline.service";

import {

  detectAuditCompleted,

  detectDebtResolved,

  detectExecutionCompleted,

  detectProposalApproved,

  detectResolvedDebts,

  detectSelfImprovementCompleted,

  isTopicAlreadySolved,

} from "./learning-detector";

import { memoryIntegrityService } from "./integrity/memory-integrity.service";

import type { DuplicateCheckResult } from "./learning-types";



export class LearningCaptureService {

  async captureFromAudit(params: {

    projectId: string;

    discussionId: string;

    report: ArchitectureAuditReport;

    proposalId?: string;

  }) {

    const events = [detectAuditCompleted(params.report)];



    for (const finding of params.report.topFindings) {

      await memoryIntegrityService.registerDebtFromAudit({

        projectId: params.projectId,

        finding,

      });

    }



    const previousAudit = await this.getPreviousAuditReport(params.projectId, params.discussionId);

    if (previousAudit) {

      const resolved = detectResolvedDebts(

        previousAudit.topFindings,

        params.report.topFindings

      );

      for (const finding of resolved) {

        events.push(detectDebtResolved(finding));

        await this.captureDebtResolved({

          projectId: params.projectId,

          finding,

          validationAuditId: params.discussionId,

        });

      }

    }



    if (params.proposalId) {

      await memoryIntegrityService.openOrLinkImprovementCycle({

        projectId: params.projectId,

        title: params.report.topFindings[0]?.title ?? "Architecture improvement",

        auditDiscussionId: params.discussionId,

        proposalId: params.proposalId,

      });

    }



    for (const event of events) {

      await memoryIntegrityService.recordLearningEvent({

        projectId: params.projectId,

        event,

        referenceId: params.discussionId,

      });

    }



    return { eventsCaptured: events.length };

  }



  async captureFromProposalApproval(params: {

    projectId: string;

    proposalId: string;

    title: string;

    chosenSolution: string;

    risks: string[];

    action: DecisionAction;

    discussionId: string;

  }) {

    const event = detectProposalApproved(params);

    if (!event) return null;



    await memoryIntegrityService.recordLearningEvent({

      projectId: params.projectId,

      event,

      referenceId: params.proposalId,

      linkedProposalId: params.proposalId,

    });



    await memoryIntegrityService.markDebtImplemented({

      projectId: params.projectId,

      proposalId: params.proposalId,

      debtTitle: params.title,

    });



    await prisma.improvementCycle.updateMany({

      where: { proposalId: params.proposalId, status: "OPEN" },

      data: { status: "IMPLEMENTED" },

    });



    const adrDraft = await this.maybeCreateAdrDraft({

      projectId: params.projectId,

      event,

      proposalTitle: params.title,

      chosenSolution: params.chosenSolution,

    });



    return { event, adrDraftId: adrDraft?.id };

  }



  async captureFromExecution(params: {

    projectId: string;

    proposalId: string;

    proposalTitle: string;

    result: ExecutionResult;

  }) {

    const event = detectExecutionCompleted({

      proposalTitle: params.proposalTitle,

      result: params.result,

    });

    if (!event) return null;



    await memoryIntegrityService.recordLearningEvent({

      projectId: params.projectId,

      event,

      referenceId: params.proposalId,

      linkedProposalId: params.proposalId,

    });



    await timelineService.recordEvent({

      projectId: params.projectId,

      title: `GitHub execution: ${params.proposalTitle}`,

      description: event.outcome,

      eventType: TIMELINE_EVENT_TYPES.GITHUB_EXECUTED,

      referenceId: params.proposalId,

    });



    await prisma.improvementCycle.updateMany({

      where: {

        proposalId: params.proposalId,

        status: { in: ["OPEN", "IMPLEMENTED"] },

      },

      data: {

        executionId: params.proposalId,

        status: "IMPLEMENTED",

      },

    });



    return event;

  }



  async checkDuplicateTopic(

    projectId: string,

    topic: string

  ): Promise<DuplicateCheckResult> {

    const solvedTopics = await this.collectSolvedTopics(projectId);

    const match = isTopicAlreadySolved(topic, solvedTopics);

    if (!match.matched) {

      return { isDuplicate: false };

    }



    return {

      isDuplicate: true,

      warning: "Similar improvement already completed.",

      matchedTopic: match.matchedTopic,

      source: "completed_cycle",

    };

  }



  getLearningCenterData(projectId: string) {

    return memoryIntegrityService.getLearningCenterData(projectId);

  }



  repairProjectMemory(projectId: string) {

    return memoryIntegrityService.repairProject(projectId);

  }



  private async captureDebtResolved(params: {

    projectId: string;

    finding: AuditFinding;

    validationAuditId: string;

  }) {

    const event = detectDebtResolved(params.finding);



    await memoryIntegrityService.markDebtVerified({

      projectId: params.projectId,

      finding: params.finding,

      validationAuditId: params.validationAuditId,

    });



    const cycle = await memoryIntegrityService.verifyCycleForDebt({

      projectId: params.projectId,

      finding: params.finding,

      validationAuditId: params.validationAuditId,

    });



    await memoryIntegrityService.recordLearningEvent({

      projectId: params.projectId,

      event,

      referenceId: params.finding.title,

      linkedDebtTitle: params.finding.title,

      linkedCycleId: cycle?.id,

    });



    if (cycle) {

      const completedEvent = detectSelfImprovementCompleted({

        cycleTitle: cycle.title,

        resolvedDebt: params.finding.title,

        validationAuditId: params.validationAuditId,

      });



      await memoryIntegrityService.recordLearningEvent({

        projectId: params.projectId,

        event: completedEvent,

        referenceId: cycle.id,

        linkedCycleId: cycle.id,

        linkedDebtTitle: params.finding.title,

      });



      await timelineService.recordEvent({

        projectId: params.projectId,

        title: completedEvent.title,

        description: completedEvent.outcome,

        eventType: TIMELINE_EVENT_TYPES.MILESTONE,

        referenceId: cycle.id,

      });

    }

  }



  private async maybeCreateAdrDraft(params: {

    projectId: string;

    event: { importance: string; outcome: string };

    proposalTitle: string;

    chosenSolution: string;

  }) {

    if (params.event.importance !== "high") return null;

    if (!params.event.outcome.toLowerCase().includes("approved")) return null;



    const slug = params.proposalTitle

      .toLowerCase()

      .replace(/[^a-z0-9]+/g, "-")

      .replace(/^-|-$/g, "")

      .slice(0, 48);



    const maxNumber = await prisma.adr.aggregate({

      where: { projectId: params.projectId },

      _max: { number: true },

    });

    const nextNumber = (maxNumber._max.number ?? 0) + 1;



    const existing = await prisma.adr.findFirst({

      where: { projectId: params.projectId, slug },

    });

    if (existing) return existing;



    return prisma.adr.create({

      data: {

        projectId: params.projectId,

        number: nextNumber,

        slug,

        title: `ADR-${String(nextNumber).padStart(3, "0")}: ${params.proposalTitle}`,

        status: "DRAFT",

        summary: [

          "Auto-generated from successful high-importance learning capture.",

          "",

          `Decision: ${params.proposalTitle}`,

          `Solution: ${params.chosenSolution}`,

          `Outcome: ${params.event.outcome}`,

        ].join("\n"),

        filePath: `docs/decisions/ADR-${String(nextNumber).padStart(3, "0")}-${slug.toUpperCase()}.md`,

      },

    });

  }



  private async getPreviousAuditReport(projectId: string, excludeDiscussionId: string) {

    const previous = await prisma.discussion.findFirst({

      where: {

        projectId,

        mode: "architecture_audit",

        status: "COMPLETED",

        id: { not: excludeDiscussionId },

      },

      orderBy: { updatedAt: "desc" },

      select: { consensusJson: true },

    });



    if (!previous?.consensusJson) return null;

    return parseArchitectureAuditReport(previous.consensusJson);

  }



  private async collectSolvedTopics(projectId: string): Promise<string[]> {
    const { loadVerifiedTopics } = await import("./integrity/resolved-topics");
    const snapshot = await loadVerifiedTopics(projectId);
    const topics = snapshot.entries.map((e) => e.title);

    const adrs = await prisma.adr.findMany({
      where: { projectId, status: "ACCEPTED" },
      select: { title: true, summary: true },
    });
    for (const adr of adrs) topics.push(adr.title, adr.summary ?? "");

    return topics.filter(Boolean);
  }

}



export const learningCaptureService = new LearningCaptureService();


