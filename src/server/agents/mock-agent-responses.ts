import type { Agent, RoundType } from "@prisma/client";
import type { AgentMessageContractType } from "@/server/contracts/agent-message.contract";
import type { StanceLiteral, VoteLiteral } from "@/types/agent-message";
import type { RoundContext } from "@/types/debate";
import type { AuditFinding } from "@/server/knowledge/project-knowledge-types";
import type { AuditContext } from "@/server/audit/audit-types";
import type { AuditFixScope, AuditFindingPriority } from "@/server/audit/audit-types";
import { isAuditMode } from "@/types/discussion-mode";
import { formatRoleLabel } from "./agent-profile";

export type MockAgentResponse = AgentMessageContractType & {
  findings?: AuditFinding[];
};

type RoundKey = "propose" | "critique" | "refine" | "vote";

const ROLE_RESPONSES: Record<
  string,
  Record<RoundKey, (ctx: RoundContext, agent: Agent) => Partial<AgentMessageContractType>>
> = {
  product_manager: {
    propose: (ctx) => ({
      stance: "support",
      content: `From a product lens: "${ctx.userPrompt}" should start as MVP with clear user value, tight scope, and measurable success metrics.`,
      concerns: ["Scope creep risk if we include non-essential features"],
      suggestions: ["Phase 1: core user journey only", "Define 2-3 success metrics upfront"],
    }),
    critique: () => ({
      stance: "oppose",
      content: "Some technical proposals exceed MVP scope. We should defer complex infrastructure until user value is validated.",
      concerns: ["Over-engineering before product-market fit"],
      suggestions: ["Ship smallest lovable version first"],
    }),
    refine: (ctx) => ({
      stance: "refine",
      content: `Refined MVP for "${ctx.userPrompt}": core feature + basic UX + success metrics. Defer advanced capabilities to Phase 2.`,
      concerns: ["Timeline risk if scope not capped"],
      suggestions: ["2-week implementation cap for MVP"],
    }),
    vote: () => ({
      stance: "support",
      content: "MVP scope is focused and delivers user value. Voting yes.",
      concerns: [],
      suggestions: [],
      vote: "yes",
    }),
  },
  system_architect: {
    propose: (ctx) => ({
      stance: "support",
      content: `Architecture for "${ctx.userPrompt}": modular design, PostgreSQL data model, REST API /api/v1/, clear entity boundaries.`,
      concerns: ["Need to define core entities and relationships early"],
      suggestions: ["Use PostgreSQL with indexed foreign keys", "REST API with versioning"],
    }),
    critique: () => ({
      stance: "neutral",
      content: "Frontend and backend proposals are feasible but need shared API contract before implementation.",
      concerns: ["Missing API contract between layers"],
      suggestions: ["Define OpenAPI spec before coding"],
    }),
    refine: (ctx) => ({
      stance: "refine",
      content: `Final architecture: entities for "${ctx.userPrompt}", PostgreSQL schema, REST endpoints, service layer separation.`,
      concerns: ["Scalability at 10x load not yet tested"],
      suggestions: ["Add database indexes on lookup fields", "Cache read-heavy endpoints"],
    }),
    vote: () => ({
      stance: "support",
      content: "Architecture is sound and maintainable. Voting yes.",
      concerns: [],
      suggestions: [],
      vote: "yes",
    }),
  },
  backend_engineer: {
    propose: (ctx) => ({
      stance: "support",
      content: `Backend plan for "${ctx.userPrompt}": service layer, Prisma models, validation with Zod, API routes.`,
      concerns: ["Concurrent write scenarios need handling"],
      suggestions: ["Use transactions for multi-step writes", "Add idempotency keys"],
    }),
    critique: () => ({
      stance: "neutral",
      content: "Architecture is solid. Need more detail on error handling and retry logic.",
      concerns: ["Unhandled edge cases in failure paths"],
      suggestions: ["Define error response schema"],
    }),
    refine: (ctx) => ({
      stance: "refine",
      content: `Backend implementation: models, services, API routes for "${ctx.userPrompt}" with Zod validation and transaction safety.`,
      concerns: [],
      suggestions: ["Add integration tests for API layer"],
    }),
    vote: () => ({
      stance: "support",
      content: "Implementation plan is feasible. Voting yes.",
      concerns: [],
      suggestions: [],
      vote: "yes",
    }),
  },
  frontend_engineer: {
    propose: (ctx) => ({
      stance: "support",
      content: `Frontend for "${ctx.userPrompt}": dashboard views, forms, round-by-round debate viewer, proposal approval UI.`,
      concerns: ["Complex state for multi-round display"],
      suggestions: ["Use server components for data, client for interactions"],
    }),
    critique: () => ({
      stance: "neutral",
      content: "API design needs frontend-friendly pagination and loading states for long debates.",
      concerns: ["No loading state strategy for debate execution"],
      suggestions: ["Add polling or streaming progress indicator"],
    }),
    refine: (ctx) => ({
      stance: "refine",
      content: `UI plan: project dashboard, discussion detail with round tabs, proposal page with approve/reject actions for "${ctx.userPrompt}".`,
      concerns: [],
      suggestions: ["Mobile-responsive layout in Phase 2"],
    }),
    vote: () => ({
      stance: "neutral",
      content: "Outside core frontend scope but looks reasonable. Abstaining.",
      concerns: ["Need wireframes before committing"],
      suggestions: [],
      vote: "abstain",
    }),
  },
  qa_engineer: {
    propose: (ctx) => ({
      stance: "support",
      content: `QA plan for "${ctx.userPrompt}": edge cases, concurrent operations, empty states, regression suite.`,
      concerns: ["Race conditions in concurrent user actions", "Empty state handling"],
      suggestions: [
        "P0: concurrent operation test",
        "P0: empty state returns valid response not 500",
        "P1: regression suite for existing features",
      ],
    }),
    critique: () => ({
      stance: "oppose",
      content: "Proposals lack specific test cases. 'It should work' is not a test strategy.",
      concerns: ["No Given/When/Then test cases defined"],
      suggestions: ["Add test case per acceptance criterion"],
    }),
    refine: (ctx) => ({
      stance: "refine",
      content: `Test plan for "${ctx.userPrompt}": P0 concurrent tests, P1 edge cases, P2 regression. All acceptance criteria mapped to tests.`,
      concerns: ["Inventory module had duplication bug — test concurrent ops"],
      suggestions: ["Add automated test for max-capacity race condition"],
    }),
    vote: () => ({
      stance: "support",
      content: "Test plan covers critical edge cases. Voting yes.",
      concerns: [],
      suggestions: [],
      vote: "yes",
    }),
  },
  red_team: {
    propose: (ctx) => ({
      stance: "neutral",
      content: `Attack vectors for "${ctx.userPrompt}": abuse via automation, impersonation, mass-reporting, and data exfiltration.`,
      concerns: ["CRITICAL: No rate limiting proposed", "HIGH: No abuse detection mechanism"],
      suggestions: ["Rate limit all user actions", "Reserved name blocklist", "Account age gate"],
    }),
    critique: () => ({
      stance: "oppose",
      content: "Proposals assume good-faith users. Every feature is an attack surface. Missing mitigations for bot abuse and griefing.",
      concerns: [
        "CRITICAL: No rate limiting on any endpoint",
        "HIGH: Social features enable harassment channel",
        "MEDIUM: Name squatting not addressed",
      ],
      suggestions: [
        "Rate limit: 10 actions/hour per user",
        "Profanity filter for user-generated content",
        "Mass-action threshold with manual review",
      ],
    }),
    refine: (ctx) => ({
      stance: "refine",
      content: `Security-hardened plan for "${ctx.userPrompt}": rate limits, abuse detection, reserved names, account age gates, moderation tools.`,
      concerns: ["Remaining: DDoS protection at infrastructure level"],
      suggestions: ["Implement rate limiting middleware", "Add report + auto-mute after 3 reports"],
    }),
    vote: () => ({
      stance: "oppose",
      content: "Critical abuse vectors partially addressed but DDoS and mass-reporting need more mitigation. Voting no.",
      concerns: ["Mass-reporting auto-action not fully mitigated"],
      suggestions: ["Add manual review threshold for mass reports"],
      vote: "no",
    }),
  },
  economy_designer: {
    propose: (ctx) => ({
      stance: "neutral",
      content: `Economic impact of "${ctx.userPrompt}": analyze currency faucets/sinks and progression impact.`,
      concerns: ["Potential inflation if rewards are uncapped"],
      suggestions: ["Cap daily rewards", "Add currency sink alongside faucet"],
    }),
    critique: () => ({
      stance: "neutral",
      content: "Feature may affect economy if rewards are involved. Need explicit economic model.",
      concerns: ["Uncapped rewards risk inflation"],
      suggestions: ["Define reward table with daily caps"],
    }),
    refine: (ctx) => ({
      stance: "refine",
      content: `Balanced economy plan: capped rewards, anti-alt measures, monitoring metrics for "${ctx.userPrompt}".`,
      concerns: [],
      suggestions: ["Monitor inflation rate weekly"],
    }),
    vote: () => ({
      stance: "support",
      content: "Economic safeguards are adequate. Voting yes.",
      concerns: [],
      suggestions: [],
      vote: "yes",
    }),
  },
  game_designer: {
    propose: (ctx) => ({
      stance: "support",
      content: `Game design for "${ctx.userPrompt}": player motivation, progression curve, social dynamics.`,
      concerns: ["Player engagement loop not defined"],
      suggestions: ["Define core gameplay loop", "Add progression milestones"],
    }),
    critique: () => ({ stance: "neutral", content: "Needs more player motivation design.", concerns: [], suggestions: [] }),
    refine: (ctx) => ({ stance: "refine", content: `Refined game design for "${ctx.userPrompt}".`, concerns: [], suggestions: [] }),
    vote: () => ({ stance: "support", content: "Good player experience design.", concerns: [], suggestions: [], vote: "yes" }),
  },
  devops_engineer: {
    propose: (ctx) => ({
      stance: "support",
      content: `Infra for "${ctx.userPrompt}": CI/CD pipeline, monitoring, staging environment.`,
      concerns: ["No rollback strategy defined"],
      suggestions: ["Blue-green deployment", "Health check endpoints"],
    }),
    critique: () => ({ stance: "neutral", content: "Need deployment strategy.", concerns: [], suggestions: [] }),
    refine: (ctx) => ({ stance: "refine", content: `Ops plan for "${ctx.userPrompt}".`, concerns: [], suggestions: [] }),
    vote: () => ({ stance: "support", content: "Ops plan is solid.", concerns: [], suggestions: [], vote: "yes" }),
  },
};

