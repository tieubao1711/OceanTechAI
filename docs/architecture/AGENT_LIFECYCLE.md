# Agent Lifecycle — OceanTechAI Workspace

## Overview

AI members trong OceanTechAI không phải stateless functions. Họ có **lifecycle** — trạng thái tồn tại, tham gia, và nghỉ trong organization.

Lifecycle định nghĩa:
- Agent **khi nào** được gọi vào discussion
- Agent **được phép làm gì** ở mỗi state
- Agent **chuyển state thế nào**
- Agent **khi nào** được archive

```
    ┌──────────┐
    │ CREATED  │  Agent record born in database
    └────┬─────┘
         │ Founder activates
         ▼
    ┌──────────┐
    │  ACTIVE  │  Ready for discussions
    └────┬─────┘
         │ Discussion starts, agent selected
         ▼
    ┌──────────────┐
    │ PARTICIPATING│  Running through Rounds 1-3
    └────┬─────────┘
         │ Round 4 begins
         ▼
    ┌──────────┐
    │  VOTING  │  Casting vote in Round 4
    └────┬─────┘
         │ Round 5 complete, discussion ends
         ▼
    ┌──────────┐
    │  ACTIVE  │  Return to standby (ready for next discussion)
    └────┬─────┘
         │ Founder deactivates
         ▼
    ┌──────────┐
    │  DORMANT │  Excluded from discussions, memory preserved
    └────┬─────┘
         │ Founder archives
         ▼
    ┌──────────┐
    │ ARCHIVED │  Read-only historical record
    └──────────┘
```

## State Definitions

### CREATED

**Entry:** Founder creates agent via `/projects/[projectId]/agents`

**Characteristics:**
- Agent record exists in database
- `isActive: false` (default on create, unless seeded as active)
- `memorySummary: null` (no experiences yet)
- `systemPrompt` set from role template or custom
- `votingWeight` set to role default

**Permissions:**
- ✅ Editable (name, role, prompt, weight, expertise)
- ✅ Activatable
- ❌ Cannot participate in discussions
- ❌ No memory reads/writes

**Database:**
```prisma
model Agent {
  status  String  @default("created")  // Post-MVP explicit field
  isActive Boolean @default(false)
}
```

**MVP:** `isActive: false` implies CREATED/DORMANT. Post-MVP: explicit `status` enum field.

**Transition:**
```
CREATED ──[Founder: Activate]──→ ACTIVE
CREATED ──[Founder: Delete]───→ (removed)
```

---

### ACTIVE

**Entry:** Founder sets `isActive: true`

**Characteristics:**
- Agent eligible for all new discussions
- Memory loaded and injectable
- Appears on project dashboard agent list
- `votingWeight` locked at discussion start (snapshot, not live)

**Permissions:**
- ✅ Participate in discussions (auto-selected)
- ✅ Read all memory layers
- ✅ Propose, critique, refine, vote
- ✅ Memory updated post-decision (post-MVP auto, MVP manual)
- ❌ Cannot modify own configuration (Founder only)
- ❌ Cannot execute approved proposals

**Transition:**
```
ACTIVE ──[Discussion starts]────→ PARTICIPATING
ACTIVE ──[Founder: Deactivate]──→ DORMANT
ACTIVE ──[Founder: Archive]─────→ ARCHIVED
```

---

### PARTICIPATING

**Entry:** Discussion orchestrator selects agent (`isActive: true`)

**Characteristics:**
- Agent running through Debate Engine rounds
- Temporary state — exists only during active discussion
- Runtime state, not persisted in DB (MVP)
- Agent receives full memory injection per round

**Permissions:**
- ✅ Respond in current round
- ✅ Read discussion history (previous rounds)
- ✅ Read memory layers
- ❌ Cannot skip rounds
- ❌ Cannot modify memory mid-discussion
- ❌ Cannot see other agents' current-round responses (until round complete)

**Round progression within PARTICIPATING:**

