# Governance — OceanTechAI Workspace

## Overview

Governance định nghĩa **luật vận hành** của AI organization — ai có quyền gì, quy trình ra quyết định thế nào, và conflict được giải quyết ra sao.

Đây không phải corporate governance truyền thống. Đây là **protocol layer** cho tổ chức lai human-AI.

```
┌─────────────────────────────────────────────────────────┐
│                    GOVERNANCE LAYERS                    │
├─────────────────────────────────────────────────────────┤
│  Layer 1: CHARTER        — Constitutional rights        │
│  Layer 2: GOVERNANCE     — Operational rules (this doc) │
│  Layer 3: DEBATE ENGINE  — Deliberation protocol        │
│  Layer 4: VOTING SYSTEM  — Decision mechanics           │
│  Layer 5: EXECUTION      — Post-approval actions        │
└─────────────────────────────────────────────────────────┘
```

## Authority Hierarchy

```
Founder (Sovereign)
  │
  ├── Full veto on all decisions
  ├── Agent configuration authority
  ├── Project/workspace governance
  └── Charter amendment power
  │
  ▼
AI Consensus (Advisory)
  │
  ├── Weighted collective vote
  ├── Cannot override Founder
  ├── Cannot self-execute
  └── Creates proposal only
  │
  ▼
Individual AI Members (Participatory)
  │
  ├── Propose within role scope
  ├── Critique across roles
  ├── Vote with assigned weight
  └── No individual execution power
```

**Không có authority level nào giữa Founder và AI Consensus.** AI không có "team lead" hay "senior agent" có quyền override agent khác.

## Decision Classes

Mọi decision được classify theo impact level:

| Class | Mô tả | Debate Required | Founder Approval | Ví dụ |
|-------|-------|-----------------|------------------|-------|
| **D1 — Strategic** | Thay đổi direction, major features | Full 5-round | Mandatory | "Thêm Crew system cho MMO" |
| **D2 — Tactical** | Implementation approach, scope adjustment | Full 5-round | Mandatory | "Crew max size: 20 vs 50" |
| **D3 — Operational** | Task-level, bug fixes, minor changes | Simplified 3-round | Mandatory (MVP) | "Fix crew invite expiry bug" |
| **D4 — Meta** | Governance, agent config, charter | N/A — Founder only | Founder only | "Activate Economy Designer" |

**MVP:** Tất cả discussions chạy full 5-round (D1 protocol). Phân loại D2/D3 là post-MVP optimization.

## Decision Flow

### Standard Flow (D1/D2)

```
1. INITIATION
   Founder creates discussion with user prompt
   System selects active agents for participation
   Agent lifecycle: Active → Participating

2. DELIBERATION
   Debate Engine runs 5 rounds (see DEBATE_ENGINE.md)
   Each round logged to Discussion Memory
   Agent lifecycle: Participating → Voting (Round 4)

3. CONSENSUS
   ConsensusEngine aggregates results
   ProposalGenerator creates Proposal (status: pending)
   Agent lifecycle: Voting → Active (return to standby)

4. REVIEW
   Founder reviews proposal at /proposals/[id]
   Full context: summary, alternatives, risks, files preview

5. RESOLUTION
   ├── Approve  → Execution + Decision Memory + DecisionLog
   ├── Reject   → Archive proposal, no execution
   └── Changes  → Founder feedback → new discussion iteration
```

### Re-discussion Flow (changes_requested)

```
Proposal status: changes_requested
Founder feedback stored in DecisionLog
New discussion created with:
  - Original user prompt
  - Founder feedback as constraint
  - Previous consensus as context (Decision Memory)
  - Agent memories updated with rejection reason
```

## Conflict Resolution

### Agent-to-Agent Conflict

Khi agents disagree (expected và healthy):

| Round | Resolution Mechanism |
|-------|---------------------|
| Round 2 | Critique exposes disagreements — no resolution yet |
| Round 3 | Refine — agents incorporate valid critiques |
| Round 4 | Vote — weighted majority decides |
| Round 5 | Consensus — minority views preserved in `alternativesConsidered` |