function getHandler(role: string) {
  return ROLE_RESPONSES[role] ?? ROLE_RESPONSES.product_manager;
}

const AUDIT_DEBTS_BY_ROLE: Record<
  string,
  {
    title: string;
    fileOrModule: string;
    evidence: string;
    impact: string;
    fixScope: AuditFixScope;
    priority: AuditFindingPriority;
  }
> = {
  system_architect: {
    title: "Debate token bloat",
    fileOrModule: "src/server/debate/debate-orchestrator.ts",
    evidence:
      "Passes full previousMessages and projectKnowledge into every agent-runner.ts call each round",
    impact: "OpenAI cost scales linearly with round count and agent count",
    fixScope: "medium",
    priority: "high",
  },
  backend_engineer: {
    title: "Execution retry gaps",
    fileOrModule: "src/server/execution/execution.service.ts",
    evidence:
      "Stops on first GitHub commit failure without idempotent retry or rollback of partial branch state",
    impact: "Partial branch state leaves orphan commits blocking re-execution",
    fixScope: "small",
    priority: "high",
  },
  red_team: {
    title: "Reputation not used in voting",
    fileOrModule: "src/server/governance/voting.service.ts",
    evidence:
      "Agent.reputationScore is stored in database but voting weights remain static votingWeight field",
    impact: "Low-quality agents can sway consensus equal to high-reputation agents",
    fixScope: "small",
    priority: "high",
  },
};

