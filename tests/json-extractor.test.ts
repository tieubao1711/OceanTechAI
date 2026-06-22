import { describe, it, expect } from "vitest";
import { extractJsonString } from "@/server/ai/json/json-extractor";
import { parseAiJson } from "@/server/ai/json/json-repair";

describe("json-extractor", () => {
  it("parses JSON inside markdown code fence", () => {
    const raw = 'Here is my answer:\n```json\n{"stance":"support","content":"ok","concerns":[],"suggestions":[]}\n```';
    const extracted = extractJsonString(raw);
    const parsed = JSON.parse(extracted);
    expect(parsed.stance).toBe("support");
    expect(parsed.content).toBe("ok");
  });

  it("extracts JSON object from prose wrapper", () => {
    const raw = 'Sure! {"stance":"refine","content":"refined plan","concerns":["risk"],"suggestions":["do X"]} Hope that helps.';
    const parsed = parseAiJson(raw);
    expect(parsed.stance).toBe("refine");
    expect(parsed.concerns).toEqual(["risk"]);
  });
});

describe("json-repair", () => {
  it("repairs trailing comma", () => {
    const raw = '{"stance":"support","content":"test",}';
    const parsed = parseAiJson(raw);
    expect(parsed.stance).toBe("support");
  });
});