```
PARTICIPATING
  ├── Round 1: Independent Thinking
  ├── Round 2: Cross Critique
  └── Round 3: Refinement
       │
       ▼
    VOTING (Round 4)
```

**Transition:**
```
PARTICIPATING ──[Round 4 starts]──→ VOTING
PARTICIPATING ──[Discussion fails]─→ ACTIVE (with error logged)
PARTICIPATING ──[Founder cancels]──→ ACTIVE (discussion status: cancelled)
```

**Concurrency:** Multiple agents can be PARTICIPATING simultaneously in same discussion. Agent cannot be PARTICIPATING in two discussions at once (MVP: enforce at orchestrator level).

---

### VOTING

**Entry:** Round 4 begins

**Characteristics:**
- Agent must cast vote: `yes` / `no` / `abstain`
- `votingWeight` snapshotted — changes during vote don't affect current discussion
- Short-lived state (single round)

**Permissions:**
- ✅ Cast vote with justification
- ✅ Read Round 3 refined solutions
- ❌ Cannot change Round 1-3 messages
- ❌ Cannot abstain without justification in `concerns[]`

**Transition:**
```
VOTING ──[Round 4 complete]──→ ACTIVE
VOTING ──[Vote fail × 2]────→ ACTIVE (vote recorded as "abstain" with error flag)
```

---

### DORMANT

**Entry:** Founder sets `isActive: false`

**Characteristics:**
- Agent excluded from new discussions
- `memorySummary` preserved — knowledge not lost
- Visible on agents page with "inactive" badge
- Historical messages in past discussions remain accessible

**Permissions:**
- ✅ Readable (view config, memory, past messages)
- ✅ Editable by Founder (prompt, memory, weight)
- ✅ Reactivatable
- ❌ Cannot participate in discussions
- ❌ No new memory writes

**Use cases:**
- Temporarily remove Economy Designer when project has no economy features
- Disable Game Designer for backend-only project
- Pause Red Team during low-risk discussions (not recommended)

**Transition:**
```
DORMANT ──[Founder: Activate]──→ ACTIVE
DORMANT ──[Founder: Archive]───→ ARCHIVED
DORMANT ──[Founder: Delete]────→ (removed, if no historical messages)
```

---

### ARCHIVED

**Entry:** Founder archives agent

**Characteristics:**
- Permanent read-only state
- All historical data preserved (messages, votes, memory)
- Not visible in active agent list (separate "archived" tab)
- Cannot be reactivated — must create new agent if role needed again

**Permissions:**
- ✅ Readable (historical audit)
- ❌ Not editable
- ❌ Not activatable
- ❌ Not participatable

**Use cases:**
- Role no longer needed (e.g., Game Designer after project pivot)
- Agent replaced by new version with updated systemPrompt
- Compliance: preserve audit trail without active participation

**Transition:**
```
ARCHIVED ── (terminal state, no transitions)
```

## Lifecycle × Memory Interaction

| State | Read Memory | Write Memory |
|-------|------------|--------------|
| CREATED | ❌ | ❌ |
| ACTIVE | ✅ (ready) | ❌ (until post-decision) |
| PARTICIPATING | ✅ (injected per round) | ❌ (mid-discussion) |
| VOTING | ✅ (round context) | ❌ |
| DORMANT | ✅ (preserved) | ❌ |
| ARCHIVED | ✅ (historical) | ❌ |

**Post-decision memory write (post-MVP):**

```
Discussion ends → Founder decides
  ├── Approved  → update Agent.memorySummary for all participants
  ├── Rejected  → update Agent.memorySummary with rejection lessons
  └── Changes   → update Agent.memorySummary with Founder feedback
```

## Lifecycle × Debate Engine Interaction

