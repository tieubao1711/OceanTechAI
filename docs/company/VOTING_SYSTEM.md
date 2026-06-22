# Voting System — OceanTechAI Workspace

## Overview

Voting là cơ chế **collective decision-making** của AI organization. Không phải democracy thuần túy (one agent one vote). Là **weighted expertise voting** — agents có influence tương ứng với vai trò và risk relevance.

Voting xảy ra ở **Round 4** của Debate Engine. Kết quả feed vào **Round 5 Consensus**.

```
Round 1: Propose     →  N opinions
Round 2: Critique    →  N critiques
Round 3: Refine      →  N refined positions
Round 4: Vote        →  1 collective signal    ← THIS DOCUMENT
Round 5: Consensus   →  1 synthesized decision
```

## Vote Types

Mỗi participating agent cast exactly one vote:

| Vote | Meaning | When to Use |
|------|---------|-------------|
| `yes` | Endorse refined solution | Concerns addressed, ready for proposal |
| `no` | Reject refined solution | Critical unmitigated risks remain |
| `abstain` | Insufficient expertise/context | Outside agent's domain, need more data |

**Silence is not a vote.** Agent fail to vote → round marked incomplete → retry once.

## Weighted Voting

### Formula

```
weighted_score(vote) = Σ (agent.votingWeight) for each agent casting that vote

approval_ratio = weighted_yes / (weighted_yes + weighted_no + weighted_abstain)
rejection_ratio = weighted_no / (weighted_yes + weighted_no + weighted_abstain)
```

`abstain` counts in denominator nhưng không contribute to yes/no numerator.

### Default Weights

| Agent Role | Default Weight | Rationale |
|------------|---------------|-----------|
| Product Manager | 1.0 | Standard — user value perspective |
| System Architect | 1.0 | Standard — technical authority |
| Backend Engineer | 1.0 | Standard |
| Frontend Engineer | 1.0 | Standard |
| QA Engineer | 1.0 | Standard |
| Game Designer | 1.0 | Standard |
| Economy Designer | 1.0 | Standard (1.5 when economy-critical) |
| DevOps Engineer | 1.0 | Standard |
| **Red Team Critic** | **1.5** | Elevated — security/abuse veto power |

Founder có thể override weights per agent tại `/projects/[projectId]/agents`.

### Example Calculation

6 active agents vote on Crew system proposal:

| Agent | Vote | Weight | Weighted |
|-------|------|--------|----------|
| Product Manager | yes | 1.0 | 1.0 |
| Architect | yes | 1.0 | 1.0 |
| Backend Engineer | yes | 1.0 | 1.0 |
| Frontend Engineer | abstain | 1.0 | — |
| QA Engineer | yes | 1.0 | 1.0 |
| Red Team | no | 1.5 | 1.5 |

```
weighted_yes  = 4.0
weighted_no   = 1.5
weighted_abstain = 1.0
total_participating = 6.5

approval_ratio  = 4.0 / 6.5 = 61.5%
rejection_ratio = 1.5 / 6.5 = 23.1%
abstain_ratio   = 1.0 / 6.5 = 15.4%
```

**Result:** Majority yes, nhưng Red Team dissent flagged in consensus.

## Vote Thresholds

### Consensus Classification

| Condition | Classification | Proposal Behavior |
|-----------|---------------|-------------------|
| `approval_ratio ≥ 60%` AND `rejection_ratio < 30%` | **Strong consensus** | Proposal created, high confidence |
| `approval_ratio ≥ 50%` AND `rejection_ratio < 40%` | **Weak consensus** | Proposal created, concerns highlighted |
| `approval_ratio < 50%` OR `rejection_ratio ≥ 40%` | **Split decision** | Proposal created with `split` flag, Founder warning |
| `rejection_ratio ≥ 50%` | **Majority reject** | Proposal created but UI shows "AI rejected" badge |
| Red Team `no` AND `approval_ratio < 70%` | **Security concern** | Red Team dissent prominently displayed |

**Quan trọng:** Mọi classification đều tạo proposal với status `pending`. AI không có quyền kill proposal — chỉ Founder reject.

### Red Team Veto Influence

Red Team không có hard veto (Founder mới có). Nhưng `votingWeight: 1.5` tạo **soft veto influence**:

