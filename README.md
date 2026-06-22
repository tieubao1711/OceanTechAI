# OceanTechAI Workspace

**Operating System for AI Organizations** — not an agent framework.

```
User Input → AI Debate → AI Consensus → Human Approval → Automated Execution
```

## Prerequisites

- Node.js 18+
- PostgreSQL 14+

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Configure database
cp .env.example .env
# Edit DATABASE_URL in .env

# 3. Push schema & seed
npm run db:push
npm run db:seed

# 4. Run dev server
npm run dev
```

Open [http://localhost:3001](http://localhost:3001) (port 3001 — override with `npm run dev -- -p 3002`)

## Quick Start Dogfooding

Use OceanTechAI to manage and improve itself:

```bash
npm install
cp .env.example .env          # set DATABASE_URL
npm run setup:local           # checklist: DB, AI mode, GitHub
npm run db:push
npm run db:seed
npm run self:test             # full self-improvement loop test
npm run dev
```

Then open the Executive Dashboard:

```
http://localhost:3001/projects/oceantechai-core/executive
```

Full guide: [`docs/DOGFOODING_GUIDE.md`](docs/DOGFOODING_GUIDE.md)  
Prompt templates: [`docs/prompts/SELF_MANAGEMENT_PROMPTS.md`](docs/prompts/SELF_MANAGEMENT_PROMPTS.md)

## Seed Data

After `npm run db:seed`:

- **User:** founder@oceantechai.local
- **Demo workspace:** OceanTechAI Demo (`seed-workspace`) → MMO Game Project (`seed-project`)
- **Dogfood workspace:** OceanTechAI Self-Test (`dogfood-workspace`) → **OceanTechAI Core** (`oceantechai-core`)
- **Agents:** 9 default agents (6 active) per project
- **ADRs:** 001–004 seeded on each project

## E2E Mock Flow

1. Go to `/workspaces` → open seed workspace → open project
2. `/projects/[id]/discussions/new` → enter prompt
3. On discussion page → **Run Debate (Mock 5 Rounds)**
4. Review rounds → **View Proposal**
5. **Approve** → generated Markdown files are created in DB + `/generated`
6. (Optional) **Execute to GitHub** on proposal detail → branch, commits, PR, issues

## GitHub Integration (optional)

Add to `.env` when you want to push approved proposals to a real repo:

```bash
GITHUB_TOKEN=ghp_...
GITHUB_OWNER=your-org
GITHUB_REPO=your-repo
GITHUB_DEFAULT_BRANCH=main
```

**Local workflow:**

1. Approve a proposal (generates files — does **not** auto-push to GitHub)
2. Open proposal detail → review **Generated Files**
3. Click **Execute to GitHub** (manual Founder action)
4. Check **Execution Logs**, PR URL, and issue links on the same page

If `GITHUB_TOKEN` is missing, the app still runs; execution logs a clear `FAILED` message with setup instructions in the UI.

## Architecture

```
src/server/
  ai/providers/   # AIProvider abstraction (mock, openai, future: anthropic, google)
  governance/     # Charter enforcement, voting, decision classification
  memory/         # 6-layer organizational memory
  debate/         # 5-round Debate Engine
  proposals/      # Proposal + Markdown generators
  agents/         # AgentRunner, prompt builder, profiles
  integrations/   # GitHub client, repository config
  execution/      # Approved proposal → branch, commits, PR, issues
  services/       # Workspace, project, discussion, proposal services
```

## AI Provider Modes

Configure in `.env`:

```bash
# Default — deterministic mock responses, no API key needed
AI_PROVIDER_MODE=mock

# All agents use OpenAI (falls back to mock if key missing or API error)
AI_PROVIDER_MODE=openai
OPENAI_API_KEY=sk-...
OPENAI_DEFAULT_MODEL=gpt-4.1

# Per-agent routing: agent.modelProvider=openai uses OpenAI, others use mock
AI_PROVIDER_MODE=hybrid
OPENAI_API_KEY=sk-...
```

**Fallback behavior:**
- Missing `OPENAI_API_KEY` → auto fallback to `MockProvider`
- OpenAI timeout/retry exhausted → fallback to mock + warning log
- Invalid JSON from AI → JSON repair layer, then `ValidationError`
- Low agent quality (&lt;60) → 1 retry with quality prompt, then accept with warning
- Low consensus quality (&lt;70) → no proposal (`CONSENSUS_QUALITY_TOO_LOW`)
- `npm run e2e:mock` always uses mock (default `AI_PROVIDER_MODE=mock`)

**Provider tuning:**
```bash
AI_PROVIDER_TIMEOUT_MS=60000
AI_PROVIDER_MAX_RETRIES=2
```

**Recommended modes:**
- `mock` — local dev, tests, `npm run e2e:mock`
- `openai` — real AI debate testing (requires API key)
- `hybrid` — per-agent: set `modelProvider=openai` on agents you want real

**Pipeline:**
```
DiscussionOrchestrator → RoundRunner → AgentRunner → ModelRouter → AIProvider
  → Zod contract validation → Save DB
```

## Key Constraints

- **Human approval required** — `MarkdownGenerator` throws if proposal not `APPROVED`
- **Weighted voting** — Red Team default weight 1.5
- **Structured output** — all agent messages validated via Zod contracts before DB save

## Phase 2.5: Codebase Awareness MVP

Agents receive a **Project Knowledge Snapshot** built from `docs/`, `README`, `package.json`, Prisma schema, and `src/server/` — no RAG/embeddings.

## Phase 2.6: Audit Mode Compression & Evidence Enforcement

Architecture Audit uses a **dedicated 3-round workflow** (`src/server/audit/`) — not the 5-round debate pipeline:

| Round | Agents | Purpose |
|-------|--------|---------|
| 1 | Architect, Backend, Red Team | Independent findings (max 5 each, `fileOrModule` required) |
| 2 | Same 3 | Cross-critique via compressed summary only |
| 3 | Consensus engine | Merge, dedupe, rank top 5 → `ArchitectureAuditReport` |

- Compressed context target: **<1500 tokens** (`formatForAuditPrompt`)
- Token target: **<25k** per audit (3 agents × 2 rounds vs 6 agents × 4)
- Executive Dashboard: **Architecture Health** card (last score, top debts, token usage)
- CLI: `npm run audit:oceantechai`

## Phase 2: Self-Improvement Organization

After debates and approvals, OceanTechAI observes, learns, and suggests improvements — still requiring Founder approval for action.

**New modules:**
- `journals/` — agent journals after each debate (lessons, observations, warnings)
- `insights/` — decision learning, executive briefing, reputation, timeline, ADRs
- `recommendations/` — recommended next actions from project signals
- `autonomous/` — manual autonomous review → suggestion drafts (not proposals)

**Executive workflow:**
1. Open `/projects/[id]/executive` — Morning Brief, risks, top agents, recommendations
2. **Run Autonomous Review** — creates suggestion drafts from accumulated signals
3. For each suggestion: **Create Discussion**, **Ignore**, or **Archive**
4. `/projects/[id]/timeline` — organizational history
5. `/projects/[id]/agents` — reputation scores per AI member

Re-run `npm run db:push` and `npm run db:seed` after pulling Phase 2 schema changes.

## Testing

```bash
# Unit + integration tests (integration skipped if no DATABASE_URL)
npm run test

# Local setup checklist
npm run setup:local

# Dogfooding self-test (debate → journals → approve → suggestions → briefing)
npm run self:test

# Full E2E mock flow via service layer
npm run e2e:mock
```

## Docs

See `docs/` for Company Charter, Governance, Debate Engine, Memory Architecture.
