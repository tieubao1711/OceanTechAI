import type { Agent, RoundType } from "@prisma/client";
import { parseAgentMessage } from "@/server/contracts/agent-message.contract";
import type { AgentMessageContractType } from "@/server/contracts/agent-message.contract";
import type { RoundContext } from "@/types/debate";
import { parseAiJson } from "@/server/ai/json/json-repair";
import { buildAgentPrompt } from "./agent-prompt-builder";
import { modelRouter } from "@/server/ai/providers/model-router";
import { getMockProvider } from "@/server/ai/providers/provider-registry";
import type { MockProviderMetadata } from "@/server/ai/providers/mock-provider";
import { logAICall, logAIProviderError, logAIWarning } from "@/server/ai/providers/ai-observability";
import { AIProviderError } from "@/server/ai/providers/ai-provider-error";
import { ValidationError } from "@/server/errors/validation-error";
import {
  buildVoteRetryPrompt,
  repairMissingVote,
  VOTE_REPAIR_QUALITY_PENALTY,
} from "./vote-repair";
import { buildNormalizedAgentMessagePayload } from "@/server/contracts/agent-message-normalizer";
import {
  buildQualityRetryPrompt,
  getQualityIssues,
  QUALITY_GATE_THRESHOLD,
  scoreAgentMessage,
} from "@/server/quality/agent-message-quality";
import {
  buildAuditRetryPrompt,
  parseAuditFindings,
  scoreAuditAwareness,
} from "@/server/quality/audit-quality";
import { isAuditMode } from "@/types/discussion-mode";

export type AgentRunResult = {
  message: AgentMessageContractType;
  qualityScore: number;
  provider: string;
  model: string;
  tokenInput?: number;
  tokenOutput?: number;
  tokenTotal?: number;
  fallbackUsed: boolean;
};

function toAgentMessagePayload(
  parsed: Record<string, unknown>,
  agentId: string,
  roundNumber: number,
  roundType: RoundType
): AgentMessageContractType {
  const payload = buildNormalizedAgentMessagePayload(parsed, agentId, roundNumber);

  if (roundType !== "VOTE") {
    delete payload.vote;
  }

  return parseAgentMessage(payload);
}

function buildValidationRetryPrompt(roundType: RoundType, details: unknown): string {
  const voteRule =
    roundType === "VOTE"
      ? '- vote: REQUIRED — "yes" | "no" | "abstain" (lowercase)'
      : '- Do NOT include "vote" field';

  return [
    "Your previous JSON response failed schema validation.",
    "Respond with ONLY valid JSON using EXACT lowercase enum values:",
    '- stance: "support" | "oppose" | "neutral" | "refine"',
    '- concerns: array of strings (can be empty [])',
    '- suggestions: array of strings (can be empty [])',
    "- content: non-empty string",
    voteRule,
    `Validation errors: ${JSON.stringify(details)}`,
  ].join("\n");
}

function parseProviderMessage(
  content: string,
  agentId: string,
  roundNumber: number,
  roundType: RoundType
): { message: AgentMessageContractType; auditFindings: ReturnType<typeof parseAuditFindings> } {
  const parsed = parseAiJson(content);
  return {
    message: toAgentMessagePayload(parsed, agentId, roundNumber, roundType),
    auditFindings: parseAuditFindings(parsed.findings),
  };
}

