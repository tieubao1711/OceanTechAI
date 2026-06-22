import type { Agent } from "@prisma/client";
import { buildOfficeHoursGovernanceBlock } from "@/server/governance/oceantechai-constitution";
import { DEPARTMENT_LABELS } from "@/server/workforce/workforce-types";
import { OFFICE_HOURS_ADVISORY_NOTICE } from "./office-hours-governance";
import { OFFICE_HOURS_LIMITS, type OfficeHoursContextBundle } from "./office-hours-types";

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1)}…`;
}

function joinSection(title: string, lines: string[]): string {
  if (lines.length === 0) return "";
  return `${title}\n${lines.map((l) => `- ${l}`).join("\n")}`;
}

export class OfficeHoursPromptBuilder {
  buildSystemPrompt(agent: Agent): string {
    const dept = DEPARTMENT_LABELS[agent.department];
    const title = agent.title ?? agent.role;

    return [
      `Bạn là ${agent.name}, ${title}, phòng ${dept} (cấp ${agent.rank}).`,
      "",
      "Bạn đang trò chuyện riêng với Founder trong Office Hours.",
      "",
      OFFICE_HOURS_ADVISORY_NOTICE,
      "",
      buildOfficeHoursGovernanceBlock(),
      "",
      "Quy tắc phản hồi:",
      "- Trả lời trực tiếp, ngắn gọn bằng tiếng Việt (plain text, không JSON).",
      "- Giữ góc nhìn vai trò và phòng ban của bạn.",
      "- Thành thật về điểm không chắc chắn — không giả vờ có thẩm quyền.",
      "- Với quyết định lớn, thay đổi phạm vi, hoặc thực thi: đề xuất Thảo luận chính thức.",
      "- Bạn không duyệt đề xuất hay thực thi thay đổi.",
      "",
      `Trọng tâm vai trò: ${agent.systemPrompt}`,
      agent.expertise.length > 0 ? `Chuyên môn: ${agent.expertise.join(", ")}` : "",
    ]
      .filter(Boolean)
      .join("\n");
  }

  buildContextBlock(context: OfficeHoursContextBundle): string {
    const sections = [
      joinSection("Current project", [
        context.projectName,
        context.projectDescription ? truncate(context.projectDescription, 200) : "",
      ].filter(Boolean)),
      joinSection("Your assignments", context.assignments),
      context.memoryBlock ? `Your memory\n${context.memoryBlock}` : "",
      joinSection("Recent journals", context.journals),
      joinSection("Recent debate positions", context.debatePositions),
      joinSection("Relevant learning center", context.learningRecords),
      context.projectKnowledge ? `Project knowledge snapshot\n${context.projectKnowledge}` : "",
    ].filter(Boolean);

    return sections.join("\n\n");
  }

  buildUserPrompt(params: {
    founderMessage: string;
    context: OfficeHoursContextBundle;
  }): string {
    const history =
      params.context.recentMessages.length > 0
        ? [
            "Recent conversation:",
            ...params.context.recentMessages.map(
              (m) => `${m.role === "founder" ? "Founder" : "You"}: ${truncate(m.content, 500)}`
            ),
          ].join("\n")
        : "";

    return [
      this.buildContextBlock(params.context),
      history,
      "",
      `Founder: ${params.founderMessage}`,
      "",
      "Trả lời bằng tiếng Việt, đúng vai trò của bạn. Tối đa 400 từ trừ khi cần chi tiết.",
    ]
      .filter(Boolean)
      .join("\n\n");
  }

  formatCompactProjectKnowledge(snapshot: {
    architectureSummary: string;
    existingModules: string[];
    existingServices: string[];
    knownConstraints: string[];
    recentADRs: string[];
    prismaModels: string[];
  }): string {
    const lines = [
      snapshot.architectureSummary,
      ...snapshot.existingModules.slice(0, 5).map((m) => `Module: ${m}`),
      ...snapshot.existingServices.slice(0, 5).map((s) => `Service: ${s}`),
      ...snapshot.knownConstraints.slice(0, 3).map((c) => `Constraint: ${c}`),
      ...snapshot.recentADRs.slice(0, 3).map((a) => `ADR: ${a}`),
      ...snapshot.prismaModels.slice(0, 5).map((m) => `Model: ${m}`),
    ];
    return lines.slice(0, OFFICE_HOURS_LIMITS.maxCompactKnowledgeLines).join("\n");
  }
}

export const officeHoursPromptBuilder = new OfficeHoursPromptBuilder();
