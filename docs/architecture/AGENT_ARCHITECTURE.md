# Agent Architecture — OceanTechAI Workspace

## Overview

> **Canonical specs:** [DEBATE_ENGINE.md](./DEBATE_ENGINE.md) (deliberation protocol) · [MEMORY_ARCHITECTURE.md](./MEMORY_ARCHITECTURE.md) (organizational memory) · [AGENT_LIFECYCLE.md](./AGENT_LIFECYCLE.md) (agent states) · [Company Charter](../company/COMPANY_CHARTER.md) (constitutional rules)

AI layer tách biệt hoàn toàn khỏi UI. Gồm 6 module chính:

```txt
server/ai/
  providers/          → AIProvider interface + implementations
  agents/             → AgentRunner, prompt assembly
  orchestrator/       → DiscussionOrchestrator, ConsensusEngine
  proposal-generator.ts
  markdown-generator.ts
```

## AIProvider Interface

```ts
interface AIProvider {
  readonly name: string  // "openai" | "anthropic" | "google" | "mock"

  complete(params: CompletionParams): Promise<CompletionResult>
}

interface CompletionParams {
  systemPrompt: string
  userPrompt: string
  responseFormat?: "json" | "text"
  model: string
  temperature?: number
}

interface CompletionResult {
  content: string
  usage?: { promptTokens: number; completionTokens: number }
}
```

### Implementations

| Provider | File | Phase |
|----------|------|-------|
| Mock | `mock.provider.ts` | Phase 7 — deterministic responses cho UI flow |
| OpenAI | `openai.provider.ts` | Phase 8 — production-quality debate |
| Claude | `anthropic.provider.ts` | Post-MVP |
| Gemini | `google.provider.ts` | Post-MVP |

Provider được chọn per-agent qua `Agent.modelProvider` + `Agent.modelName`.

## AgentProfile

Agent trong DB map thành runtime profile:

```ts
interface AgentProfile {
  id: string
  name: string
  role: AgentRole
  expertise: string[]
  systemPrompt: string
  modelProvider: string
  modelName: string
  memorySummary: string | null
  toolsAllowed: string[]
  votingWeight: number  // default 1.0, Red Team có thể 1.5
  isActive: boolean
}

type AgentRole =
  | "product_manager"
  | "system_architect"
  | "backend_engineer"
  | "frontend_engineer"
  | "qa_engineer"
  | "game_designer"
  | "economy_designer"
  | "devops_engineer"
  | "red_team"
```

`AgentRunner` assemble prompt:

```
[System] {agent.systemPrompt}
[Context] Project: {project.name}, Discussion: {userPrompt}
[Memory] {agent.memorySummary}
[Round] Round {n} — {roundType instruction}
[Format] Respond as JSON matching AgentMessage schema
```

## DiscussionOrchestrator

Điều phối 5 phase cho mỗi discussion:

```
┌──────────────┐
│ User Prompt  │
└──────┬───────┘
       ▼
┌──────────────┐     Mỗi active agent đưa đề xuất độc lập
│  Round 1     │     roundType: "propose"
│  Propose     │
└──────┬───────┘
       ▼
┌──────────────┐     Agents xem proposals của nhau, phản biện
│  Round 2     │     roundType: "critique"
│  Critique    │
└──────┬───────┘
       ▼
┌──────────────┐     Agents refine dựa trên critique
│  Round 3     │     roundType: "refine"
│  Refine      │
└──────┬───────┘
       ▼
┌──────────────┐     Weighted vote: yes / no / abstain
│  Round 4     │     roundType: "vote"
│  Vote        │
└──────┬───────┘
       ▼
┌──────────────┐
│  Consensus   │  → ConsensusEngine.aggregate()
└──────┬───────┘
       ▼
┌──────────────┐
│  Proposal    │  → ProposalGenerator.create()
└──────────────┘
```

### Orchestrator Pseudocode

