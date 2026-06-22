import type { LearningEvent, LearningSummary } from "./learning-types";

const MAX_SUMMARY_LENGTH = 480;
const MAX_EVIDENCE_ITEMS = 3;

export function summarizeLearningEvent(event: LearningEvent): LearningSummary {
  const evidenceSnippet = event.evidence
    .slice(0, MAX_EVIDENCE_ITEMS)
    .map((e) => e.trim())
    .filter(Boolean)
    .join(" | ");

  const raw = [
    `[${event.type}] ${event.title}`,
    `Outcome: ${event.outcome}`,
    evidenceSnippet ? `Evidence: ${evidenceSnippet}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  return {
    eventType: event.type,
    title: event.title,
    summary: truncateSummary(raw),
    importance: event.importance,
    capturedAt: new Date().toISOString(),
  };
}

export function truncateSummary(text: string, max = MAX_SUMMARY_LENGTH): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max - 3)}...`;
}

export function buildMemoryKey(eventType: string, identifier: string): string {
  const slug = identifier
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 64);
  return `learning_${eventType.toLowerCase()}_${slug}`;
}

export function parseLearningMemoryValue(value: string): LearningSummary | null {
  try {
    const parsed = JSON.parse(value) as LearningSummary;
    if (parsed.eventType && parsed.title && parsed.summary) {
      return parsed;
    }
  } catch {
    return {
      eventType: "AUDIT_COMPLETED",
      title: value.slice(0, 80),
      summary: truncateSummary(value),
      importance: "medium",
      capturedAt: new Date().toISOString(),
    };
  }
  return null;
}
