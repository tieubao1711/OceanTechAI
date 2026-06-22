# Debate Engine — OceanTechAI Workspace

## Overview

Debate Engine là **trái tim** của OceanTechAI Workspace.

Nếu Memory là linh hồng, Governance là luật pháp, thì Debate Engine là **cơ chế deliberation** — nơi AI organization thực sự *suy nghĩ cùng nhau*.

Đây không phải chain-of-thought. Không phải multi-agent task delegation. Đây là **structured parliamentary debate** giữa AI members có vai trò, trí nhớ, và quyền biểu quyết.

```
                    DEBATE ENGINE
                         │
    ┌────────────────────┼────────────────────┐
    │                    │                    │
    ▼                    ▼                    ▼
 Round 1            Round 2-3            Round 4-5
 INDEPENDENT        DELIBERATION         DECISION
 THINKING           & REFINEMENT
    │                    │                    │
 "What do I           "What do others      "What do we
  think?"              think? How do       collectively
                       I respond?"          decide?"
```

## Engine Architecture

```txt
server/ai/orchestrator/
  discussion-orchestrator.ts    # Master controller
  round-runner.ts               # Executes single round
  context-builder.ts            # Memory injection (see MEMORY_ARCHITECTURE.md)
  consensus-engine.ts           # Round 5 aggregation

server/ai/agents/
  agent-runner.ts               # Single agent LLM call
  response-validator.ts         # Zod validation for AgentMessage JSON
```

```ts
class DiscussionOrchestrator {
  constructor(
    private roundRunner: RoundRunner,
    private contextBuilder: ContextBuilder,
    private consensusEngine: ConsensusEngine,
    private proposalGenerator: ProposalGenerator,
  ) {}

  async run(discussionId: string): Promise<ConsensusResult>
}
```

## Debate Lifecycle

```
DISCUSSION_CREATED
       │
       ▼
┌──────────────────┐
│  Load Context    │  Workspace + Project + Agent memories
│  Select Agents   │  isActive === true
│  Snapshot Weights│  votingWeight → metadata
└────────┬─────────┘
         │
         ▼
    ┌─────────┐
    │ Round 1 │  Independent Thinking
    └────┬────┘
         ▼
    ┌─────────┐
    │ Round 2 │  Cross Critique
    └────┬────┘
         ▼
    ┌─────────┐
    │ Round 3 │  Refinement
    └────┬────┘
         ▼
    ┌─────────┐
    │ Round 4 │  Voting
    └────┬────┘
         ▼
    ┌─────────┐
    │ Round 5 │  Consensus
    └────┬────┘
         ▼
┌──────────────────┐
│ Create Proposal  │  status: pending
└──────────────────┘
```

**Timing (MVP):** Sequential execution. 6 agents × 5 rounds = 30 LLM calls. Estimated 2–5 minutes with OpenAI.

## Round Specifications

### Round 1: Independent Thinking

**roundType:** `propose`

**Mục đích:** Mỗi agent suy nghĩ **độc lập** — không thấy responses của agents khác. Đây là round quan trọng nhất cho diversity of thought.

**Agent nhận context:**
- User prompt (Founder input)
- Memory layers (Global → Workspace → Project → Agent → Decision)
- Round instruction: "Propose your independent solution"

**Agent KHÔNG nhận:**
- ❌ Other agents' messages
- ❌ Previous round history (vì là round đầu)

**Expected output per agent:**
```json
{
  "stance": "support" | "oppose" | "neutral",
  "content": "Independent proposal aligned with agent role",
  "concerns": ["initial concerns about the topic"],
  "suggestions": ["concrete actionable suggestions"]
}
```

**Execution:**
```ts
// Parallel within round — agents don't depend on each other
await Promise.all(
  agents.map(agent => roundRunner.runAgent(agent, round, context))
)
```

**Quality criteria:**
- PM proposes scope and user value
- Architect proposes technical design
- QA proposes test scenarios
- Red Team proposes attack vectors
- **No agent copies another's framing** (impossible — they can't see each other)

---

### Round 2: Cross Critique

**roundType:** `critique`

