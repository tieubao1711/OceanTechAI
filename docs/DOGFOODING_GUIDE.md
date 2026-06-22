# OceanTechAI Dogfooding Guide

Use OceanTechAI as your **personal AI operating system** — not just a demo app.

---

## What OceanTechAI Does Today

| Capability | Description |
|------------|-------------|
| **AI Debate** | 5-round multi-agent debate → consensus → proposal |
| **Human Approval** | Founder must approve before files generate or GitHub executes |
| **Generated Files** | Markdown docs (features, architecture, API, tasks) |
| **GitHub Execution** | Branch → commits → PR → issues (manual, optional) |
| **Agent Journals** | Lessons, observations, warnings after each debate |
| **Decision Learning** | Memory + journals when proposals are approved/rejected |
| **Recommendations** | Prioritized next actions from project signals |
| **Executive Briefing** | Morning brief — open proposals, risks, top agents |
| **Autonomous Suggestions** | System drafts improvements (not proposals) — Founder decides |
| **Timeline** | Organizational history |
| **Agent Reputation** | Participation, acceptance, quality scores |
| **Codebase Awareness** | Project Knowledge Snapshot injected into agent prompts (no RAG) |
| **Architecture Audit** | Discussion mode with evidence-based findings + quality gate |

**Pipeline:**
```
Discussion → Debate → Proposal → Founder Approve → Generated Files → (optional) GitHub
                ↓
         Journals + Timeline + Reputation
                ↓
         Executive Dashboard + Suggestions
```

---

## Local Setup (from scratch)

### Prerequisites

- Node.js 18+
- PostgreSQL 14+ (database `oceantechai` created)

### Commands

```bash
git clone <repo>
cd oceantechai-workspace
npm install
cp .env.example .env
# Edit DATABASE_URL in .env

npm run setup:local   # checklist — DB, AI mode, GitHub warnings
npm run db:push
npm run db:seed
npm run self:test     # end-to-end validation
npm run dev
```

### Seed projects

| Workspace | Project | ID | Purpose |
|-----------|---------|-----|---------|
| OceanTechAI Demo | MMO Game Project | `seed-project` | Original demo flow |
| OceanTechAI Self-Test | **OceanTechAI Core** | `oceantechai-core` | **Dogfood here** |

**Primary URL after setup:**
```
http://localhost:3001/projects/oceantechai-core/executive
```

---

## Mock Mode (default)

```env
AI_PROVIDER_MODE=mock
```

- No API key needed
- Deterministic agent responses
- Full pipeline works: debate → proposal → approve → journals → suggestions

```bash
npm run self:test   # uses mock
npm run e2e:mock    # crew-system demo on seed-project
```

---

## OpenAI Mode (optional)

```env
AI_PROVIDER_MODE=openai
OPENAI_API_KEY=sk-...
OPENAI_DEFAULT_MODEL=gpt-4.1
```

- Real LLM responses in debates
- Falls back to mock if key missing or API errors
- Quality gates still apply (agent ≥60, consensus ≥70)

---

## GitHub Execution (optional)

```env
GITHUB_TOKEN=ghp_...
GITHUB_OWNER=your-org
GITHUB_REPO=your-repo
GITHUB_DEFAULT_BRANCH=main
```

1. Approve a proposal (generates files)
2. Open proposal detail → **Execute to GitHub**
3. Check Execution Logs, PR URL, issue links

App runs fine without GitHub env — execution logs a clear failure message.

---

## First 30 Minutes

| Step | Action |
|------|--------|
| 1 | `npm run setup:local` → fix any ✗ items |
| 2 | `npm run db:push && npm run db:seed` |
| 3 | `npm run self:test` → confirm ✅ PASSED |
| 4 | `npm run dev` → open Executive Dashboard |
| 5 | Review Morning Brief, ADRs, Timeline milestones |
| 6 | Open a suggestion → **Create Discussion** (or use prompts in `docs/prompts/SELF_MANAGEMENT_PROMPTS.md`) |
| 7 | Run debate → View proposal → **Approve** |
| 8 | (Optional) **Execute to GitHub** |

---

## Every Morning Flow

1. Open `/projects/oceantechai-core/executive`
2. Read **Morning Brief** — open proposals, risks, recommendations
3. **Run Autonomous Review** if no fresh suggestions
4. Pick top recommendation or suggestion → **Create Discussion**
5. Run debate → review journals on proposal page
6. Approve or reject — system learns via decision memory
7. Glance at **Timeline** for what changed yesterday

**Goal:** Never ask "what should I do today?" — OceanTechAI tells you.

---

## Signs the System Is Healthy

| Signal | Where to check |
|--------|----------------|
| Debates complete with 5 rounds | Discussion page → status COMPLETED |
| Journals after debate | Executive → Recent Lessons |
| Timeline grows | `/projects/.../timeline` |
| Reputation updates | Agents page — proposalCount, score |
| Recommendations appear | Executive → Recommended Actions |
| Suggestions after review | Executive → Autonomous Suggestions |
| `npm run self:test` passes | Terminal ✅ |
| Approve blocks pre-approval files | E2E / self-test assertions |

---

## Architecture Audit (Phase 2.5)

Agents receive a **Project Knowledge Snapshot** built from `docs/`, `README`, `package.json`, Prisma schema, and `src/server/` — no RAG/embeddings.

**UI:** New Discussion → Mode: **Architecture Audit**

**CLI:**
```bash
npm run audit:oceantechai   # mock by default; set AI_PROVIDER_MODE=openai for real AI
```

Audit mode requires evidence-based findings (`title`, `evidence`, `impact`, `priority`). Generic suggestions like "need testing" are penalized when the snapshot already lists 20+ tests.

---

## Prompt Library

See [`docs/prompts/SELF_MANAGEMENT_PROMPTS.md`](./prompts/SELF_MANAGEMENT_PROMPTS.md) for ready-to-use discussion prompts.

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| `db:push` fails | Create PostgreSQL database first; check DATABASE_URL |
| `No user found` | Run `npm run db:seed` |
| Empty Executive Dashboard | Run `npm run self:test` or create first discussion |
| Prisma column errors | Run `npm run db:push` after pulling new schema |
| `self:test` fails on suggestions | Ensure Phase 2 schema is pushed; re-run seed |

---

## What NOT to Do (yet)

- No SaaS / billing / multi-user
- No auto-execute on approve or suggestion
- No new AI providers (Claude/Gemini)
- Dogfood first — external teams later
