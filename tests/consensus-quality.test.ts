import { describe, it, expect } from "vitest";
import {
  scoreConsensus,
  assertConsensusQuality,
  CONSENSUS_QUALITY_THRESHOLD,
} from "@/server/quality/consensus-quality";
import { GovernanceError } from "@/server/errors/governance-error";
import type { ConsensusResult } from "@/types/consensus";

const goodConsensus: ConsensusResult = {
  title: "Crew System for MMO",
  finalDecision:
    "Implement MVP crew system with ranks, treasury caps, missions, and deferred crew wars to Phase 2.",
  alternativesConsidered: ["Full guild merge", "Unlimited crew size"],
  reasons: ["User retention via social bonds", "Architect approved PostgreSQL schema"],
  risks: ["Alt-account treasury laundering", "Mass-report griefing"],
  openQuestions: [],
  voteSummary: {
    yes: 4,
    no: 1.5,
    abstain: 1,
    raw: { yes: 4, no: 1, abstain: 1 },
    classification: "weak",
    dissenting: [],
    redTeamDissent: true,
  },
};

const weakConsensus: ConsensusResult = {
  title: "X",
  finalDecision: "Do it",
  alternativesConsidered: [],
  reasons: [],
  risks: [],
  openQuestions: [],
  voteSummary: {
    yes: 0,
    no: 0,
    abstain: 0,
    raw: { yes: 0, no: 0, abstain: 0 },
    classification: "split",
    dissenting: [],
    redTeamDissent: false,
  },
};

describe("consensus-quality", () => {
  it("scores good consensus above threshold", () => {
    expect(scoreConsensus(goodConsensus)).toBeGreaterThanOrEqual(
      CONSENSUS_QUALITY_THRESHOLD
    );
  });

  it("blocks proposal when consensus quality too low", () => {
    expect(() => assertConsensusQuality(weakConsensus)).toThrow(GovernanceError);
    try {
      assertConsensusQuality(weakConsensus);
    } catch (err) {
      expect((err as GovernanceError).code).toBe("CONSENSUS_QUALITY_TOO_LOW");
    }
  });

  it("allows good consensus through gate", () => {
    const score = assertConsensusQuality(goodConsensus);
    expect(score).toBeGreaterThanOrEqual(CONSENSUS_QUALITY_THRESHOLD);
  });
});
