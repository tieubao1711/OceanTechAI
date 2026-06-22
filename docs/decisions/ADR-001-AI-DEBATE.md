# ADR-001: Multi-Round AI Debate

## Status

**Accepted**

## Date

2026-06-11

## Context

OceanTechAI Workspace cần cơ chế cho nhiều AI agents cùng phân tích một vấn đề và đi đến quyết định chất lượng cao. Có ba hướng tiếp cận chính:

1. **Single-agent response** — một LLM call trả lời user prompt
2. **Parallel multi-agent** — nhiều agent trả lời độc lập, hiển thị tất cả cho user chọn
3. **Sequential multi-round debate** — agents propose → critique → refine → vote → consensus

Vấn đề với single-agent: thiếu diverse perspectives, dễ có blind spots. Vấn đề với parallel-only: không có cross-pollination, user phải tự synthesize.

Product vision yêu cầu pipeline: `User Input → AI Debate → AI Consensus → Human Approval → Automated Execution`. Debate phải có cấu trúc, không phải free-form chat.

## Decision

Adopt **4-round sequential debate + consensus** orchestrated by `DiscussionOrchestrator`:

| Round | Type | Mục đích |
|-------|------|----------|
| 1 | `propose` | Mỗi active agent đưa đề xuất độc lập theo vai trò |
| 2 | `critique` | Agents xem proposals của nhau, phản biện |
| 3 | `refine` | Agents tinh chỉnh phương án dựa trên critique |
| 4 | `vote` | Weighted vote: yes / no / abstain |
| — | `consensus` | `ConsensusEngine` tổng hợp kết quả |

Mỗi agent message phải là **structured JSON** (`AgentMessage` schema) — không free-form text. UI và downstream generators consume JSON trực tiếp.

Debate chạy synchronously trong MVP (server action hoặc API route). Async queue (BullMQ) là optional enhancement.

## Consequences

### Positive

- **Higher quality decisions** — cross-agent critique surfaces blind spots (đặc biệt từ Red Team và QA)
- **Structured audit trail** — mọi round lưu DB, có thể replay và analyze
- **Role fidelity** — mỗi round agent nhận context từ rounds trước, reinforcing expertise
- **Automatable consensus** — `ConsensusEngine` có deterministic input (JSON), không cần parse NLP
- **Weighted voting** — Red Team `votingWeight: 1.5` cho risk-critical decisions

### Negative

- **Latency** — 4 rounds × N agents = nhiều LLM calls (6 agents = ~24 calls). MVP discussion mất 2–5 phút
- **Cost** — token usage cao hơn single-agent (~10–20x)
- **Complexity** — orchestrator, round management, JSON validation thêm code
- **Failure modes** — một agent fail JSON parse có thể delay cả round

### Mitigations

- Mock provider cho development (Phase 7) — zero cost, instant
- Retry 1x on JSON parse failure với stricter format prompt
- Continue round nếu 1 agent fail — log error, không block others
- Future: parallel agent calls within same round (Promise.all)

## Alternatives Considered

### Alt 1: Single Agent with Role Switching

Một LLM call với prompt "think as PM, then Architect, then QA..."

**Rejected:** Không có genuine debate — cùng model, cùng context, không có real conflict. Red Team critique yếu vì không có proposal thật từ agent khác để attack.

### Alt 2: Parallel Agents + User Synthesis

Tất cả agents respond parallel, user tự chọn/combine.

**Rejected:** Vi phạm product vision (user không nên synthesize). Không scalable khi 9 agents × verbose responses.

### Alt 3: Free-form Chat Room

Agents chat tự do trong thread, không có round structure.

**Rejected:** Không structured output → không thể auto-generate proposals. Khó audit. Dễ degenerate thành chatbot theater.

### Alt 4: 2-Round Only (Propose + Vote)

Bỏ critique và refine rounds.

**Rejected:** QA và Red Team findings từ Round 2 critical cho quality. Refine round là nơi consensus thực sự hình thành.

## References

- [AGENT_ARCHITECTURE.md](../architecture/AGENT_ARCHITECTURE.md) — orchestrator design
- [MVP_SCOPE.md](../product/MVP_SCOPE.md) — discussion room requirements
- `AgentMessage` type definition in `src/types/agent-message.ts`
