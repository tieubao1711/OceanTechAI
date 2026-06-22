import { describe, it, expect } from "vitest";
import {
  resolveProjectRoster,
  disambiguateAgentName,
  formatAgentDisplayLabel,
  agentShortName,
} from "@/server/agents/project-roster";
import { DOGFOOD_PROJECT_ID, SEED_PROJECT_ID } from "@/lib/dogfood-ids";

describe("project-roster", () => {
  it("returns distinct Core vs MMO rosters without duplicate first names", () => {
    const core = resolveProjectRoster(DOGFOOD_PROJECT_ID, "OceanTechAI Core");
    const mmo = resolveProjectRoster(SEED_PROJECT_ID, "MMO Game Project");

    const coreShort = core.map((a) => agentShortName(a.name));
    const mmoShort = mmo.map((a) => agentShortName(a.name));

    expect(coreShort).toContain("Alex");
    expect(mmoShort).toContain("Linh");
    expect(mmoShort).not.toContain("Alex");

    const overlap = coreShort.filter((n) => mmoShort.includes(n));
    expect(overlap).toHaveLength(0);
  });

  it("disambiguates generic project agent names", () => {
    expect(disambiguateAgentName("Alex — Product Manager", "Alpha")).toBe(
      "Alex — Product Manager · Alpha"
    );
  });

  it("formats display label with home project", () => {
    expect(
      formatAgentDisplayLabel({
        name: "Alex — Product Manager",
        homeProjectName: "OceanTechAI Core",
        showProject: true,
      })
    ).toBe("Alex (OceanTechAI Core)");
  });
});
