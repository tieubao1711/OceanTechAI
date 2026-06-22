import type { Agent } from "@prisma/client";
import type { AuditContext } from "./audit-types";
import { buildDebateGovernanceBlock } from "@/server/governance/oceantechai-constitution";
import { formatRoleLabel } from "@/server/agents/agent-profile";
import { MAX_FINDINGS_PER_AGENT } from "./audit-types";

const FINDINGS_JSON_SCHEMA = `{
  "stance": "support",
  "content": "brief summary of your audit findings",
  "concerns": ["array of strings"],
  "suggestions": ["array of strings"],
  "findings": [{
    "title": "string",
    "fileOrModule": "src/server/example.service.ts",
    "evidence": "specific observable behavior in code",
    "impact": "what breaks or blocks growth",
    "fixScope": "small|medium|large",
    "priority": "low|medium|high|critical"
  }]
}`;

const CRITIQUE_JSON_SCHEMA = `{
  "stance": "neutral",
  "content": "summary of your critique",
  "concerns": ["array of strings"],
  "critiques": [{
    "targetFindingTitle": "exact title from summary",
    "verdict": "agree|disagree|missing_evidence|wrong_priority",
    "reason": "specific reason"
  }]
}`;

export function buildFindingsPrompt(params: {
  agent: Agent;
  context: AuditContext;
}): { systemPrompt: string; userPrompt: string } {
  const { agent, context } = params;

  const systemPrompt = [
    `Bạn là ${agent.name}, ${formatRoleLabel(agent.role)} tại OceanTechAI.`,
    agent.systemPrompt,
    "",
    buildDebateGovernanceBlock(),
    "",
    context.projectKnowledge,
    "",
    "VÒNG AUDIT 1 — PHÁT HIỆN ĐỘC LẬP",
    "Identify REAL technical debt in OceanTechAI with file-level evidence.",
    `Return max ${MAX_FINDINGS_PER_AGENT} findings.`,
    "Each finding MUST use fileOrModule as a file path from FILE-LEVEL AUDIT MAP.",
    "IMPORTANT: Do not use broad categories like Governance or External Integrations.",
    "If unsure, choose the closest file from the map.",
    "BAD fileOrModule: 'Governance', 'External Integrations', 'AI Provider Layer'",
    "GOOD fileOrModule: 'src/server/governance/voting.service.ts'",
    "",
    "Respond with ONLY valid JSON:",
    FINDINGS_JSON_SCHEMA,
  ].join("\n");

  const userPrompt = [
    `Audit scope: ${context.userPrompt}`,
    "",
    "List independent findings. No other agent input. JSON only.",
  ].join("\n");

  return { systemPrompt, userPrompt };
}

export function buildCritiquePrompt(params: {
  agent: Agent;
  context: AuditContext;
  auditSummary: string;
}): { systemPrompt: string; userPrompt: string } {
  const { agent, context, auditSummary } = params;

  const systemPrompt = [
    `You are ${agent.name}, ${formatRoleLabel(agent.role)} on OceanTechAI.`,
    agent.systemPrompt,
    "",
    context.projectKnowledge,
    "",
    "AUDIT ROUND 2 — CROSS CRITIQUE",
    "Critique findings from other agents. Do NOT create new findings.",
    "Only: agree, disagree, missing_evidence, wrong_priority.",
    "",
    "Respond with ONLY valid JSON:",
    CRITIQUE_JSON_SCHEMA,
  ].join("\n");

  const userPrompt = [
    `Audit scope: ${context.userPrompt}`,
    "",
    auditSummary,
    "",
    "Critique the findings above. JSON only. No new findings.",
  ].join("\n");

  return { systemPrompt, userPrompt };
}
