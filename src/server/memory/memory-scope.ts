import type { MemoryScope } from "@prisma/client";

export const MEMORY_SCOPES: MemoryScope[] = [
  "GLOBAL",
  "WORKSPACE",
  "PROJECT",
  "AGENT",
  "DISCUSSION",
  "DECISION",
];

export type MemoryQuery = {
  workspaceId?: string;
  projectId?: string;
  agentRole?: string;
};

export function formatMemoryBlock(
  label: string,
  entries: Array<{ key: string; value: string }>
): string {
  if (entries.length === 0) return "";
  const lines = entries.map((e) => `- ${e.key}: ${e.value}`).join("\n");
  return `[${label}]\n${lines}`;
}