**Mục đích:** Agents xem **tất cả Round 1 proposals** và phản biện. Đây là round conflict — expected và healthy.

**Agent nhận context:**
- All Round 1 messages (every agent's proposal)
- Own Round 1 message (for consistency)
- Memory layers
- Round instruction: "Critique other agents' proposals. Attack weaknesses."

**Expected output per agent:**
```json
{
  "stance": "oppose" | "support" | "neutral",
  "content": "Critique of specific proposals from other agents",
  "concerns": ["flaws found in others' proposals", "risks not addressed"],
  "suggestions": ["how to fix the flaws"]
}
```

**Special behavior:**
- Red Team: **aggressive critique required** — must attack at least 2 proposals
- QA: must find untested assumptions in technical proposals
- PM: must challenge scope creep in engineering proposals
- Agents may `support` one proposal while `oppose` another aspect

**Execution:** Sequential or parallel (agents see Round 1 output, not each other's Round 2).

---

### Round 3: Refinement

**roundType:** `refine`

**Mục đích:** Agents **tinh chỉnh** phương án dựa trên critique. Không phải re-propose từ đầu — là **synthesis**.

**Agent nhận context:**
- All Round 1 proposals
- All Round 2 critiques
- Own Round 1 + Round 2 messages
- Memory layers
- Round instruction: "Refine your position. Incorporate valid critiques. Produce your best final proposal."

**Expected output per agent:**
```json
{
  "stance": "refine",
  "content": "Refined solution incorporating valid feedback",
  "concerns": ["remaining unresolved issues"],
  "suggestions": ["final concrete recommendations"]
}
```

**Quality criteria:**
- Agent acknowledges valid critiques (not ignore)
- Agent defends positions with reasoning (not concede everything)
- Refined solution is **actionable** — specific enough for vote
- Red Team: verify mitigations actually address concerns (not security theater)

**This round's output is what agents vote on in Round 4.**

---

### Round 4: Voting

**roundType:** `vote`

**Mục đích:** Weighted collective decision on refined solutions.

**Agent nhận context:**
- Aggregated Round 3 refined solutions (summary)
- Own Round 3 message
- Unresolved concerns from Round 2
- Memory layers
- Round instruction: "Vote on the refined solution. yes / no / abstain."

**Expected output per agent:**
```json
{
  "stance": "support" | "oppose" | "neutral",
  "content": "Brief justification for vote",
  "concerns": ["reason for no/abstain if applicable"],
  "suggestions": [],
  "vote": "yes" | "no" | "abstain"
}
```

**Rules:**
- `vote` field **required** — missing vote = round incomplete
- `votingWeight` snapshotted at discussion start
- See [VOTING_SYSTEM.md](../company/VOTING_SYSTEM.md) for calculation

**Execution:** Parallel — votes are independent.

---

### Round 5: Consensus

**roundType:** `consensus`

**Mục đích:** System-level synthesis — **không phải agent round**. `ConsensusEngine` aggregates, không gọi LLM (MVP).

**Input:**
- All messages from Rounds 1–4
- Vote summary
- Memory layers (for context on constraints)

**Output:**
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
    classification: "strong" | "weak" | "split" | "rejected"
    dissenting: DissentingAgent[]
    redTeamDissent: boolean
  }
}
```

**Aggregation logic:**

| Field | Source |
|-------|--------|
| `title` | Derived from user prompt |
| `finalDecision` | Synthesize Round 3 refine messages, weighted by vote alignment |
| `alternativesConsidered` | Round 1 proposals that diverged from final decision |
| `reasons` | Round 3 suggestions + Round 4 yes-voter justifications |
| `risks` | Round 2 concerns + Round 3 unresolved concerns + Red Team items |
| `openQuestions` | Items where agents abstained or disagreed without resolution |
| `voteSummary` | [VOTING_SYSTEM.md](../company/VOTING_SYSTEM.md) calculation |

**Post-MVP:** Round 5 có thể dùng LLM để synthesize natural language consensus. MVP: deterministic aggregation.

## AgentMessage Schema

Mọi round output tuân theo schema thống nhất:

```ts
interface AgentMessage {
  agentId: string
  round: number
  stance: "support" | "oppose" | "neutral" | "refine"
  content: string
  concerns: string[]
  suggestions: string[]
  vote?: "yes" | "no" | "abstain"  // required in Round 4 only
}
```

Validation: Zod schema, retry 1x on failure, log and continue if second failure.

## Round Context Templates

### Round 1 Instruction
```
ROUND 1: INDEPENDENT THINKING

