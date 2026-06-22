# Proposals

Thư mục lưu trữ **proposal documents** export và draft amendments.

## Mục đích

- Archive approved/rejected proposals dưới dạng Markdown
- Lưu Founder feedback khi `changes_requested`
- Reference cho re-discussion iterations

## Convention

```
proposals/
  {feature-slug}/
    proposal-v1.md      # Initial proposal
    proposal-v2.md      # After changes_requested
    founder-notes.md    # Approval/rejection rationale
```

## Proposal Status Lifecycle

```
pending → approved   (→ triggers MarkdownGenerator)
        → rejected
        → changes_requested → (re-discuss) → new proposal version
```

## Lưu ý

Proposal records chính thức nằm trong **database** (`Proposal`, `DecisionLog`). Thư mục này là export/archive layer.
