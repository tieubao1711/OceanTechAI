import type { Agent, RoundType } from "@prisma/client";

import type { RoundContext } from "@/types/debate";

import { isAuditMode } from "@/types/discussion-mode";

import { buildDebateGovernanceBlock } from "@/server/governance/oceantechai-constitution";

import { formatRoleLabel } from "./agent-profile";



const JSON_SCHEMA_NORMAL = `{

  "stance": "support | oppose | neutral | refine",

  "content": "phản hồi chính bằng tiếng Việt",

  "concerns": ["mảng các mối lo bằng tiếng Việt"],

  "suggestions": ["mảng các gợi ý bằng tiếng Việt"]

}`;



const JSON_SCHEMA_AUDIT = `{

  "stance": "support | oppose | neutral | refine",

  "content": "phản hồi chính bằng tiếng Việt",

  "concerns": ["mảng các mối lo bằng tiếng Việt"],

  "suggestions": ["mảng các gợi ý bằng tiếng Việt"],

  "findings": [{"title": "string", "evidence": "file/module cụ thể", "impact": "string", "priority": "low|medium|high|critical"}]

}`;



const JSON_SCHEMA_VOTE = `{

  "stance": "support | oppose | neutral | refine",

  "content": "lý do bỏ phiếu bằng tiếng Việt",

  "concerns": ["mảng các mối lo bằng tiếng Việt"],

  "suggestions": ["mảng các gợi ý bằng tiếng Việt"],

  "vote": "yes"

}`;



const JSON_SCHEMA_AUDIT_VOTE = `{

  "stance": "support | oppose | neutral | refine",

  "content": "lý do bỏ phiếu bằng tiếng Việt",

  "concerns": ["mảng các mối lo bằng tiếng Việt"],

  "suggestions": ["mảng các gợi ý bằng tiếng Việt"],

  "findings": [{"title": "string", "evidence": "file/module cụ thể", "impact": "string", "priority": "low|medium|high|critical"}],

  "vote": "yes"

}`;



const ROUND_4_VOTE_REQUIREMENT = `BẮT BUỘC — VÒNG 4 BỎ PHIẾU:

Đây là Vòng 4. Bạn PHẢI có trường:

"vote": "yes" | "no" | "abstain"



Nếu thiếu vote, phản hồi không hợp lệ.`;



const ROUND_INSTRUCTIONS: Record<string, string> = {

  PROPOSE: `VÒNG 1 — TƯ DUY ĐỘC LẬP

- Tư duy độc lập. KHÔNG tham chiếu đề xuất của agent khác.

- Đưa phương án phù hợp vai trò và chuyên môn của bạn.

- Nêu rõ lợi ích, rủi ro, giả định.

- KHÔNG có trường vote.`,

  CRITIQUE: `VÒNG 2 — PHẢN BIỆN CHÉO

- Xem xét đề xuất Vòng 1 (có trong ngữ cảnh bên dưới).

- Phản biện điểm yếu, tìm lỗ hổng, thách thức giả định. Cụ thể, thẳng thắn.

- Không hùa theo số đông.

- KHÔNG có trường vote.`,

  REFINE: `VÒNG 3 — TINH CHỈNH

- Tiếp thu phản biện hợp lý từ Vòng 2. Bảo vệ lập trường có lý do.

- Đưa phương án cuối khả thi, rõ ràng.

- KHÔNG có trường vote.`,

  VOTE: `VÒNG 4 — BỎ PHIẾU

- Bỏ phiếu về phương án đã tinh chỉnh ở Vòng 3.

- PHẢI có vote: "yes", "no", hoặc "abstain" kèm lý do trong content và concerns nếu no/abstain.



${ROUND_4_VOTE_REQUIREMENT}`,

};



function formatPreviousMessages(

  messages: RoundContext["previousMessages"],

  currentRound: number

): string {

  const relevant = messages.filter((m) => m.roundNumber < currentRound);

  if (relevant.length === 0) return "Chưa có tin nhắn vòng trước.";



  return relevant

    .map(

      (m) =>

        `[Vòng ${m.roundNumber} — ${m.agentName} (${m.agentRole})]\n` +

        `Lập trường: ${m.stance}\n${m.content}\n` +

        (m.concerns.length ? `Mối lo: ${m.concerns.join("; ")}\n` : "") +

        (m.suggestions.length ? `Gợi ý: ${m.suggestions.join("; ")}\n` : "")

    )

    .join("\n---\n");

}



export function buildAgentPrompt(params: {

  agent: Agent;

  roundType: RoundType;

  context: RoundContext;

  memoryContext: string;

}): { systemPrompt: string; userPrompt: string } {

  const { agent, roundType, context, memoryContext } = params;

  const roundInstruction = ROUND_INSTRUCTIONS[roundType] ?? ROUND_INSTRUCTIONS.PROPOSE;

  const audit = isAuditMode(context.discussionMode);

  const isVoteRound = roundType === "VOTE";

  const jsonSchema = isVoteRound

    ? audit

      ? JSON_SCHEMA_AUDIT_VOTE

      : JSON_SCHEMA_VOTE

    : audit

      ? JSON_SCHEMA_AUDIT

      : JSON_SCHEMA_NORMAL;



  const systemPrompt = [

    `Bạn là ${agent.name}, ${formatRoleLabel(agent.role)} trong đội sản phẩm AI của OceanTechAI.`,

    agent.systemPrompt,

    `Chuyên môn: ${agent.expertise.join(", ")}`,

    agent.memorySummary ? `Bộ nhớ agent:\n${agent.memorySummary}` : "",

    memoryContext ? `\n${memoryContext}` : "",

    context.projectKnowledge ? `\n${context.projectKnowledge}` : "",

    "",

    buildDebateGovernanceBlock(),

    "",

    "QUY TẮC HỆ THỐNG:",

    "- AI không được thực thi hành động không thể hoàn tác nếu chưa có Founder duyệt.",

    "- Giữ đúng vai trò và phòng ban của bạn.",

    audit

      ? "- AUDIT KIẾN TRÚC: trích dẫn module/file cụ thể của OceanTechAI. Không đề xuất tính năng đã tồn tại."

      : "",

    "",

    "ĐỊNH DẠNG ĐẦU RA:",

    "Chỉ trả về JSON hợp lệ theo schema:",

    jsonSchema,

  ]

    .filter(Boolean)

    .join("\n");



  const userPrompt = [

    `Chủ đề từ Founder:\n"${context.userPrompt}"`,

    "",

    roundInstruction,

    isVoteRound ? ROUND_4_VOTE_REQUIREMENT : null,

    "",

    "Tin nhắn các vòng trước:",

    formatPreviousMessages(context.previousMessages, context.round.roundNumber),

    "",

    "Chỉ trả về JSON hợp lệ. Không dùng markdown fence.",

  ]

    .filter((line): line is string => line !== null)

    .join("\n");



  return { systemPrompt, userPrompt };

}