**Không có agent nào "thắng" debate.** Consensus document ghi nhận tất cả perspectives.

### Vote Split / Deadlock

Khi vote không đạt majority:

```
IF weighted_yes < 50% AND weighted_no < 50%:
  → Consensus flagged as "split"
  → Proposal created with status: pending
  → Proposal.summary includes vote breakdown
  → Founder decides with full visibility

IF weighted_no > 50% AND red_team voted no:
  → Proposal.summary highlights security/economic concerns
  → UI shows warning badge: "Red Team veto concern"
```

Chi tiết voting: [VOTING_SYSTEM.md](./VOTING_SYSTEM.md)

### Founder-Agent Conflict

Khi Founder reject AI consensus:

```
1. DecisionLog records rejection with Founder notes
2. Decision Memory stores: "Founder rejected X because Y"
3. Agent memories updated:
   - PM memory: "Founder prefers smaller scope for X"
   - Red Team memory: "Founder accepted risk Z"
4. Future discussions inject rejection context
```

Founder luôn thắng. Nhưng hệ thống **học** từ rejection — không lặp lại mistake.

## Agent Participation Rules

### Who Participates

| Condition | Participates? |
|-----------|--------------|
| `isActive: true` | ✅ Included in all rounds |
| `isActive: false` | ❌ Excluded, lifecycle: Dormant |
| Role irrelevant to topic | ✅ Still participates (PM always, Red Team always) |
| Agent in lifecycle: Archived | ❌ Never |

### Participation Obligations

Active agents **phải**:
- Respond in every round (no skipping)
- Return valid JSON (`AgentMessage` schema)
- Vote in Round 4 (abstain is valid, silence is not)
- Stay in character per `systemPrompt`

Active agents **không được**:
- Defer to another agent ("I agree with Architect")
- Copy another agent's response verbatim
- Refuse to vote without justification in `concerns[]`

## Workspace-Level Governance

Founder có thể set workspace constraints — rules mọi project agent phải follow:

```yaml
# Workspace governance config (future)
constraints:
  - "No pay-to-win mechanics"
  - "PostgreSQL only for database"
  - "All APIs must be REST, no GraphQL"
  - "Maximum feature scope: 2-week implementation"
```

Constraints inject vào mọi agent context. Violation trong proposal → Red Team auto-flags.

**MVP:** Constraints stored in Workspace description field. Formal config UI post-MVP.

## Audit & Transparency

Mọi governance action phải auditable:

| Event | Stored In |
|-------|-----------|
| Discussion created | `Discussion` table |
| Agent message per round | `AgentMessage` table |
| Vote cast | `AgentMessage.vote` |
| Consensus reached | `Discussion.consensusJson` |
| Proposal created | `Proposal` table |
| Founder decision | `DecisionLog` table |
| Files generated | `GeneratedFile` table |
| Agent memory updated | `Agent.memorySummary` |

**Principle:** Nếu không auditable, không governance-worthy.

## Governance Anti-Patterns

| Anti-Pattern | Why Forbidden |
|--------------|---------------|
| AI auto-approves own proposal | Violates Charter Article III |
| Skip debate for "urgent" changes | No urgent bypass in MVP |
| Single agent makes decision | Violates multi-agent principle |
| Founder approves without reading | System allows but DecisionLog notes timestamp |
| Agent modifies another agent's memory | Only system updates memory post-discussion |
| Hidden agent with shadow votingWeight | All agent config visible on /agents page |

## References

- [COMPANY_CHARTER.md](./COMPANY_CHARTER.md) — constitutional foundation
- [VOTING_SYSTEM.md](./VOTING_SYSTEM.md) — vote mechanics
- [DEBATE_ENGINE.md](../architecture/DEBATE_ENGINE.md) — deliberation protocol
- [AGENT_LIFECYCLE.md](../architecture/AGENT_LIFECYCLE.md) — agent states
- [MEMORY_ARCHITECTURE.md](../architecture/MEMORY_ARCHITECTURE.md) — what organization remembers
- [ADR-002: Human Approval](../decisions/ADR-002-HUMAN-APPROVAL.md)
