# Product Principles — OceanTechAI Workspace

> Constitutional foundation: [COMPANY_CHARTER.md](../company/COMPANY_CHARTER.md) · Operational rules: [GOVERNANCE.md](../company/GOVERNANCE.md)

## Core Principles

### 1. Debate Before Decision

Không có quyết định đơn phương từ một AI. Mọi feature/change đều phải qua multi-round debate với ít nhất 3 agent active. Sự đa dạng góc nhìn là feature, không phải noise.

### 2. Human Approval Is Mandatory

AI consensus chỉ là **đề xuất**, không phải **lệnh thực thi**. Founder luôn có quyền Approve, Reject, hoặc Request Changes. Không generated file nào được coi là final trước khi proposal status = `approved`.

### 3. Agents Are Data, Not Services

Mỗi AI member là một record trong database (`Agent` model) với `systemPrompt`, `modelProvider`, `votingWeight`, `toolsAllowed`... Không deploy agent như microservice riêng. Thêm role mới = thêm seed data + system prompt, không cần deploy code mới.

### 4. Structured Output Over Free-form Chat

Mọi agent message phải tuân theo schema JSON:

- `stance`: support | oppose | neutral | refine
- `concerns[]`, `suggestions[]`
- `vote` (round 4)

UI và downstream generators (Proposal, Markdown) consume structured data — không parse free text.

### 5. Markdown Is Source of Truth

Generated artifacts (`docs/features/`, `docs/architecture/`, `docs/api/`, `tasks/`) là deliverable chính thức. Database lưu metadata; file content là canonical output hướng tới GitHub và Cursor.

### 6. End-to-End Over Perfection

MVP ưu tiên flow chạy được từ đầu đến cuối hơn là hoàn hảo từng module. Mock orchestrator trước, OpenAI thật sau. UI functional trước, polish sau.

### 7. Provider Abstraction From Day One

`AIProvider` interface tách biệt khỏi business logic. OpenAI là implementation đầu tiên; thêm Claude/Gemini = thêm provider class, không refactor orchestrator.

### 8. No Logic in UI

Components render state. Business logic nằm trong `server/services/` và `server/ai/`. UI gọi API routes hoặc server actions — không hard-code debate rounds hay proposal logic trong React components.

## Design Tenets

| Tenet | Thực hành |
|-------|-----------|
| **Clarity over cleverness** | Round names, statuses, file paths đều explicit và predictable |
| **Auditability** | Mọi approval tạo `DecisionLog` — ai approve, khi nào, proposal gì |
| **Configurable defaults** | 9 default agent roles seeded sẵn; Founder có thể customize |
| **Progressive disclosure** | Dashboard đơn giản; chi tiết debate/proposal ở trang riêng |
| **Fail gracefully** | Agent timeout/error không crash cả discussion — log và retry round |

## Trade-off Framework

Khi agent conflict hoặc vote split, ưu tiên theo thứ tự:

1. **Safety & abuse** (Red Team, QA) — veto weight cao hơn trên risk-critical items
2. **User value** (Product Manager) — scope và priority
3. **Technical feasibility** (Architect, Engineers) — scalability, maintainability
4. **Economic balance** (Economy Designer) — chỉ khi feature liên quan game economy / monetization

`votingWeight` trên mỗi agent cho phép Founder điều chỉnh ưu tiên này per project.

## Anti-Patterns (Tránh)

- ❌ Chat UI không có round structure
- ❌ Auto-execute khi chưa approve
- ❌ Hard-code agent prompts trong source code (phải trong DB)
- ❌ Gọi OpenAI trực tiếp từ React component
- ❌ Lưu generated content chỉ trong memory, không persist
- ❌ Over-engineer queue/microservice khi chưa cần scale