export function generateMockAuditPhaseResponse(
  agent: Agent,
  phase: "findings" | "critique",
  context: AuditContext
): Record<string, unknown> {
  void context;
  const debt = AUDIT_DEBTS_BY_ROLE[agent.role] ?? AUDIT_DEBTS_BY_ROLE.system_architect;

  if (phase === "findings") {
    return {
      stance: "support",
      content: `${formatRoleLabel(agent.role)} identified: ${debt.title}`,
      concerns: [debt.impact],
      suggestions: [`Fix in ${debt.fileOrModule}`],
      findings: [
        {
          title: debt.title,
          fileOrModule: debt.fileOrModule,
          evidence: debt.evidence,
          impact: debt.impact,
          fixScope: debt.fixScope,
          priority: debt.priority,
        },
      ],
    };
  }

  return {
    stance: "neutral",
    content: `Reviewed audit summary. Agree with ${debt.title} evidence in ${debt.fileOrModule}.`,
    concerns: [],
    critiques: [
      {
        targetFindingTitle: debt.title,
        verdict: "agree",
        reason: `Evidence in ${debt.fileOrModule} is specific and actionable`,
      },
    ],
  };
}

function generateMockAuditResponse(
  agent: Agent,
  roundType: RoundType,
  context: RoundContext
): MockAgentResponse {
  const debt =
    AUDIT_DEBTS_BY_ROLE[agent.role] ?? AUDIT_DEBTS_BY_ROLE.system_architect;
  const finding: AuditFinding = {
    title: debt.title,
    evidence: debt.evidence,
    impact: debt.impact,
    priority: debt.priority,
  } as AuditFinding;

  const roundKey = roundType.toLowerCase() as RoundKey;
  const base = getHandler(agent.role)[roundKey] ?? getHandler(agent.role).propose;

  if (roundType === "VOTE") {
    const partial = base(context, agent);
    return {
      agentId: agent.id,
      round: context.round.roundNumber,
      stance: (partial.stance ?? "support") as StanceLiteral,
      content:
        partial.content ??
        `Audit complete. Voting yes on prioritizing ${debt.title}.`,
      concerns: partial.concerns ?? [],
      suggestions: partial.suggestions ?? [],
      vote: (partial.vote ?? "yes") as VoteLiteral,
    };
  }

  const action =
    roundKey === "propose"
      ? "identified"
      : roundKey === "critique"
        ? "validated"
        : "refined";

  return {
    agentId: agent.id,
    round: context.round.roundNumber,
    stance: roundKey === "critique" ? "oppose" : "refine",
    content: `${formatRoleLabel(agent.role)} ${action} technical debt: ${debt.title}. Evidence in ${debt.evidence.split(".")[0]}.`,
    concerns: [debt.impact],
    suggestions: [`Address ${debt.title} in next sprint`],
    findings: [finding],
  };
}

