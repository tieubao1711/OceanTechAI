# Project Vision — OceanTechAI Workspace

## Overview

**OceanTechAI Workspace** là một **AI Company Operating System** — hệ điều hành cho công ty/dự án ảo, nơi con người (Founder) dẫn dắt một đội ngũ AI members làm việc như một công ty thật.

Người dùng tạo workspace và project, thêm các AI members với vai trò chuyên môn (Product Manager, Architect, Backend/Frontend Engineer, QA, Economy Designer, Red Team...). Các agent này **thảo luận nhiều vòng**, **phản biện lẫn nhau**, và **đi đến thống nhất** một phương án tốt nhất. Kết quả được đóng gói thành **proposal** để Founder duyệt. Khi được approve, hệ thống **tự động sinh** docs Markdown, task files, và (trong tương lai) GitHub issues hoặc pull requests.

Đây **không phải** chatbot nhiều nhân vật. Không phải AI Agent Framework. Đây là **Operating System for AI Organizations** — nơi nhiều AI cùng tồn tại, tranh luận, ghi nhớ, ra quyết định, và vận hành như một tổ chức thật.

Pipeline có cấu trúc:

```
User Input → AI Debate → AI Consensus → Human Approval → Automated Execution
```

Nền tảng tổ chức được định nghĩa trong [Company Charter](../company/COMPANY_CHARTER.md).

## Mission

Xây dựng nền tảng cho phép Founder ra quyết định sản phẩm/kỹ thuật nhanh hơn, chất lượng hơn — bằng cách khai thác sức mạnh của multi-agent debate có kiểm soát, với con người giữ quyền phê duyệt cuối cùng.

## Goals

| Goal | Mô tả |
|------|-------|
| **Structured debate** | Mỗi discussion chạy qua các round có định dạng rõ ràng: propose → critique → refine → vote → consensus |
| **Role fidelity** | Mỗi AI agent trả lời đúng vai trò, expertise, và voting weight của mình |
| **Human-in-the-loop** | Không có execution tự động nào xảy ra mà không qua Founder approval |
| **Docs as source of truth** | Markdown-generated artifacts là đầu ra chính thức, sẵn sàng cho GitHub và Cursor |
| **Configurable agents** | Agent là entity trong database, không phải microservice riêng — dễ thêm/sửa role và model |
| **Provider-agnostic AI** | OpenAI làm provider đầu tiên; kiến trúc cho phép thêm Claude, Gemini sau này |

## Success Metrics (MVP)

- Founder có thể tạo workspace → project → agents → discussion → proposal → approve → xem generated files **end-to-end** trên local.
- Một discussion hoàn chỉnh qua 5 round với structured JSON output được lưu và hiển thị trên UI.
- Proposal approved tự động sinh ít nhất 4 loại file: feature doc, architecture doc, API doc, Cursor task file.
- Thời gian từ "tạo discussion" đến "có proposal pending" < 5 phút (với OpenAI provider).

## Non-Goals (MVP)

- Không phải real-time multiplayer collaboration.
- Không tích hợp GitHub API thật (chỉ lưu generated files local/DB).
- Không microservice architecture — monolith Next.js đủ cho MVP.
- Không custom model fine-tuning.
- Không billing/subscription system.
- Không mobile app.

## Target Users

- **Founder / Product Owner** — người đưa input, duyệt proposal, là decision maker cuối.
- **Indie game studio / SaaS team** — cần brainstorm và spec nhanh với nhiều góc nhìn chuyên môn.
- **Technical leads** — muốn có audit trail (DecisionLog) cho mọi quyết định đã approve.

## Long-term Vision

1. **GitHub integration** — auto-create issues, PRs, branch scaffolding từ approved proposals.
2. **Multi-provider AI** — Claude, Gemini, local models qua unified `AIProvider` interface.
3. **Agent memory** — `memorySummary` tích lũy qua các discussion, agent "nhớ" context project.
4. **Template marketplace** — preset agent teams cho game MMO, SaaS B2B, mobile app...
5. **Execution layer** — sau approval, trigger Cursor agents hoặc CI pipelines để implement code.