You are {agent.name}, the {agent.role}.

The Founder has raised this topic:
"{discussion.userPrompt}"

Think independently. Do NOT reference other agents (you cannot see them).
Propose your solution based on your expertise and memory.

Respond as JSON matching AgentMessage schema.
```

### Round 2 Instruction
```
ROUND 2: CROSS CRITIQUE

Review these proposals from other agents:
{round1_messages_formatted}

Your original proposal:
{agent_round1_message}

Critique the proposals above. Find flaws, risks, and missing considerations.
Be direct. Be specific. Reference which agent's proposal you're critiquing.

Respond as JSON matching AgentMessage schema.
```

### Round 3 Instruction
```
ROUND 3: REFINEMENT

Your original proposal: {agent_round1_message}
Critiques received: {round2_messages_about_this_agent}
Your critiques of others: {agent_round2_message}

Refine your position. Incorporate valid critiques. Defend valid positions.
Produce your best final proposal — specific and actionable.

Respond as JSON matching AgentMessage schema.
```

### Round 4 Instruction
```
ROUND 4: VOTING

Refined solutions from all agents:
{round3_messages_formatted}

Your refined position: {agent_round3_message}

Unresolved concerns: {aggregated_concerns}

Cast your vote: yes / no / abstain
Justify your vote in content and concerns.

Respond as JSON matching AgentMessage schema. vote field is REQUIRED.
```

## Error Handling

| Failure | Response |
|---------|----------|
| Agent JSON parse fail | Retry 1x with stricter prompt. If fail again: log, mark message `failed`, continue |
| Agent timeout (>60s) | Mark `timeout`, continue with other agents |
| < 50% agents respond in round | Round status: `partial`. Consensus notes missing voices |
| All agents fail | Discussion status: `failed`. No proposal created |
| Provider rate limit | Exponential backoff, max 3 retries per agent |

## Debate Engine vs Agent Framework

| Aspect | LangGraph / AutoGen | OceanTechAI Debate Engine |
|--------|-------------------|--------------------------|
| Purpose | Complete a task | Reach organizational decision |
| Structure | Free-form or custom graph | Fixed 5-round parliamentary |
| Output | Task result | Consensus + Proposal |
| Conflict | Error or retry | Expected in Round 2, resolved in Round 4 |
| Memory | Optional thread history | 6-layer organizational memory |
| Authority | Agent or human | Weighted vote → Founder approval |
| Audit | Optional logging | Full round-by-round persistence |

## MVP vs Production

| Feature | MVP | Production |
|---------|-----|------------|
| Round execution | Sequential sync | BullMQ async job |
| Round 5 consensus | Deterministic aggregation | LLM-assisted synthesis |
| Round 1 execution | Parallel (Promise.all) | Parallel with concurrency limit |
| Progress UI | Page refresh / polling | WebSocket streaming |
| Round retry | Manual re-run discussion | Auto-retry failed agents |
| Custom round count | Fixed 5 | Configurable per decision class |

## References

- [COMPANY_CHARTER.md](../company/COMPANY_CHARTER.md) — organizational pipeline
- [GOVERNANCE.md](../company/GOVERNANCE.md) — decision flow
- [VOTING_SYSTEM.md](../company/VOTING_SYSTEM.md) — Round 4 mechanics
- [MEMORY_ARCHITECTURE.md](./MEMORY_ARCHITECTURE.md) — context injection
- [AGENT_LIFECYCLE.md](./AGENT_LIFECYCLE.md) — agent states during debate
- [ADR-001: AI Debate](../decisions/ADR-001-AI-DEBATE.md)