```ts
// server/ai/orchestrator/discussion-orchestrator.ts

async run(discussionId: string) {
  const agents = await agentService.getActive(projectId)
  // Only ACTIVE agents selected — DORMANT and ARCHIVED excluded

  for (const round of ROUNDS) {
    for (const agent of agents) {
      // Runtime state: PARTICIPATING (R1-R3) or VOTING (R4)
      const message = await agentRunner.run(agent, round, context)
      await saveMessage(message)
    }
  }

  // All agents return to ACTIVE (implicit — no DB state change in MVP)
}
```

## Agent Configuration Changes During Lifecycle

| Change | Allowed In State | Effect |
|--------|-----------------|--------|
| Edit `systemPrompt` | CREATED, ACTIVE, DORMANT | Takes effect next discussion |
| Edit `votingWeight` | CREATED, ACTIVE, DORMANT | Takes effect next discussion |
| Edit `memorySummary` | Any except ARCHIVED | Takes effect next discussion |
| Change `modelProvider` | CREATED, ACTIVE, DORMANT | Takes effect next discussion |
| Toggle `isActive` | CREATED ↔ ACTIVE ↔ DORMANT | Immediate |
| Archive | Any except ARCHIVED | Immediate, irreversible |

**Rule:** Configuration changes during PARTICIPATING/VOTING do not affect current discussion. Weight snapshot protects vote integrity.

## Default Agent Lifecycle (Seed)

MVP seed creates 6 agents in ACTIVE state:

| Agent | Initial State | Notes |
|-------|--------------|-------|
| Product Manager | ACTIVE | Always participates |
| System Architect | ACTIVE | Always participates |
| Backend Engineer | ACTIVE | Always participates |
| Frontend Engineer | ACTIVE | Always participates |
| QA Engineer | ACTIVE | Always participates |
| Red Team Critic | ACTIVE | Always participates, weight 1.5 |
| Economy Designer | DORMANT | Activate for economy features |
| Game Designer | DORMANT | Activate for game design topics |
| DevOps Engineer | DORMANT | Activate for infra discussions |

## UI Representation

### Agents Page (`/projects/[projectId]/agents`)

| State | Badge | Actions Available |
|-------|-------|-------------------|
| CREATED | `○ Inactive` | Edit, Activate, Delete |
| ACTIVE | `● Active` | Edit, Deactivate, Archive |
| DORMANT | `◐ Dormant` | Edit, Activate, Archive |
| ARCHIVED | `◌ Archived` | View only |

During discussion, participating agents show `◉ In Debate` badge on project dashboard (runtime, not persisted).

## Lifecycle Events (Audit)

| Event | Logged In |
|-------|-----------|
| Agent created | `Agent.createdAt` |
| Agent activated | Future: `AgentLifecycleLog` |
| Agent participated in discussion | `AgentMessage` records |
| Agent voted | `AgentMessage.vote` |
| Agent deactivated | Future: `AgentLifecycleLog` |
| Agent archived | Future: `AgentLifecycleLog` |
| Agent memory updated | `Agent.memorySummary` timestamp |

**MVP:** Lifecycle transitions implicit via `isActive` changes. Post-MVP: explicit `AgentLifecycleLog` table.

## Anti-Patterns

| Anti-Pattern | Why Wrong |
|--------------|------------|
| Delete agent with discussion history | Breaks audit trail — use ARCHIVED |
| Activate agent mid-discussion | Weight snapshot violated — wait for discussion end |
| Multiple ACTIVE agents same role | Confusing votes — one role per project (MVP) |
| ARCHIVED agent in new discussion | Historical only — create new agent |
| Agent self-deactivate | Only Founder controls lifecycle |

## References

- [COMPANY_CHARTER.md](../company/COMPANY_CHARTER.md) — AI member rights
- [GOVERNANCE.md](../company/GOVERNANCE.md) — participation rules
- [DEBATE_ENGINE.md](./DEBATE_ENGINE.md) — round execution during PARTICIPATING
- [MEMORY_ARCHITECTURE.md](./MEMORY_ARCHITECTURE.md) — memory read/write per state
- [AGENT_ARCHITECTURE.md](./AGENT_ARCHITECTURE.md) — AgentProfile definition
