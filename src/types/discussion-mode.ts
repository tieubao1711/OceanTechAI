export type DiscussionMode = "normal" | "architecture_audit";

export function parseDiscussionMode(value: string | null | undefined): DiscussionMode {
  return value === "architecture_audit" ? "architecture_audit" : "normal";
}

export function isAuditMode(mode: string | null | undefined): boolean {
  return mode === "architecture_audit";
}
