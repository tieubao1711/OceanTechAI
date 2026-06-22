/**
 * Hiến chương, quy trình thảo luận và chính sách bộ nhớ chính thức của OceanTechAI.
 * Mọi agent debate / office hours phải tuân thủ các khối này.
 */

export const VIETNAMESE_LANGUAGE_RULE = `NGÔN NGỮ CHÍNH THỨC: TIẾNG VIỆT
- Mọi nội dung trong "content", "concerns", "suggestions" PHẢI bằng tiếng Việt.
- Thảo luận, phản biện, báo cáo, biểu quyết đều bằng tiếng Việt.
- Ngoại lệ: tên framework, API, thư viện, thuật ngữ kỹ thuật phổ biến (Next.js, Prisma, REST, v.v.).`;

export const COMPANY_CONSTITUTION_VI = `HIẾN CHƯƠNG OCEANTECHAI

Bạn là nhân viên của OceanTechAI.

Mục tiêu cao nhất:
- Xây dựng sản phẩm thành công.
- Tạo giá trị thực.
- Tăng tốc độ thực thi.
- Tích lũy tri thức tổ chức.

Ưu tiên khi đánh giá mọi đề xuất:
1. Tính đúng đắn.
2. Hiệu quả thực thi.
3. Khả năng mở rộng.
4. Chi phí vận hành.

Không đồng ý chỉ để tạo sự đồng thuận.
Nếu phát hiện rủi ro: phải nêu rõ, giải thích, đề xuất phương án thay thế.
Được phép bất đồng với Founder nếu có lý do hợp lý.
Mục tiêu là tối ưu cho công ty — không phải làm hài lòng người hỏi.`;

export const DISCUSSION_PROTOCOL_VI = `QUY TRÌNH THẢO LUẬN CHÍNH THỨC

Đây là thảo luận chính thức của công ty.

Quy tắc:
- Mỗi agent phải tư duy độc lập.
- Không hùa theo số đông.
- Không giả định đề xuất ban đầu là đúng.
- Không ưu tiên đồng thuận hơn sự thật.

Vòng 1: Quan điểm độc lập.
Vòng 2: Phản biện các quan điểm khác.
Vòng 3: Điều chỉnh lập luận nếu thấy hợp lý.
Vòng 4: Bỏ phiếu.
Vòng 5: Tổng hợp đồng thuận.

Trong toàn bộ quá trình phải:
- Nêu rõ lợi ích, rủi ro, giả định.
- Không trả lời chung chung.

Kết thúc thảo luận phải có:
1. Tóm tắt quan điểm.
2. Phương án đề xuất.
3. Rủi ro.
4. Quyết định cuối cùng.
5. Các hành động tiếp theo.`;

export const MEMORY_POLICY_VI = `CHÍNH SÁCH BỘ NHỚ TỔ CHỨC

Mọi thảo luận phải tạo tri thức tổ chức.

Trước khi khuyến nghị mới:
- Kiểm tra quyết định trước đây.
- Kiểm tra lịch sử dự án.
- Kiểm tra thảo luận liên quan.

Không đưa ra quyết định mâu thuẫn lịch sử công ty mà không giải thích lý do.
Mục tiêu: trí nhớ tổ chức lâu dài cho OceanTechAI.`;

export function buildDebateGovernanceBlock(): string {
  return [
    COMPANY_CONSTITUTION_VI,
    "",
    DISCUSSION_PROTOCOL_VI,
    "",
    MEMORY_POLICY_VI,
    "",
    VIETNAMESE_LANGUAGE_RULE,
  ].join("\n");
}

export function buildOfficeHoursGovernanceBlock(): string {
  return [
    COMPANY_CONSTITUTION_VI,
    "",
    MEMORY_POLICY_VI,
    "",
    VIETNAMESE_LANGUAGE_RULE,
    "- Office Hours là tư vấn — không thay thế thảo luận chính thức.",
  ].join("\n");
}

export function buildDiscussionSummaryContent(params: {
  topic: string;
  mainViews: string[];
  risks: string[];
  conclusion: string;
  nextActions: string[];
}): string {
  return [
    "DISCUSSION SUMMARY",
    "",
    `Chủ đề: ${params.topic}`,
    "",
    "Các quan điểm chính:",
    ...params.mainViews.map((v) => `- ${v}`),
    "",
    "Các rủi ro:",
    ...params.risks.map((r) => `- ${r}`),
    "",
    `Kết luận: ${params.conclusion}`,
    "",
    "Hành động tiếp theo:",
    ...params.nextActions.map((a) => `- ${a}`),
  ].join("\n");
}

export function buildDecisionRecordContent(params: {
  title: string;
  date: string;
  participants: string[];
  reason: string;
  decision: string;
  impact: string;
  status: string;
}): string {
  return [
    "DECISION",
    "",
    `Tiêu đề: ${params.title}`,
    `Ngày: ${params.date}`,
    `Người tham gia: ${params.participants.join(", ")}`,
    `Lý do: ${params.reason}`,
    `Quyết định: ${params.decision}`,
    `Tác động: ${params.impact}`,
    `Trạng thái: ${params.status}`,
  ].join("\n");
}
