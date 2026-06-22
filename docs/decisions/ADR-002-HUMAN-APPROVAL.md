# ADR-002: Mandatory Human Approval Before Execution

## Status

**Accepted**

## Date

2026-06-11

## Context

Sau AI debate và consensus, hệ thống có thể:

1. **Auto-execute** — tự động tạo files, issues, PRs ngay khi consensus đạt
2. **Auto-execute with notification** — tạo files, notify Founder sau
3. **Human approval gate** — tạo proposal, chờ Founder Approve/Reject/Request Changes

OceanTechAI Workspace sinh ra artifacts có impact thực (Markdown docs, task files, future GitHub PRs). AI consensus có thể sai — đặc biệt khi vote split, Red Team concerns chưa fully mitigated, hoặc scope creep từ PM.

Product principle #2: *"Human Approval Is Mandatory"*. Founder là decision maker cuối cùng.

## Decision

Implement **Proposal System** với mandatory human approval gate:

```
Discussion → Consensus → Proposal (status: pending)
                              ↓
              Founder reviews proposal detail page
                              ↓
         ┌────────────┬──────────────┬─────────────┐
         │  Approve   │   Reject     │  Request    │
         │            │              │  Changes    │
         └─────┬──────┴──────┬───────┴──────┬──────┘
               ↓             ↓              ↓
    Generate files    No action      Re-discuss
    + DecisionLog     Proposal        (new discussion
    status:approved   status:rejected  or amend)
```

### Proposal Fields

Proposal là first-class entity, không phải derived view:

- `title`, `summary`, `alternativesConsidered`, `chosenSolution`, `reasoning`, `risks`
- `filesToCreate`, `tasksToCreate` — preview cho Founder trước khi approve
- `status`: `pending` | `approved` | `rejected` | `changes_requested`

### Founder Actions

| Action | Effect |
|--------|--------|
| **Approve** | Trigger `MarkdownGenerator`, create `GeneratedFile` records, write `/generated`, create `DecisionLog` |
| **Reject** | Set status `rejected`, no files generated, optional rejection notes |
| **Request Changes** | Set status `changes_requested`, Founder ghi feedback, có thể spawn discussion mới |

### Hard Rules

1. **No generated files without `approved` status** — enforced ở service layer, không chỉ UI
2. **Every approval creates `DecisionLog`** — audit trail: who, when, what, notes
3. **Generated files are not final until approved** — preview có thể show draft, nhưng `/generated` page chỉ list approved outputs
4. **Reject is terminal** — không auto-retry; Founder phải tạo discussion mới nếu muốn revisit

## Consequences

### Positive

- **Founder control** — không có surprise auto-execution
- **Audit trail** — `DecisionLog` cho compliance và retrospectives
- **Preview before commit** — Founder thấy `filesToCreate` và `tasksToCreate` trước khi approve
- **Iterative refinement** — `changes_requested` cho phép feedback loop mà không reject hoàn toàn
- **Trust building** — users tin tưởng hệ thống hơn khi biết họ có veto power

### Negative

- **Friction** — thêm bước manual, không fully autonomous
- **Bottleneck** — nếu Founder không review, proposals pile up
- **UI complexity** — cần proposal detail page với approve/reject/change actions

### Mitigations

- Proposal page hiển thị đầy đủ context (summary, risks, alternatives) để review nhanh
- Badge/notification trên project dashboard khi có pending proposals
- Future: delegate approval to team leads (post-MVP multi-user)

## Alternatives Considered

### Alt 1: Auto-Execute on Consensus

Consensus đạt → immediately generate files.

**Rejected:** Vi phạm product vision. AI có thể consensus sai (vote split 3-3, Red Team veto ignored). Không có audit trail.

### Alt 2: Auto-Execute with Undo Window

Generate files immediately, Founder có 24h để undo.

**Rejected:** Generated files có thể đã được commit/pushed trước khi undo. Worse than approval gate.

### Alt 3: Approval Only for High-Risk

Auto-execute low-risk, require approval cho high-risk (Red Team flagged).

**Rejected:** Khó classify risk automatically ở MVP. Simpler to require approval for all — consistent UX.

### Alt 4: Notification-Only (Opt-out)

Auto-execute, notify Founder, họ có thể revert.

**Rejected:** Opt-out approval = no approval. Founder phải actively monitor thay vì consciously approve.

## Implementation Notes

```ts
// server/services/proposal.service.ts
async approve(proposalId: string, userId: string, notes?: string) {
  const proposal = await prisma.proposal.update({
    where: { id: proposalId },
    data: { status: 'approved' }
  })

  await prisma.decisionLog.create({
    data: {
      proposalId,
      action: 'approved',
      decidedBy: userId,
      decidedAt: new Date(),
      notes
    }
  })

  // ONLY called after approval
  await markdownGenerator.generate(proposal)
}
```

Service layer guard — `MarkdownGenerator.generate()` throws nếu `proposal.status !== 'approved'`.

## References

- [PRODUCT_PRINCIPLES.md](../vision/PRODUCT_PRINCIPLES.md) — Principle #2
- [PROJECT_VISION.md](../vision/PROJECT_VISION.md) — pipeline diagram
- [MVP_SCOPE.md](../product/MVP_SCOPE.md) — proposal system requirements
- [SYSTEM_ARCHITECTURE.md](../architecture/SYSTEM_ARCHITECTURE.md) — Proposal status flow
