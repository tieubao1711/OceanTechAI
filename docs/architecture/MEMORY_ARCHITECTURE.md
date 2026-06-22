# Memory Architecture — OceanTechAI Workspace

## Overview

Memory là **linh hồn** của OceanTechAI Workspace.

CrewAI, AutoGen, LangGraph giải quyết task completion. OceanTechAI giải quyết **organizational continuity** — AI members nhớ, học, và build on past decisions như nhân viên thật trong công ty.

Không có memory, mỗi discussion là tabula rasa. Agents lặp lại mistakes, ignore Founder preferences, và contradict past decisions. Đó là chatbot behavior — không phải organization behavior.

```
┌─────────────────────────────────────────────────────────────┐
│                    MEMORY HIERARCHY                         │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              GLOBAL MEMORY (Platform)                │   │
│  │  Charter, governance rules, debate format            │   │
│  └────────────────────────┬────────────────────────────┘   │
│                           │                                 │
│  ┌────────────────────────▼────────────────────────────┐   │
│  │           WORKSPACE MEMORY (Company)                 │   │
│  │  Founder preferences, company culture, constraints   │   │
│  └────────────────────────┬────────────────────────────┘   │
│                           │                                 │
│  ┌────────────────────────▼────────────────────────────┐   │
│  │            PROJECT MEMORY (Department)               │   │
│  │  Tech stack, architecture, feature history           │   │
│  └──────────┬─────────────────────────────┬────────────┘   │
│             │                             │                 │
│  ┌──────────▼──────────┐    ┌────────────▼────────────┐   │
│  │   AGENT MEMORY       │    │  DISCUSSION MEMORY      │   │
│  │   (Individual)       │    │  (Session)              │   │
│  │   Role-specific facts│    │  Full debate transcript │   │
│  └──────────┬──────────┘    └────────────┬────────────┘   │
│             │                             │                 │
│             └──────────────┬──────────────┘               │
│                            │                                │
│  ┌─────────────────────────▼───────────────────────────┐   │
│  │              DECISION MEMORY (Institutional)         │   │
│  │  Approved/rejected decisions, rationale, lessons     │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## Memory Layers

### Layer 1: Global Memory

**Scope:** Toàn platform. Immutable bởi agents.

**Chứa:**
- Company Charter rules
- Debate Engine protocol (5 rounds)
- Voting system mechanics
- AgentMessage JSON schema
- Governance anti-patterns

**Storage:** Static docs (`docs/company/`, `docs/architecture/`) + code constants.

**Inject khi nào:** Mỗi agent call — embedded trong orchestrator system context, không phải per-agent field.

**Ví dụ:**
```
"AI members cannot execute irreversible actions."
"All decisions require Founder approval before execution."
"Round 4 votes use weighted voting."
```

**MVP:** Read from docs/code. Không cần DB table.

---

### Layer 2: Workspace Memory

**Scope:** Per workspace. Founder-defined.

**Chứa:**
- Founder preferences và values
- Company culture constraints
- Cross-project rules
- Rejected approaches (workspace-wide)

**Storage:**

```prisma
// MVP: Workspace.description + future WorkspaceMemory table
model Workspace {
  id          String
  name        String
  description String?   // MVP: free-text constraints
  memoryJson  Json?     // Post-MVP: structured workspace memory
}
```

**Ví dụ:**
```json
{
  "founderPreferences": [
    "Founder ghét pay-to-win — mọi monetization phải cosmetic-only",
    "Ưu tiên retention hơn monetization trong Q1",
    "Không ship feature without QA sign-off"
  ],
  "cultureConstraints": [
    "Mobile-first design",
    "Vietnamese + English localization required"
  ],
  "rejectedApproaches": [
    "2026-03: Rejected blockchain integration — too complex for team size"
  ]
}
```

**Inject khi nào:** Mỗi discussion creation — prepended to all agent contexts.

**Ai update:** Founder manually (MVP). Post-discussion auto-extract (post-MVP).

---

### Layer 3: Project Memory

**Scope:** Per project. Accumulated qua discussions và decisions.

**Chứa:**
- Tech stack decisions
- Architecture patterns in use
- Feature history (shipped, in-progress, rejected)
- Known technical debt
- Integration points

**Storage:**

```prisma
model Project {
  id          String
  name        String
  description String?
  memoryJson  Json?     // Structured project memory
}
```

**Ví dụ:**
```json
{
  "techStack": {
    "database": "PostgreSQL 15",
    "backend": "Node.js + Express",
    "frontend": "React + TailwindCSS",
    "deployment": "AWS ECS"
  },
  "architecture": {
    "pattern": "Modular monolith",
    "apiStyle": "REST /api/v1/",
    "authMethod": "JWT"
  },
  "featureHistory": [
    { "name": "Inventory System", "status": "shipped", "date": "2026-01" },
    { "name": "Guild System", "status": "shipped", "date": "2026-02" },
    { "name": "Crew System", "status": "in_discussion", "date": "2026-06" }
  ],
  "knownIssues": [
    "Inventory module had duplication bug — fixed in v1.2.3",
    "Guild chat not partitioned — performance risk at 10k+ messages"
  ]
}
```

**Inject khi nào:** Mỗi agent call trong discussion — Architect và Engineers cần đặc biệt.

**Ai update:** System auto-update sau mỗi approved proposal (post-MVP). MVP: manual via project description.

---

### Layer 4: Agent Memory

**Scope:** Per agent per project. Role-specific learned knowledge.

**Chứa:**
- Facts learned từ past discussions
- Founder feedback relevant to agent's role
- Past positions và outcomes
- Domain-specific warnings

**Storage:**

```prisma
model Agent {
  // ...
  memorySummary  String?   // Text summary, MVP approach
  memoryJson     Json?     // Post-MVP: structured agent memory
}
```

**Ví dụ theo role:**

**Economy Designer nhớ:**
```
- Founder ghét pay-to-win. Mọi monetization proposal phải cosmetic-only.
- Q1 2026: Gold inflation hit 15% sau guild reward event — cần cap rewards.
- Crew treasury proposal bị reject vì alt-account laundering risk.
- Player Gini coefficient target: < 0.45.
```

**Architect nhớ:**
```
- Project dùng PostgreSQL — không propose NoSQL.
- API convention: REST /api/v1/, không GraphQL.
- Modular monolith pattern — không propose microservices cho MVP features.
- Inventory table cần composite index (user_id, item_id) — learned from perf issue.
```

**QA nhớ:**
```
- Inventory module từng có bug item duplication — cần test concurrent operations.
- Guild invite không có expiry check — reported 2026-02, fixed v1.1.8.
- Crew system cần test: max capacity race condition, leader disconnect.
- Regression suite: 47 tests, P0 tests must pass before any ship.
```

**Red Team nhớ:**
```
- Founder rejected mass-report auto-disband — cần manual review threshold.
- Alt-account detection: account age gate 7 days minimum.
- Chat moderation: profanity filter required for any social feature.
- Previous abuse: guild name impersonation '[ADMIN]' — reserved name list exists.
```

**Product Manager nhớ:**
```
- Founder prefers MVP scope ≤ 2-week implementation.
- Retention > monetization priority for Q1.
- Crew system: Founder wants social bonds, not competitive guild wars.
- Success metric preference: DAU-based, not revenue-based.
```

**Inject khi nào:** Mỗi agent call — prepended to agent's system prompt:

```
[Agent Memory]
{agent.memorySummary}