const OFFICE_HOURS_RESPONSES: Record<string, (message: string) => string> = {
  product_manager: (msg) =>
    `From a product perspective on "${msg.slice(0, 80)}": I'd prioritize user-visible value this week — tighten MVP scope, validate retention signals, and defer non-essential infrastructure. For anything that changes roadmap or governance, open a formal Discussion.`,
  system_architect: (msg) =>
    `Architect view on "${msg.slice(0, 80)}": prioritize modular boundaries, database integrity, and debate/consensus reliability. I'd sequence work as: (1) stabilize core services, (2) reduce coupling in orchestrators, (3) add observability. Major architecture shifts need a formal Discussion.`,
  backend_engineer: (msg) =>
    `Backend take on "${msg.slice(0, 80)}": focus on service-layer correctness, Prisma transaction safety, and idempotent execution paths. I'm uncertain about edge cases without a specific module — happy to dig deeper. Ship-critical changes should go through Discussion → Proposal.`,
  frontend_engineer: (msg) =>
    `Frontend view on "${msg.slice(0, 80)}": prioritize dashboard clarity, agent profile flows, and accessible forms. I'd avoid large UI rewrites until product scope is locked. UX-impacting decisions should become a formal Discussion.`,
  qa_engineer: (msg) =>
    `QA perspective on "${msg.slice(0, 80)}": missing coverage likely sits around orchestrators, learning integrity, and workforce assignment edge cases. I'd add tests for over-allocation, retired-agent voting blocks, and office-hours governance. Test strategy changes warrant a formal Discussion.`,
  red_team: (msg) =>
    `Security/risk lens on "${msg.slice(0, 80)}": watch governance bypass (Office Hours ≠ approval), over-trust in agent memory, and execution paths without Founder sign-off. I see abuse potential if advisory chat is mistaken for authority. Escalate material risks via formal Discussion.`,
  economy_designer: (msg) =>
    `Economy view on "${msg.slice(0, 80)}": balance reward loops, inflation guards, and pay-to-win avoidance per Founder preference. I need more player-behavior data before strong claims. Economy changes require formal debate.`,
  game_designer: (msg) =>
    `Design view on "${msg.slice(0, 80)}": player experience and progression clarity first. I'd prototype mechanics in isolation before production integration. Scope changes need a Discussion.`,
  devops_engineer: (msg) =>
    `Ops view on "${msg.slice(0, 80)}": CI reliability, seed/backfill safety, and deployment idempotency are the week-one priorities. I'm not certain of prod config from chat alone. Infra changes need formal approval.`,
};

export function generateMockOfficeHoursResponse(agent: Agent, founderMessage: string): string {
  const handler = OFFICE_HOURS_RESPONSES[agent.role];
  if (handler) return handler(founderMessage);
  return `As ${formatRoleLabel(agent.role)}, regarding "${founderMessage.slice(0, 80)}": I can advise based on my role, but I'm not certain without more context. Recommend a formal Discussion for official decisions.`;
}

export function generateMockAgentResponse(
  agent: Agent,
  roundType: RoundType,
  context: RoundContext
): MockAgentResponse {
  if (isAuditMode(context.discussionMode) && roundType !== "CONSENSUS") {
    return generateMockAuditResponse(agent, roundType, context);
  }
  const handler = getHandler(agent.role);
  const roundKey = roundType.toLowerCase() as RoundKey;
  const generator = handler[roundKey] ?? handler.propose;
  const partial = generator(context, agent);

  return {
    agentId: agent.id,
    round: context.round.roundNumber,
    stance: (partial.stance ?? "neutral") as StanceLiteral,
    content:
      partial.content ??
      `${formatRoleLabel(agent.role)} response for round ${context.round.roundNumber}.`,
    concerns: partial.concerns ?? [],
    suggestions: partial.suggestions ?? [],
    vote: roundType === "VOTE" ? ((partial.vote ?? "yes") as VoteLiteral) : undefined,
  };
}