export class AgentRunner {
  private async callProvider(params: {
    agent: Agent;
    roundType: RoundType;
    context: RoundContext;
    systemPrompt: string;
    userPrompt: string;
    resolved: ReturnType<typeof modelRouter.resolveForAgent>;
    mockMeta: MockProviderMetadata;
  }) {
    const { resolved, systemPrompt, userPrompt, mockMeta } = params;
    const fallbackUsed = resolved.fallbackUsed;
    const activeProvider = resolved.provider;

    try {
      const response = await resolved.provider.generate({
        systemPrompt,
        userPrompt,
        responseFormat: "json",
        model: resolved.model,
        temperature: 0.7,
        metadata: mockMeta,
      });
      return { response, activeProvider, fallbackUsed };
    } catch (err) {
      if (resolved.providerName !== "mock") {
        if (err instanceof AIProviderError) {
          logAIProviderError({
            provider: resolved.providerName,
            model: resolved.model,
            errorType: err.type,
            retryable: err.retryable,
            fallbackAvailable: true,
            message: err.message,
          });
        } else {
          logAIWarning(
            `Provider ${resolved.providerName} failed after retries — falling back to mock`,
            { error: err instanceof Error ? err.message : String(err) }
          );
        }
        const mock = getMockProvider();
        const response = await mock.generate({
          systemPrompt,
          userPrompt,
          responseFormat: "json",
          metadata: mockMeta,
        });
        return { response, activeProvider: mock, fallbackUsed: true };
      }
      throw err;
    }
  }

  private async ensureRound4Vote(params: {
    agent: Agent;
    roundType: RoundType;
    context: RoundContext;
    systemPrompt: string;
    userPrompt: string;
    resolved: ReturnType<typeof modelRouter.resolveForAgent>;
    mockMeta: MockProviderMetadata;
    message: AgentMessageContractType;
  }): Promise<{ message: AgentMessageContractType; voteRepaired: boolean }> {
    const { agent, roundType, context, systemPrompt, userPrompt, resolved, mockMeta } =
      params;
    let { message } = params;

    if (roundType !== "VOTE" || message.vote) {
      return { message, voteRepaired: false };
    }

    const retry = await this.callProvider({
      agent,
      roundType,
      context,
      systemPrompt,
      userPrompt: `${userPrompt}\n\n${buildVoteRetryPrompt()}`,
      resolved,
      mockMeta,
    });

    try {
      const parsed = parseProviderMessage(
        retry.response.content,
        agent.id,
        context.round.roundNumber,
        roundType
      );
      if (parsed.message.vote) {
        return { message: parsed.message, voteRepaired: false };
      }
      message = parsed.message;
    } catch {
      // Keep original message for stance-based repair.
    }

    const repaired = repairMissingVote(message, roundType);
    logAIWarning(`Missing vote auto-repaired for ${agent.name}`, { voteRepaired: true });
    return { message: repaired, voteRepaired: true };
  }

