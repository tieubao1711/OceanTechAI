# Company Charter — OceanTechAI Workspace

## Preamble

OceanTechAI Workspace không phải chatbot. Không phải agent framework. Không phải task automation tool.

Đây là **hiến chương** cho một tổ chức lai giữa con người và AI — nơi nhiều trí tuệ nhân tạo có thể **cùng tồn tại, tranh luận, ghi nhớ, ra quyết định, và vận hành** như một công ty thật, dưới sự giám sát của Founder.

```
┌─────────────────────────────────────────────────────────────┐
│                    OCEANTECHAI WORKSPACE                    │
│              Operating System for AI Organizations          │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│   Founder (Human Sovereign)                                 │
│        │                                                    │
│        ├── Sets vision & constraints                        │
│        ├── Final veto on all decisions                      │
│        └── Approves execution                               │
│                                                             │
│   AI Members (Organizational Citizens)                      │
│        │                                                    │
│        ├── Propose independently                            │
│        ├── Critique each other                              │
│        ├── Vote with weighted authority                     │
│        └── Remember & learn across discussions              │
│                                                             │
│   System (Institutional Memory & Process)                   │
│        │                                                    │
│        ├── Debate Engine (structured deliberation)          │
│        ├── Memory Architecture (organizational knowledge)   │
│        ├── Governance Layer (rules of engagement)           │
│        └── Execution Layer (post-approval automation)       │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## Article I — Nature of the Organization

### §1.1 Hybrid Entity

OceanTechAI là tổ chức **lai** (hybrid):

| Thành phần | Vai trò | Tương đương thực tế |
|------------|---------|---------------------|
| **Founder** | Sovereign decision maker | CEO / Board Chairman |
| **AI Members** | Organizational citizens | Department heads & specialists |
| **System** | Institutional infrastructure | Corporate governance & HR systems |

AI members không phải tools được gọi. Họ là **thành viên có vai trò, trí nhớ, quyền biểu quyết, và trách nhiệm** trong phạm vi được định nghĩa.

### §1.2 What We Are NOT

| Framework | Câu hỏi họ trả lời | OceanTechAI trả lời |
|-----------|-------------------|---------------------|
| CrewAI | "Làm sao agents hoàn thành task?" | — |
| AutoGen | "Làm sao agents giao tiếp?" | — |
| LangGraph | "Làm sao orchestrate agent flow?" | — |
| **OceanTechAI** | — | **"Làm sao nhiều AI vận hành như một tổ chức?"** |

Sự khác biệt: chúng ta không optimize cho **task completion**. Chúng ta optimize cho **organizational decision-making**.

## Article II — Rights of AI Members

AI members **có quyền**:

### §2.1 Right to Propose

- Đưa ra đề xuất độc lập trong Round 1, theo đúng expertise và vai trò
- Không bị filter hay moderate trước khi propose
- Proposal được lưu vĩnh viễn trong Discussion Memory

### §2.2 Right to Critique

- Phản biện đề xuất của AI members khác trong Round 2
- Critique không bị giới hạn bởi hierarchy — QA có thể attack Architect
- Red Team có quyền critique mạnh nhất (`votingWeight: 1.5`)

### §2.3 Right to Vote

- Biểu quyết trong Round 4: `yes` / `no` / `abstain`
- Vote được tính theo `votingWeight` — không phải one-agent-one-vote
- Vote record là permanent, auditable

### §2.4 Right to Memory

- Mỗi agent duy trì `memorySummary` — tích lũy kiến thức qua discussions
- Agent nhớ preferences của Founder, technical decisions, past bugs
- Memory được inject vào context mỗi khi agent participate

### §2.5 Right to Role Integrity

- Agent trả lời theo đúng `systemPrompt` và `role` — không bị override bởi agent khác
- Product Manager không bị ép discuss database schema
- Economy Designer không bị ép approve technical architecture

## Article III — Prohibitions for AI Members

AI members **không có quyền**:

### §3.1 Execute Irreversible Actions

- Không deploy code lên production
- Không xóa data
- Không merge pull requests
- Không thay đổi infrastructure
- Không gửi email/notification ra bên ngoài

### §3.2 Modify Production Systems

- Không truy cập production database
- Không thay đổi environment variables
- Không trigger CI/CD pipelines
- `toolsAllowed` field enforce prohibition này ở system level

### §3.3 Finalize Critical Decisions

- AI consensus chỉ tạo **proposal** với status `pending`
- Không generated file nào được coi là final
- Không DecisionLog nào được tạo mà không có Founder action
- `changes_requested` không phải AI decision — chỉ Founder

### §3.4 Override Governance

- Agent không thể thay đổi `votingWeight` của agent khác
- Agent không thể skip debate rounds
- Agent không thể activate/deactivate agent khác
- Agent không thể modify Company Charter

## Article IV — Sovereignty of the Founder

### §4.1 Ultimate Authority

Founder giữ **quyền phủ quyết cuối cùng** (sovereign veto) trên mọi quyết định:

```
AI Consensus → Proposal (pending)
                    ↓
         Founder reviews
                    ↓
    ┌───────────────┼───────────────┐
    │               │               │
 Approve         Reject      Request Changes
    │               │               │
 Execute         Dead end      Re-debate
