import { extractJsonString } from "./json-extractor";
import { ValidationError } from "@/server/errors/validation-error";

/** Apply simple repairs to malformed JSON strings. */
export function repairJsonString(raw: string): string {
  let s = extractJsonString(raw);

  // Replace single-quoted keys/values with double quotes (simple cases)
  s = s.replace(/'([^'\\]*?)'/g, '"$1"');

  // Remove trailing commas before } or ]
  s = s.replace(/,\s*([}\]])/g, "$1");

  return s.trim();
}

export function parseAiJson(content: string): Record<string, unknown> {
  const attempts = [
    () => JSON.parse(extractJsonString(content)),
    () => JSON.parse(repairJsonString(content)),
  ];

  for (const attempt of attempts) {
    try {
      const result = attempt();
      if (result && typeof result === "object" && !Array.isArray(result)) {
        return result as Record<string, unknown>;
      }
    } catch {
      // try next
    }
  }

  throw new ValidationError(
    "INVALID_AI_JSON",
    "Failed to parse AI response as JSON after repair attempts."
  );
}