  async run(
    agent: Agent,
    roundType: RoundType,
    context: RoundContext,
    memoryContext: string
  ): Promise<AgentRunResult> {
    const mockMeta: MockProviderMetadata = {
      agent,
      roundType,
      roundContext: context,
    };

    const { systemPrompt, userPrompt: baseUserPrompt } = buildAgentPrompt({
      agent,
      roundType,
      context,
      memoryContext,
    });

    const resolved = modelRouter.resolveForAgent(agent);
    const userPrompt = baseUserPrompt;
    let { response, activeProvider, fallbackUsed } = await this.callProvider({
      agent,
      roundType,
      context,
      systemPrompt,
      userPrompt,
      resolved,
      mockMeta,
    });

    let message: AgentMessageContractType;
    let auditFindings = parseAuditFindings({});
    try {
      const parsed = parseProviderMessage(
        response.content,
        agent.id,
        context.round.roundNumber,
        roundType
      );
      message = parsed.message;
      auditFindings = parsed.auditFindings;
    } catch (err) {
      if (err instanceof ValidationError) {
        logAIWarning(`JSON/contract validation failed for ${agent.name} — retrying once`, {
          code: err.code,
          details: err.details,
        });
        const retry = await this.callProvider({
          agent,
          roundType,
          context,
          systemPrompt,
          userPrompt: `${userPrompt}\n\n${buildValidationRetryPrompt(roundType, err.details)}`,
          resolved,
          mockMeta,
        });
        response = retry.response;
        activeProvider = retry.activeProvider;
        fallbackUsed = fallbackUsed || retry.fallbackUsed;
        const parsed = parseProviderMessage(
          response.content,
          agent.id,
          context.round.roundNumber,
          roundType
        );
        message = parsed.message;
        auditFindings = parsed.auditFindings;
      } else {
        throw err;
      }
    }

    let qualityScore = scoreAgentMessage({
      message,
      roundType,
      agentRole: agent.role,
    });

    if (isAuditMode(context.discussionMode) && roundType !== "VOTE") {
      const auditResult = scoreAuditAwareness({
        message,
        snapshot: context.projectKnowledgeSnapshot,
        findings: auditFindings,
        isAuditMode: true,
      });
      qualityScore = Math.max(0, qualityScore - auditResult.penalty);

      if (auditResult.penalty > 0) {
        logAIWarning(`Audit awareness penalty for ${agent.name} (-${auditResult.penalty})`, {
          issues: auditResult.issues,
        });
      }

      if (qualityScore < QUALITY_GATE_THRESHOLD) {
        const retry = await this.callProvider({
          agent,
          roundType,
          context,
          systemPrompt,
          userPrompt: `${userPrompt}\n\n${buildAuditRetryPrompt(auditResult.issues)}`,
          resolved,
          mockMeta,
        });
        response = retry.response;
        activeProvider = retry.activeProvider;
        fallbackUsed = fallbackUsed || retry.fallbackUsed;
        const parsed = parseProviderMessage(
          response.content,
          agent.id,
          context.round.roundNumber,
          roundType
        );
        message = parsed.message;
        auditFindings = parsed.auditFindings;
        qualityScore = scoreAgentMessage({ message, roundType, agentRole: agent.role });
        const retryAudit = scoreAuditAwareness({
          message,
          snapshot: context.projectKnowledgeSnapshot,
          findings: auditFindings,
          isAuditMode: true,
        });
        qualityScore = Math.max(0, qualityScore - retryAudit.penalty);
      }
    } else if (qualityScore < QUALITY_GATE_THRESHOLD) {
      const issues = getQualityIssues({ message, roundType, agentRole: agent.role });
      logAIWarning(`Quality gate failed for ${agent.name} (score=${qualityScore})`, {
        issues,
      });

      const retry = await this.callProvider({
        agent,
        roundType,
        context,
        systemPrompt,
        userPrompt: `${userPrompt}\n\n${buildQualityRetryPrompt(qualityScore, issues)}`,
        resolved,
        mockMeta,
      });

      response = retry.response;
      activeProvider = retry.activeProvider;
      fallbackUsed = fallbackUsed || retry.fallbackUsed;

      const parsed = parseProviderMessage(
        response.content,
        agent.id,
        context.round.roundNumber,
        roundType
      );
      message = parsed.message;
      auditFindings = parsed.auditFindings;

      qualityScore = scoreAgentMessage({
        message,
        roundType,
        agentRole: agent.role,
      });

      if (qualityScore < QUALITY_GATE_THRESHOLD) {
        logAIWarning(
          `Accepting low-quality message for ${agent.name} after retry (score=${qualityScore})`
        );
      }
    }

    const voteResult = await this.ensureRound4Vote({
      agent,
      roundType,
      context,
      systemPrompt,
      userPrompt,
      resolved,
      mockMeta,
      message,
    });
    message = voteResult.message;

    if (voteResult.voteRepaired) {
      qualityScore = Math.max(
        0,
        Math.min(qualityScore - VOTE_REPAIR_QUALITY_PENALTY, QUALITY_GATE_THRESHOLD - 5)
      );
    }

    logAICall({
      provider: activeProvider.name,
      model: response.model ?? resolved.model,
      agentRole: agent.role,
      agentName: agent.name,
      round: context.round.roundNumber,
      roundType,
      fallbackUsed,
      usage: response.usage,
    });

    return {
      message,
      qualityScore,
      provider: activeProvider.name,
      model: response.model ?? resolved.model,
      tokenInput: response.usage?.inputTokens,
      tokenOutput: response.usage?.outputTokens,
      tokenTotal: response.usage?.totalTokens,
      fallbackUsed,
    };
  }
}

export const agentRunner = new AgentRunner();
