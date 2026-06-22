import type { MemoryScope } from "@prisma/client";
import { prisma } from "@/server/db/prisma";
import { formatMemoryBlock } from "./memory-scope";

export class MemoryService {
  async getEntries(scope: MemoryScope, filters: {
    workspaceId?: string;
    projectId?: string;
    agentRole?: string;
  }) {
    return prisma.memoryEntry.findMany({
      where: {
        scope,
        workspaceId: filters.workspaceId ?? null,
        projectId: filters.projectId ?? null,
        agentRole: filters.agentRole ?? null,
      },
      orderBy: { updatedAt: "desc" },
    });
  }

  async upsertEntry(params: {
    scope: MemoryScope;
    key: string;
    value: string;
    workspaceId?: string;
    projectId?: string;
    agentRole?: string;
    source?: string;
  }) {
    const existing = await prisma.memoryEntry.findFirst({
      where: {
        scope: params.scope,
        key: params.key,
        workspaceId: params.workspaceId ?? null,
        projectId: params.projectId ?? null,
        agentRole: params.agentRole ?? null,
      },
    });

    if (existing) {
      return prisma.memoryEntry.update({
        where: { id: existing.id },
        data: { value: params.value, source: params.source },
      });
    }

    return prisma.memoryEntry.create({ data: params });
  }

  async buildContextForDiscussion(params: {
    workspaceId: string;
    projectId: string;
    agentRole: string;
  }): Promise<string> {
    const [globalEntries, workspaceEntries, projectEntries, agentEntries] =
      await Promise.all([
        this.getEntries("GLOBAL", {}),
        this.getEntries("WORKSPACE", { workspaceId: params.workspaceId }),
        this.getEntries("PROJECT", { projectId: params.projectId }),
        this.getEntries("AGENT", { agentRole: params.agentRole }),
      ]);

    const blocks = [
      formatMemoryBlock("Global Memory", globalEntries),
      formatMemoryBlock("Workspace Memory", workspaceEntries),
      formatMemoryBlock("Project Memory", projectEntries),
      formatMemoryBlock("Agent Memory", agentEntries),
    ].filter(Boolean);

    return blocks.join("\n\n");
  }

  async seedGlobalMemory() {
    const defaults = [
      {
        key: "charter",
        value:
          "Ngôn ngữ chính thức: tiếng Việt. AI không thực thi hành động không thể hoàn tác nếu chưa có Founder duyệt.",
      },
      {
        key: "debate_rounds",
        value:
          "Mọi thảo luận chạy 5 vòng: đề xuất, phản biện, tinh chỉnh, bỏ phiếu, đồng thuận. Agent phải tư duy độc lập.",
      },
      {
        key: "voting",
        value: "Bỏ phiếu có trọng số. Red Team mặc định trọng số 1.5.",
      },
      {
        key: "memory_policy",
        value:
          "Mọi thảo luận tạo DISCUSSION SUMMARY. Quyết định được duyệt tạo bản ghi DECISION. Kiểm tra lịch sử trước khi khuyến nghị mới.",
      },
    ];

    for (const entry of defaults) {
      await this.upsertEntry({
        scope: "GLOBAL",
        key: entry.key,
        value: entry.value,
        source: "system_seed",
      });
    }
  }
}

export const memoryService = new MemoryService();