```ts
class DiscussionOrchestrator {
  async run(discussionId: string): Promise<ConsensusResult> {
    const discussion = await loadDiscussion(discussionId)
    const agents = await loadActiveAgents(discussion.projectId)

    for (const [roundNum, roundType] of ROUNDS) {
      const round = await createRound(discussionId, roundNum, roundType)
      const context = await buildRoundContext(discussion, roundNum)

      for (const agent of agents) {
        const message = await this.agentRunner.run(agent, roundType, context)
        await saveAgentMessage(round.id, message)
      }
    }

    const consensus = await this.consensusEngine.aggregate(discussionId)
    await updateDiscussionConsensus(discussionId, consensus)
    await this.proposalGenerator.create(discussionId, consensus)
    return consensus
  }
}
```

## ConsensusEngine

Input: tất cả AgentMessages từ 4 rounds.

Output:

```ts
interface ConsensusResult {
  title: string
  finalDecision: string
  alternativesConsidered: string[]
  reasons: string[]
  risks: string[]
  openQuestions: string[]
  voteSummary: {
    yes: number
    no: number
    abstain: number
  }
}
```

Logic:

1. Round 3 refine messages → extract `finalDecision` candidate
2. Round 4 votes → weighted sum theo `votingWeight`
3. Round 2 concerns → aggregate vào `risks[]`
4. Round 1 proposals chưa được chọn → `alternativesConsidered[]`
5. Unresolved items → `openQuestions[]`

## AgentMessage Schema

```ts
interface AgentMessage {
  agentId: string
  round: number
  stance: "support" | "oppose" | "neutral" | "refine"
  content: string
  concerns: string[]
  suggestions: string[]
  vote?: "yes" | "no" | "abstain"
}
```

Mỗi message được validate (Zod) trước khi persist. Parse failure → retry agent once, then log error.

## ProposalGenerator

Map `ConsensusResult` → `Proposal` record:

| Consensus Field | Proposal Field |
|-----------------|----------------|
| title | title |
| finalDecision | chosenSolution |
| alternativesConsidered | alternativesConsidered |
| reasons | reasoning |
| risks | risks |
| — | summary (LLM-generated 2-paragraph tóm tắt) |
| — | filesToCreate (inferred paths) |
| — | tasksToCreate (inferred task list) |
| — | status: "pending" |

## MarkdownGenerator

Trigger: `proposal.status` chuyển sang `approved`.

Sinh 4 files:

| Path | Content Source |
|------|----------------|
| `docs/features/{slug}.md` | chosenSolution + user value framing |
| `docs/architecture/{slug}.md` | technical decisions từ Architect/Engineer messages |
| `docs/api/{slug}.md` | API endpoints inferred từ discussion |
| `tasks/{slug}.cursor.md` | actionable tasks cho Cursor agent |

Mỗi file → `GeneratedFile` record + write to `generated/` directory.

## Default Agent Roles (Seed)

| Role | votingWeight | Active by default |
|------|-------------|-------------------|
| Product Manager | 1.0 | ✅ |
| System Architect | 1.0 | ✅ |
| Backend Engineer | 1.0 | ✅ |
| Frontend Engineer | 1.0 | ✅ |
| QA Engineer | 1.0 | ✅ |
| Economy Designer | 1.0 | ❌ (activate khi cần) |
| Game Designer | 1.0 | ❌ |
| DevOps Engineer | 1.0 | ❌ |
| Red Team Critic | 1.5 | ✅ |

MVP seed: 1 workspace, 1 project, 6 agents active (PM, Architect, Backend, Frontend, QA, Red Team).

## Error Handling

| Scenario | Behavior |
|----------|----------|
| Agent JSON parse fail | Retry 1x với stricter format prompt |
| Provider timeout | Mark message as failed; continue other agents |
| All agents fail round | Discussion status → `failed`, notify UI |
| Vote tie | ConsensusEngine ưu tiên Red Team + QA stance |

## Extension Points

- **New role:** Add seed + `docs/agents/{ROLE}.md` system prompt doc
- **New provider:** Implement `AIProvider`, register in provider factory
- **Custom rounds:** `DiscussionRound.roundType` enum extensible
- **Agent tools:** `toolsAllowed` gate future function-calling capabilities
