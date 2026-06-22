export type VoteClassification =
  | "strong"
  | "weak"
  | "split"
  | "rejected"
  | "security_concern";

export interface DissentingAgent {
  agentId: string;
  agentName: string;
  role: string;
  vote: "no" | "abstain";
  keyConcern: string;
}

export interface VoteSummary {
  yes: number;
  no: number;
  abstain: number;
  raw: { yes: number; no: number; abstain: number };
  classification: VoteClassification;
  dissenting: DissentingAgent[];
  redTeamDissent: boolean;
}

export interface ConsensusResult {
  title: string;
  finalDecision: string;
  alternativesConsidered: string[];
  reasons: string[];
  risks: string[];
  openQuestions: string[];
  voteSummary: VoteSummary;
}
