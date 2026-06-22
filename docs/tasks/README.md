# Tasks

Thư mục lưu trữ **implementation task files** — đặc biệt `.cursor.md` files cho Cursor agent execution.

## Mục đích

- Chứa task breakdowns được generate sau proposal approval
- Cursor-ready instructions cho implementation
- Manual task additions bởi Founder

## Convention

```
tasks/
  {feature-slug}.cursor.md    # Auto-generated on approval
  {feature-slug}-manual.md      # Founder-added tasks
```

## Auto-Generated Format

Khi proposal approved, `MarkdownGenerator` tạo:

```markdown
# Task: {feature-name}

## Context
[From proposal summary and chosen solution]

## Implementation Tasks
- [ ] Task 1 (from QA test cases + Architect design)
- [ ] Task 2
...

## Acceptance Criteria
[From PM acceptance criteria]

## Files to Create/Modify
[From proposal filesToCreate]
```

## Lưu ý

Generated task files cũng được lưu trong `GeneratedFile` table và `/generated/tasks/`. Thư mục này mirror cho version control.