[Project Memory]
{project.memoryJson summary}

[Workspace Memory]
{workspace constraints}
```

**Ai update:** System post-discussion (post-MVP). MVP: Founder edits manually on /agents page.

---

### Layer 5: Discussion Memory

**Scope:** Per discussion session. Ephemeral during debate, permanent after.

**Chứa:**
- User prompt (Founder input)
- All rounds (1–5) với full agent messages
- Consensus result
- Linked proposal

**Storage:**

```prisma
model Discussion {
  id            String
  userPrompt    String
  status        String
  consensusJson Json?
  rounds        DiscussionRound[]
}

model DiscussionRound {
  id             String
  discussionId   String
  roundNumber    Int
  roundType      String    // propose | critique | refine | vote | consensus
  messages       AgentMessage[]
}

model AgentMessage {
  id          String
  roundId     String
  agentId     String
  stance      String
  content     String
  concerns    String[]
  suggestions String[]
  vote        String?
}
```

**Inject khi nào:**
- Round 1: chỉ user prompt + memory layers
- Round 2+: previous rounds' messages as context
- Round 3: Round 1 proposals + Round 2 critiques
- Round 4: Round 3 refined solutions
- Round 5: all rounds (ConsensusEngine input)

**Ai update:** Real-time during debate. Immutable after discussion complete.

---

### Layer 6: Decision Memory

**Scope:** Per approved/rejected proposal. Institutional record.

**Chứa:**
- What was decided
- Why (reasoning + vote summary)
- Who decided (Founder action)
- What was rejected and why
- Generated artifacts produced

**Storage:**

```prisma
model DecisionLog {
  id          String
  proposalId  String
  action      String    // approved | rejected | changes_requested
  decidedBy   String    // Founder userId
  decidedAt   DateTime
  notes       String?
}

