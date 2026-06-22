# Roadmap — OceanTechAI Workspace

## Current Phase

**Phase 0 — Documentation & Foundation** (đang thực hiện)

Hoàn thiện docs, kiến trúc, ADR. Chuẩn bị scaffold code.

---

## Milestones

| Phase | Timeline | Goals | Status |
|-------|----------|-------|--------|
| **0. Docs & Architecture** | Week 1 | Vision, architecture docs, ADR, agent prompts | 🟡 In Progress |
| **1. Project Scaffold** | Week 1–2 | Next.js + Prisma + Tailwind + shadcn setup | ⬜ Pending |
| **2. Database & Seed** | Week 2 | Prisma schema (10 models), seed script | ⬜ Pending |
| **3. Core UI** | Week 2–3 | Dashboard, workspaces, projects, agents CRUD | ⬜ Pending |
| **4. Discussion Flow (Mock)** | Week 3–4 | Create discussion, mock orchestrator, debate UI | ⬜ Pending |
| **5. OpenAI Integration** | Week 4 | Real AI provider, structured JSON output | ⬜ Pending |
| **6. Proposal & Approval** | Week 5 | Proposal generator, approve/reject UI | ⬜ Pending |
| **7. Markdown Generator** | Week 5–6 | Auto-generate 4 file types on approval | ⬜ Pending |
| **8. Polish & README** | Week 6 | E2E test, README, local run guide | ⬜ Pending |

---

## Phase Details

### Phase 1: Project Scaffold

```
✓ npx create-next-app (App Router, TypeScript, Tailwind)
✓ shadcn/ui init
✓ Prisma init + PostgreSQL connection
✓ Folder structure: src/app, src/server, src/types
✓ ESLint + Prettier baseline
```

**Deliverable:** `npm run dev` chạy được, DB connect OK.

### Phase 2: Database & Seed

```
✓ prisma/schema.prisma — 10 models
✓ prisma/seed.ts — 1 workspace, 1 project, 6 agents
✓ prisma migrate dev
```

**Deliverable:** `npx prisma db seed` tạo data mẫu.

### Phase 3: Core UI

```
✓ / — landing dashboard
✓ /workspaces — list + create
✓ /projects/[projectId] — dashboard
✓ /projects/[projectId]/agents — CRUD
```

**Deliverable:** Quản lý workspace, project, agents trên UI.

### Phase 4: Discussion Flow (Mock)

```
✓ /discussions/new — form
✓ MockDiscussionOrchestrator — deterministic 5-round output
✓ /discussions/[discussionId] — round/message viewer
✓ ConsensusEngine + ProposalGenerator (mock data)
```

**Deliverable:** E2E flow với mock AI, UI hiển thị đầy đủ debate.

### Phase 5: OpenAI Integration

```
✓ AIProvider interface
✓ OpenAIProvider implementation
✓ AgentRunner với JSON mode
✓ Swap mock → openai per agent
```

**Deliverable:** Discussion thật với GPT-4o, structured output validated.

### Phase 6: Proposal & Approval

```
✓ /proposals/[proposalId] — detail view
✓ Approve / Reject / Request Changes buttons
✓ DecisionLog on approve
✓ Status transitions
```

**Deliverable:** Founder duyệt proposal, audit log ghi nhận.

### Phase 7: Markdown Generator

```
✓ MarkdownGenerator service
✓ Write to /generated + GeneratedFile table
✓ /generated — list + preview UI
```

**Deliverable:** 4 files auto-created khi approve.

### Phase 8: Polish & README

```
✓ E2E manual test checklist
✓ README.md — setup, env vars, run instructions
✓ Error states trên UI
✓ Loading states cho long-running discussions
```

**Deliverable:** Người mới clone repo chạy được trong < 15 phút.

---

## Implementation Checklist

### Foundation
- [ ] Init Next.js project với TypeScript + Tailwind
- [ ] Setup shadcn/ui (Button, Card, Dialog, Table, Badge, Tabs)
- [ ] Setup Prisma + PostgreSQL
- [ ] Tạo `src/server/db/prisma.ts` singleton
- [ ] Tạo folder structure theo architecture doc

### Database
- [ ] User model
- [ ] Workspace model
- [ ] Project model
- [ ] Agent model (full fields)
- [ ] Discussion + DiscussionRound + AgentMessage
- [ ] Proposal + GeneratedFile + DecisionLog
- [ ] Seed script (workspace, project, 6 agents)
- [ ] `npx prisma migrate dev`

### Services
- [ ] workspace.service.ts
- [ ] project.service.ts
- [ ] agent.service.ts
- [ ] discussion.service.ts
- [ ] proposal.service.ts
- [ ] generated-file.service.ts

### AI Layer
- [ ] `AIProvider` interface + types
- [ ] `MockProvider`
- [ ] `OpenAIProvider`
- [ ] `AgentRunner`
- [ ] `DiscussionOrchestrator`
- [ ] `ConsensusEngine`
- [ ] `ProposalGenerator`
- [ ] `MarkdownGenerator`

### UI Pages
- [ ] `/` landing
- [ ] `/workspaces`
- [ ] `/projects/[projectId]`
- [ ] `/projects/[projectId]/agents`
- [ ] `/projects/[projectId]/discussions/new`
- [ ] `/projects/[projectId]/discussions/[discussionId]`
- [ ] `/projects/[projectId]/proposals/[proposalId]`
- [ ] `/projects/[projectId]/generated`

### Quality
- [ ] Zod validation cho AgentMessage JSON
- [ ] Error boundaries trên discussion page
- [ ] README với hướng dẫn local setup

---

## Future Work (Post-MVP)

### v0.2 — Integrations
- GitHub API: auto-create issues từ `tasksToCreate`
- GitHub API: auto-create PR với generated docs
- Webhook notifications (Slack/Discord) khi proposal pending

### v0.3 — Multi-Provider
- Claude (Anthropic) provider
- Gemini (Google) provider
- Per-agent provider selection trên UI

### v0.4 — Agent Memory
- Auto-update `memorySummary` sau mỗi discussion
- Cross-discussion context injection

### v0.5 — Async & Scale
- Redis + BullMQ cho long discussions
- WebSocket progress streaming
- Discussion resume sau failure

### v1.0 — Production
- NextAuth authentication
- Multi-user workspace với roles
- Usage metering và billing
- Agent template marketplace