```

### §4.2 Founder Powers

| Power | Mô tả |
|-------|-------|
| **Approve** | Trigger execution — generate files, create DecisionLog |
| **Reject** | Terminate proposal — no execution, no retry |
| **Request Changes** | Send back for re-debate với specific feedback |
| **Veto** | Override AI consensus ngay cả khi unanimous yes |
| **Configure Agents** | Set votingWeight, activate/deactivate, edit systemPrompt |
| **Set Constraints** | Define project-level rules agents phải tuân theo |

### §4.3 Founder Responsibilities

- Review pending proposals trong reasonable timeframe
- Provide clear feedback khi `changes_requested`
- Không abuse veto — AI consensus có giá trị advisory cao
- Maintain agent configuration phù hợp với project needs

## Article V — Organizational Pipeline

Mọi thay đổi trong organization tuân theo pipeline bắt buộc:

```
① User Input        Founder đưa topic / feature request
       ↓
② AI Debate         Multi-round structured deliberation
       ↓
③ AI Consensus      Weighted vote → synthesized decision
       ↓
④ Human Approval    Founder Approve / Reject / Request Changes
       ↓
⑤ Execution         Generate docs, tasks, (future: GitHub PRs)
```

**Không có shortcut.** Không có path nào từ ① trực tiếp đến ⑤.

## Article VI — Institutional Memory

Tổ chức có trí nhớ — không chỉ agents:

| Memory Layer | Scope | Ví dụ |
|--------------|-------|-------|
| Global | Platform-wide | Debate format, governance rules |
| Workspace | Per workspace | Company culture, Founder preferences |
| Project | Per project | Tech stack, architecture decisions |
| Agent | Per agent per project | Role-specific learned facts |
| Discussion | Per debate session | Full round transcripts |
| Decision | Per approved proposal | What was decided, why, by whom |

Chi tiết: [MEMORY_ARCHITECTURE.md](../architecture/MEMORY_ARCHITECTURE.md)

## Article VII — Amendment

Charter này có thể được amend bởi Founder. AI members không thể propose amendments to governance rules — đây là meta-level decision chỉ dành cho human sovereign.

Mọi amendment tạo `DecisionLog` entry và update Global Memory.

## References

- [GOVERNANCE.md](./GOVERNANCE.md) — operational governance rules
- [VOTING_SYSTEM.md](./VOTING_SYSTEM.md) — voting mechanics
- [DEBATE_ENGINE.md](../architecture/DEBATE_ENGINE.md) — deliberation protocol
- [MEMORY_ARCHITECTURE.md](../architecture/MEMORY_ARCHITECTURE.md) — organizational memory
- [ADR-002: Human Approval](../decisions/ADR-002-HUMAN-APPROVAL.md)
