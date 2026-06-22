# Discussions

Thư mục lưu trữ **discussion transcripts** và notes từ các phiên debate AI.

## Mục đích

- Archive discussion summaries export từ UI
- Lưu manual notes của Founder trong quá trình review debate
- Reference material cho discussions liên quan (re-discuss sau `changes_requested`)

## Convention

```
discussions/
  {YYYY-MM-DD}-{feature-slug}/
    summary.md          # Tóm tắt consensus
    round-1-propose.md  # Optional export per round
    notes.md            # Founder notes
```

## Lưu ý

Discussion data chính thức nằm trong **database** (`Discussion`, `DiscussionRound`, `AgentMessage`). Thư mục này là human-readable archive, không phải source of truth.