```
IF red_team.vote == "no":
  AND approval_ratio < 70%:
    → consensus.risks[] prepends Red Team concerns
    → proposal UI shows "⚠ Security Review Failed" badge
    → Founder sees Red Team's Round 2 critique highlighted
```

Đây là **advisory veto** — không block, nhưng force visibility.

## Vote Context Rules

### What Agents Vote On

Round 4 vote là về **refined solution từ Round 3**, không phải:
- ❌ Round 1 original proposal
- ❌ Individual agent's preference
- ❌ Founder input

Vote prompt injected cho mỗi agent:

```
You are voting on the REFINED solution from Round 3.

Refined solution summary:
{aggregated_round_3_refine_messages}

Your Round 3 position:
{agent_own_round_3_message}

Unresolved concerns from Round 2:
{aggregated_concerns}

Cast your vote: yes / no / abstain
Justify in concerns[] if voting no or abstain.
```

### Vote Integrity

| Rule | Enforcement |
|------|-------------|
| One vote per agent per discussion | DB unique constraint: `(roundId, agentId)` |
| Vote immutable after round complete | No update on `AgentMessage.vote` post-round |
| Vote must match JSON schema | Zod validation before persist |
| Weight locked at discussion start | Snapshot `votingWeight` vào `AgentMessage` metadata |

## Vote Summary Output

`ConsensusEngine` produces `voteSummary` cho Round 5:

```ts
interface VoteSummary {
  yes: number           // weighted yes total
  no: number            // weighted no total
  abstain: number       // weighted abstain total
  raw: {                // unweighted counts for UI display
    yes: number
    no: number
    abstain: number
  }
  classification: "strong" | "weak" | "split" | "rejected"
  dissenting: {         // agents who voted against majority
    agentId: string
    agentName: string
    role: string
    vote: "no" | "abstain"
    keyConcern: string  // top concern from their Round 2/3
  }[]
  redTeamDissent: boolean
}
```

## Founder vs AI Vote

| Scenario | AI Vote | Founder Action | Outcome |
|----------|---------|----------------|---------|
| Strong yes | 80% yes | Approve | Execute — high confidence |
| Strong yes | 80% yes | Reject | Dead — Founder saw risk AI missed |
| Split | 45% yes | Approve | Execute — Founder breaks tie |
| Majority no | 60% no | Approve | Execute — Founder overrides AI |
| Strong yes | 80% yes | Request Changes | Re-debate with feedback |

**Founder vote không nằm trong AI voting system.** Founder vote là separate sovereign action ở governance layer trên.

## MVP Implementation

### Database

Vote stored in `AgentMessage`:

```prisma
model AgentMessage {
  // ...
  vote    String?   // "yes" | "no" | "abstain" — only Round 4
  votingWeightSnapshot Float?  // weight at discussion time
}
```

### Service

```ts
// server/ai/orchestrator/consensus-engine.ts

class ConsensusEngine {
  calculateVoteSummary(messages: AgentMessage[]): VoteSummary {
    const round4 = messages.filter(m => m.round === 4)
    // weighted calculation
    // classification logic
    // dissenting agent extraction
  }
}
```

### UI Display

Proposal page và Discussion page hiển thị:
- Weighted bar chart: yes / no / abstain
- Per-agent vote cards với role badge
- Red Team dissent warning (conditional)
- Classification badge: Strong / Weak / Split

## Future Enhancements

| Enhancement | Description |
|-------------|-------------|
| **Dynamic weights** | Auto-boost Economy Designer weight khi topic mentions currency/rewards |
| **Quorum rules** | Minimum 4 agents phải vote (not abstain) |
| **Vote delegation** | Agent A delegates vote to Agent B (post-MVP, controversial) |
| **Historical voting patterns** | "Architect votes yes 85% of the time" analytics |
| **Founder pre-vote** | Founder sets constraints before debate, agents vote within bounds |

## References

- [COMPANY_CHARTER.md](./COMPANY_CHARTER.md) — AI right to vote, prohibition on final decisions
- [GOVERNANCE.md](./GOVERNANCE.md) — conflict resolution, deadlock handling
- [DEBATE_ENGINE.md](../architecture/DEBATE_ENGINE.md) — Round 4 specification
- [AGENT_ARCHITECTURE.md](../architecture/AGENT_ARCHITECTURE.md) — ConsensusEngine overview
