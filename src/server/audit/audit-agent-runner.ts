import type { Agent } from "@prisma/client";
import { parseAiJson } from "@/server/ai/json/json-repair";
import { modelRouter } from "@/server/ai/providers/model-router";
import { getMockProvider } from "@/server/ai/providers/provider-registry";
import { logAIWarning } from "@/server/ai/providers/ai-observability";
import { buildNormalizedAgentMessagePayload } from "@/server/contracts/agent-message-normalizer";
import { parseAgentMessage } from "@/server/contracts/agent-message.contract";
import {
  buildFindingsPrompt,
  buildCritiquePrompt,
} from "./audit-prompt-builder";
import type { AuditContext, AgentCritiqueResult, AgentFindingsResult } from "./audit-types";
import {
  buildAuditRetryPrompt,
  filterValidFindings,
  parseAuditCritiques,
  parseAuditFindings,
  validateFinding,
} from "./audit-quality";
import { generateMockAuditPhaseResponse } from "@/server/agents/mock-agent-responses";

function estimateTokens(...parts: string[]): number {
  return Math.max(50, Math.ceil(parts.join("").length / 4));
}

export class AuditAgentRunner {
  private async callProvider(params: {
    agent: Agent;
    systemPrompt: string;
    userPrompt: string;
    phase: "findings" | "critique";
    context: AuditContext;
  }) {
    const resolved = modelRouter.resolveForAgent(params.agent);
    const metadata = {
      agent: params.agent,
      auditPhase: params.phase,
      auditContext: params.context,
    };

    try {
      const response = await resolved.provider.generate({
        systemPrompt: params.systemPrompt,
        userPrompt: params.userPrompt,
        responseFormat: "json",
        model: resolved.model,
        temperature: 0.5,
        metadata,
      });
      return {
        content: response.content,
        provider: resolved.providerName,
        model: response.model ?? resolved.model,
        tokenTotal:
          response.usage?.totalTokens ??
          estimateTokens(params.systemPrompt, params.userPrompt, response.content),
        fallbackUsed: resolved.fallbackUsed,
      };
    } catch (err) {
      if (resolved.providerName !== "mock") {
        logAIWarning(`Audit provider failed — mock fallback for ${params.agent.name}`, {
          error: err instanceof Error ? err.message : String(err),
        });
        const mock = getMockProvider();
        const response = await mock.generate({
          systemPrompt: params.systemPrompt,
          userPrompt: params.userPrompt,
          responseFormat: "json",
          metadata,
        });
        return {
          content: response.content,
          provider: "mock",
          model: "mock-v1",
          tokenTotal:
            response.usage?.totalTokens ??
            estimateTokens(params.systemPrompt, params.userPrompt, response.content),
          fallbackUsed: true,
        };
      }
      throw err;
    }
  }

  async runFindings(agent: Agent, context: AuditContext): Promise<AgentFindingsResult> {
    const { systemPrompt, userPrompt } = buildFindingsPrompt({ agent, context });
    let result = await this.callProvider({
      agent,
      systemPrompt,
      userPrompt,
      phase: "findings",
      context,
    });

    let parsed = parseAiJson(result.content);
    let rawFindings = parseAuditFindings(parsed.findings);
    let valid = filterValidFindings(rawFindings, context.snapshot);

    if (valid.length === 0 && rawFindings.length > 0) {
      const issues = rawFindings.map(
        (f) => validateFinding(f, context.snapshot).reason ?? "invalid"
      );
      const retry = await this.callProvider({
        agent,
        systemPrompt,
        userPrompt: `${userPrompt}\n\n${buildAuditRetryPrompt(issues, context.snapshot.auditFileMap)}`,
        phase: "findings",
        context,
      });
      result = retry;
      parsed = parseAiJson(retry.content);
      rawFindings = parseAuditFindings(parsed.findings);
      valid = filterValidFindings(rawFindings, context.snapshot);
    }

    if (valid.length === 0 && process.env.AI_PROVIDER_MODE === "mock") {
      const mock = generateMockAuditPhaseResponse(agent, "findings", context);
      parsed = mock as Record<string, unknown>;
      valid = filterValidFindings(parseAuditFindings(parsed.findings), context.snapshot);
    }

    const payload = buildNormalizedAgentMessagePayload(parsed, agent.id, 1);
    const message = parseAgentMessage(payload);

    const qualityScore = valid.length > 0 ? 70 + valid.length * 5 : 40;

    return {
      agentId: agent.id,
      agentName: agent.name,
      agentRole: agent.role,
      findings: valid.map((f) => ({
        ...f,
        sourceAgent: agent.name,
        sourceRole: agent.role,
      })),
      content: message.content,
      concerns: message.concerns,
      suggestions: message.suggestions,
      provider: result.provider,
      model: result.model,
      tokenTotal: result.tokenTotal,
      qualityScore: Math.min(100, qualityScore),
    };
  }

  async runCritique(
    agent: Agent,
    context: AuditContext,
    auditSummary: string
  ): Promise<AgentCritiqueResult> {
    const { systemPrompt, userPrompt } = buildCritiquePrompt({
      agent,
      context,
      auditSummary,
    });

    const result = await this.callProvider({
      agent,
      systemPrompt,
      userPrompt,
      phase: "critique",
      context,
    });

    let parsed = parseAiJson(result.content);
    let critiques = parseAuditCritiques(parsed.critiques);

    if (critiques.length === 0 && process.env.AI_PROVIDER_MODE === "mock") {
      const mock = generateMockAuditPhaseResponse(agent, "critique", context);
      parsed = mock as Record<string, unknown>;
      critiques = parseAuditCritiques(parsed.critiques);
    }

    const payload = buildNormalizedAgentMessagePayload(parsed, agent.id, 2);
    const message = parseAgentMessage(payload);

    return {
      agentId: agent.id,
      agentName: agent.name,
      agentRole: agent.role,
      critiques,
      content: message.content,
      concerns: message.concerns,
      provider: result.provider,
      model: result.model,
      tokenTotal: result.tokenTotal,
    };
  }
}

export const auditAgentRunner = new AuditAgentRunner();
