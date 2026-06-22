# MVP Scope — OceanTechAI Workspace

## In Scope

### 1. Workspace & Project

- [x] Tạo workspace (name, owner)
- [x] Tạo project trong workspace (name, description)
- [x] List workspaces và projects trên UI

### 2. AI Members (Agents)

Mỗi agent configurable với đầy đủ fields:

| Field | Type | Mô tả |
|-------|------|-------|
| name | string | Tên hiển thị |
| role | enum | Vai trò (9 roles) |
| expertise | string[] | Lĩnh vực chuyên môn |
| systemPrompt | text | Prompt định nghĩa behavior |
| modelProvider | string | openai / mock |
| modelName | string | gpt-4o, gpt-4o-mini... |
| memorySummary | text? | Context tích lũy |
| toolsAllowed | string[] | Tools được phép (future) |
| votingWeight | float | Trọng số vote (default 1.0) |
| isActive | boolean | Tham gia discussion hay không |

**UI:** list, create, edit, activate/deactivate agents tại `/projects/[projectId]/agents`

**Default roles seeded:**

- Product Manager
- System Architect
- Backend Engineer
- Frontend Engineer
- QA Engineer
- Game Designer
- Economy Designer
- DevOps Engineer
- Red Team Critic

### 3. Discussion Room

- [x] Form tạo discussion với user prompt
- [x] Orchestrator chạy 5 phase:
  1. **Round 1 — Propose:** mỗi AI đề xuất độc lập
  2. **Round 2 — Critique:** phản biện lẫn nhau
  3. **Round 3 — Refine:** tinh chỉnh phương án
  4. **Round 4 — Vote:** yes / no / abstain (weighted)
  5. **Consensus:** tổng hợp kết quả
- [x] Lưu structured JSON per agent message
- [x] UI hiển thị từng round, từng message, vote summary, consensus

**Ví dụ input:** *"Tôi muốn thêm hệ thống Crew cho game MMO."*

### 4. Proposal System

Proposal fields:

| Field | Mô tả |
|-------|-------|
| title | Tên feature/change |
| summary | Tóm tắt 2-3 đoạn |
| alternativesConsidered | Các phương án đã xem xét |
| chosenSolution | Phương án được chọn |
| reasoning | Lý do chọn |
| risks | Rủi ro đã identify |
| filesToCreate | Danh sách file sẽ generate |
| tasksToCreate | Danh sách task |
| status | pending / approved / rejected / changes_requested |

**Founder actions:**

- ✅ Approve
- ❌ Reject
- 🔄 Request Changes

### 5. Markdown Generator

Khi `status = approved`:

```
generated/docs/features/{feature-slug}.md
generated/docs/architecture/{feature-slug}.md
generated/docs/api/{feature-slug}.md
generated/tasks/{feature-slug}.cursor.md
```

- Lưu content trong `GeneratedFile` table
- Write files vào local `/generated` directory
- UI list + preview tại `/projects/[projectId]/generated`

### 6. Decision Log

- Mỗi approval tạo `DecisionLog` record (who, when, action, notes)

### 7. UI Pages

| Route | Chức năng |
|-------|-----------|
| `/` | Landing / dashboard |
| `/workspaces` | Danh sách workspace |
| `/projects/[projectId]` | Project dashboard: agents, discussions, proposals |
| `/projects/[projectId]/agents` | CRUD agents |
| `/projects/[projectId]/discussions/new` | Tạo discussion |
| `/projects/[projectId]/discussions/[discussionId]` | Xem debate |
| `/projects/[projectId]/proposals/[proposalId]` | Xem + approve/reject proposal |
| `/projects/[projectId]/generated` | Generated files |

### 8. Tech Foundation

- Next.js App Router + TypeScript + Tailwind + shadcn/ui
- PostgreSQL + Prisma schema (10 models)
- Seed script: 1 workspace, 1 project, 6 default agents
- `AIProvider` abstraction + Mock provider + OpenAI provider
- Module structure: `server/ai/`, `server/services/`, `server/db/`

## Out of Scope (MVP)

| Item | Lý do |
|------|-------|
| GitHub API integration | Chỉ lưu local/DB; GitHub là phase 2 |
| Real authentication | Stub user cho local dev |
| Multi-user collaboration | Single founder per workspace |
| Redis/BullMQ (có thể defer) | Sync orchestrator đủ cho MVP demo |
| Claude/Gemini providers | Interface sẵn, implementation post-MVP |
| Agent function calling / tools | `toolsAllowed` field only, no execution |
| Real-time WebSocket updates | Polling hoặc page refresh |
| Billing / usage metering | Không cần cho local MVP |
| Mobile responsive polish | Desktop-first |

## Acceptance Criteria

### AC-1: End-to-End Flow
Founder có thể: tạo discussion → xem 5 rounds → xem proposal pending → approve → thấy 4 generated files.

### AC-2: Structured Data
Mọi `AgentMessage` có valid JSON với `stance`, `content`, `concerns[]`, `suggestions[]`.

### AC-3: Role Fidelity
Product Manager messages đề cập user value/scope; Red Team messages chứa concerns/abuse cases.

### AC-4: Human Gate
Generated files chỉ xuất hiện sau `proposal.status = approved`. Reject không tạo files.

### AC-5: Audit Trail
Approved proposal có corresponding `DecisionLog` entry.

### AC-6: Provider Swap
Đổi `modelProvider` từ `mock` sang `openai` không cần sửa orchestrator code.

## Dependencies

- Node.js 18+
- PostgreSQL 14+ (local hoặc Docker)
- OpenAI API key (phase 8)
- pnpm hoặc npm

## Implementation Phases

Xem [ROADMAP.md](./ROADMAP.md) cho timeline chi tiết.