model Proposal {
  // ... full proposal fields serve as decision record
  status      String
}
```

**Ví dụ:**
```json
{
  "decision": "approved",
  "feature": "Crew System MVP",
  "chosenSolution": "Crew creation + invite + chat, max 20 members",
  "founderNotes": "Approved with condition: no crew treasury in Phase 1",
  "aiVoteSummary": { "yes": 4.0, "no": 1.5, "classification": "weak" },
  "rejectedAlternatives": [
    "Crew wars (deferred to Phase 2)",
    "Crew housing (out of scope)",
    "Unlimited crew size (rejected by QA + Red Team)"
  ],
  "lessonsForFuture": [
    "Founder defers competitive features",
    "Red Team concerns about treasury accepted — removed from scope"
  ],
  "generatedArtifacts": [
    "docs/features/crew-system.md",
    "docs/architecture/crew-system.md",
    "docs/api/crew-system.md",
    "tasks/crew-system.cursor.md"
  ]
}
```

**Inject khi nào:**
- New discussions about related features
- Re-discussion after `changes_requested`
- Agent memory update post-decision

**Ai update:** Created on Founder action. Immutable.

## Memory Injection Pipeline

Mỗi agent call trong Debate Engine assemble context theo thứ tự:

```
┌─────────────────────────────────────────┐
│ 1. Global Memory (charter rules)        │  ← Static, always
├─────────────────────────────────────────┤
│ 2. Workspace Memory (founder prefs)     │  ← Per workspace
├─────────────────────────────────────────┤
│ 3. Project Memory (tech context)        │  ← Per project
├─────────────────────────────────────────┤
│ 4. Agent Memory (role-specific facts)   │  ← Per agent
├─────────────────────────────────────────┤
│ 5. Decision Memory (past decisions)     │  ← If related topic
├─────────────────────────────────────────┤
│ 6. Discussion Memory (current debate)   │  ← Previous rounds
├─────────────────────────────────────────┤
│ 7. Round Instruction (what to do now)   │  ← Round-specific
└─────────────────────────────────────────┘
```

```ts
// server/ai/agents/context-builder.ts

interface AgentContext {
  globalRules: string
  workspaceMemory: string
  projectMemory: string
  agentMemory: string
  relevantDecisions: string
  discussionHistory: string
  roundInstruction: string
  userPrompt: string
}

function buildAgentContext(
  agent: Agent,
  discussion: Discussion,
  round: DiscussionRound
): AgentContext {
  // Layer 1-7 assembly
}
```

## Memory Update Lifecycle

```
Discussion Complete
       ↓
Proposal Created (pending)
       ↓
Founder Decides
       ↓
  ┌────┴────┐
Approve   Reject/Changes
  │         │
  ▼         ▼
Decision   Decision Memory
Memory     + Agent Memory
created    update with
  │        rejection lessons
  ▼
Project Memory update (feature history)
  │
  ▼
Agent Memory update (per-agent learnings)
  │
  ▼
Workspace Memory update (if founder preference discovered)
```

### MVP Memory Strategy

| Layer | MVP Approach |
|-------|-------------|
| Global | Static docs |
| Workspace | `Workspace.description` free text |
| Project | `Project.description` + `memoryJson` manual |
| Agent | `Agent.memorySummary` manual edit on /agents |
| Discussion | Full DB persistence (automatic) |
| Decision | `DecisionLog` + `Proposal` (automatic on approve/reject) |

**Post-MVP:** Auto-summarize discussion → update agent memories via LLM.

```ts
// Post-MVP: server/ai/memory/memory-updater.ts
async function updateMemoriesAfterDecision(proposal: Proposal, action: string) {
  const learnings = await llm.summarize(proposal, action)
  await updateAgentMemories(proposal.discussionId, learnings)
  await updateProjectMemory(proposal.projectId, learnings)
}
```

## Memory Anti-Patterns

| Anti-Pattern | Impact |
|--------------|--------|
| No memory injection | Agents repeat past mistakes |
| Stale agent memory | Agent references rejected approaches as valid |
| Memory bloat (>4K tokens) | Context window overflow, degraded responses |
| Cross-project memory leak | Agent A's project memory visible in Project B |
| Agent self-modifies memory | Corrupted organizational knowledge |
| Decision memory not injected | Re-discussion ignores past Founder rejections |

## Token Budget Management

MVP context budget per agent call:

| Layer | Max Tokens | Priority |
|-------|-----------|----------|
| Global | 200 | Always include |
| Workspace | 300 | Always include |
| Project | 500 | Always include |
| Agent Memory | 400 | Always include |
| Decision Memory | 400 | Include if related |
| Discussion History | 1500 | Round-dependent |
| Round Instruction | 200 | Always include |
| **Total budget** | **~3500** | Leaves room for response |

Post-MVP: semantic search để select relevant decision memory thay vì inject all.

## References

- [COMPANY_CHARTER.md](../company/COMPANY_CHARTER.md) — Article VI: Institutional Memory
- [DEBATE_ENGINE.md](./DEBATE_ENGINE.md) — context injection per round
- [AGENT_LIFECYCLE.md](./AGENT_LIFECYCLE.md) — when agents read/write memory
- [AGENT_ARCHITECTURE.md](./AGENT_ARCHITECTURE.md) — AgentProfile.memorySummary
