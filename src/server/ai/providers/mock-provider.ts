import type { Agent, RoundType } from "@prisma/client";
import type { AIProvider, AIProviderRequest, AIProviderResponse } from "./ai-provider";
import {
  generateMockAgentResponse,
  generateMockAuditPhaseResponse,
  generateMockOfficeHoursResponse,
} from "@/server/agents/mock-agent-responses";
import type { MockOfficeHoursMetadata } from "@/server/office-hours/office-hours-types";
import type { RoundContext } from "@/types/debate";
import type { AuditContext } from "@/server/audit/audit-types";

export type MockProviderMetadata = {
  agent: Agent;
  roundType: RoundType;
  roundContext: RoundContext;
};

export type MockAuditMetadata = {
  agent: Agent;
  auditPhase: "findings" | "critique";
  auditContext: AuditContext;
};

export class MockProvider implements AIProvider {
  readonly name = "mock" as const;

  isAvailable(): boolean {
    return true;
  }

  async generate(request: AIProviderRequest): Promise<AIProviderResponse> {
    const auditMeta = request.metadata as MockAuditMetadata | undefined;
    if (auditMeta?.agent && auditMeta?.auditPhase && auditMeta?.auditContext) {
      const payload = generateMockAuditPhaseResponse(
        auditMeta.agent,
        auditMeta.auditPhase,
        auditMeta.auditContext
      );
      return {
        content: JSON.stringify(payload),
        model: "mock-v1",
        provider: "mock",
      };
    }

    const officeMeta = request.metadata as MockOfficeHoursMetadata | undefined;
    if (officeMeta?.agent && officeMeta.founderMessage && request.responseFormat === "text") {
      return {
        content: generateMockOfficeHoursResponse(officeMeta.agent, officeMeta.founderMessage),
        model: "mock-v1",
        provider: "mock",
      };
    }

    const meta = request.metadata as MockProviderMetadata | undefined;

    if (meta?.agent && meta?.roundType && meta?.roundContext) {
      const message = generateMockAgentResponse(
        meta.agent,
        meta.roundType,
        meta.roundContext
      );
      const payload: Record<string, unknown> = {
        stance: message.stance,
        content: message.content,
        concerns: message.concerns,
        suggestions: message.suggestions,
        vote: message.vote,
      };
      if ("findings" in message && message.findings?.length) {
        payload.findings = message.findings;
      }
      return {
        content: JSON.stringify(payload),
        model: "mock-v1",
        provider: "mock",
      };
    }

    return {
      content: request.userPrompt,
      model: "mock-v1",
      provider: "mock",
    };
  }
}

export const mockProvider = new MockProvider();
