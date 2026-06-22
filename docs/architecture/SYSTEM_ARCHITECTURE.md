# System Architecture — OceanTechAI Workspace

## Overview

OceanTechAI Workspace là **Next.js monolith** (App Router) với PostgreSQL làm primary store, optional Redis + BullMQ cho background jobs. Kiến trúc module hóa rõ ràng; không microservice ở MVP.

```
┌─────────────────────────────────────────────────────────────┐
│                        Browser (UI)                         │
│  shadcn/ui + TailwindCSS + React Server/Client Components   │
└─────────────────────────┬───────────────────────────────────┘
                          │ API Routes / Server Actions
┌─────────────────────────▼───────────────────────────────────┐
│                     Next.js App Layer                       │
│  app/  ·  components/  ·  lib/  ·  types/                 │
└─────────────────────────┬───────────────────────────────────┘
                          │
┌─────────────────────────▼───────────────────────────────────┐
│                      Server Layer                           │
│  services/  ·  db/  ·  jobs/                               │
│  ai/                                                        │
│    providers/  ·  agents/  ·  orchestrator/                 │
└──────┬──────────────────────────────┬───────────────────────┘
       │                              │
┌──────▼──────┐              ┌────────▼────────┐
│ PostgreSQL  │              │ Redis + BullMQ  │
│  (Prisma)   │              │  (optional)     │
└─────────────┘              └─────────────────┘
       │
┌──────▼──────────────────────────────────────┐
│  /generated  (local filesystem fallback)    │
└─────────────────────────────────────────────┘
```

## Tech Stack

| Layer | Technology |
|-------|------------|
| Framework | Next.js 14+ (App Router) |
| Language | TypeScript |
| Styling | TailwindCSS + shadcn/ui |
| Database | PostgreSQL |
| ORM | Prisma |
| Queue (optional) | Redis + BullMQ |
| AI (MVP) | OpenAI SDK |
| AI (future) | Claude, Gemini via `AIProvider` abstraction |

## Directory Structure

```txt
src/
  app/
    page.tsx                              # Landing / dashboard
    workspaces/page.tsx
    projects/[projectId]/page.tsx
    projects/[projectId]/agents/page.tsx
    projects/[projectId]/discussions/new/page.tsx
    projects/[projectId]/discussions/[discussionId]/page.tsx
    projects/[projectId]/proposals/[proposalId]/page.tsx
    projects/[projectId]/generated/page.tsx
    api/                                  # REST endpoints nếu cần

  components/
    ui/                                   # shadcn primitives
    workspace/
    project/
    agents/
    discussions/
    proposals/
    generated/

  lib/
    utils.ts
    constants.ts

  server/
    ai/
      providers/
        types.ts                          # AIProvider interface
        openai.provider.ts
        mock.provider.ts                  # MVP phase 7
      agents/
        agent-runner.ts                   # Execute single agent turn
        prompts/                          # Default prompt templates
      orchestrator/
        discussion-orchestrator.ts        # Multi-round debate flow
        consensus-engine.ts
      proposal-generator.ts
      markdown-generator.ts

    db/
      prisma.ts                           # Prisma client singleton
      repositories/                       # Optional query layer

    services/
      workspace.service.ts
      project.service.ts
      agent.service.ts
      discussion.service.ts
      proposal.service.ts
      generated-file.service.ts

    jobs/
      discussion.job.ts                   # BullMQ worker (optional)

  types/
    agent-message.ts
    consensus.ts
    proposal.ts

prisma/
  schema.prisma
  seed.ts

generated/                                # Output khi proposal approved
  docs/features/
  docs/architecture/
  docs/api/
  tasks/
```

## Database Models (Prisma)

### Entity Relationship

```
User
 └── Workspace (1:N)
      └── Project (1:N)
           ├── Agent (1:N)
           ├── Discussion (1:N)
           │    ├── DiscussionRound (1:N)
           │    │    └── AgentMessage (1:N)
           │    └── Proposal (0:1)
           │         ├── GeneratedFile (1:N)
           │         └── DecisionLog (0:1, on approve)
```

### Core Models

| Model | Key Fields |
|-------|------------|
| **User** | id, email, name |
| **Workspace** | id, name, ownerId |
| **Project** | id, name, workspaceId, description |
| **Agent** | id, projectId, name, role, expertise, systemPrompt, modelProvider, modelName, memorySummary, toolsAllowed, votingWeight, isActive |
| **Discussion** | id, projectId, userPrompt, status, consensusJson |
| **DiscussionRound** | id, discussionId, roundNumber, roundType (propose/critique/refine/vote) |
| **AgentMessage** | id, roundId, agentId, stance, content, concerns, suggestions, vote |
| **Proposal** | id, discussionId, title, summary, alternativesConsidered, chosenSolution, reasoning, risks, filesToCreate, tasksToCreate, status |
| **GeneratedFile** | id, proposalId, path, content, mimeType |
| **DecisionLog** | id, proposalId, action, decidedBy, decidedAt, notes |

### Proposal Status Flow

```
pending → approved → [generate files + DecisionLog]
        → rejected
        → changes_requested → pending (sau khi re-discuss)
```

## API / Service Layer

UI không gọi AI trực tiếp. Flow:

1. UI → `discussion.service.create()` → enqueue hoặc sync call orchestrator
2. `DiscussionOrchestrator` → loop rounds → `AgentRunner` → `AIProvider.complete()`
3. `ConsensusEngine` → aggregate round 4 votes + round 3 refinements
4. `ProposalGenerator` → tạo Proposal record từ ConsensusResult
5. Founder approve → `MarkdownGenerator` → `GeneratedFile` records + write `/generated`

## Background Jobs (Optional MVP)

Discussion chạy multi-round có thể mất 2–5 phút. Options:

- **Sync (MVP đơn giản):** Server action với streaming progress
- **Async (recommended):** BullMQ job `discussion:run` với status polling trên UI

Redis chỉ cần khi chọn async path.

## Security (MVP)

- Single-user local dev — auth có thể stub (hardcoded User)
- Production-ready: NextAuth hoặc Clerk, workspace-level access control
- `toolsAllowed` trên Agent giới hạn capabilities per agent (future)

## Generated Files Layout

Khi proposal approved, `MarkdownGenerator` tạo:

```
generated/
  docs/features/{feature-slug}.md
  docs/architecture/{feature-slug}.md
  docs/api/{feature-slug}.md
  tasks/{feature-slug}.cursor.md
```

Content cũng lưu trong `GeneratedFile` table để UI list/preview không cần đọc filesystem.
