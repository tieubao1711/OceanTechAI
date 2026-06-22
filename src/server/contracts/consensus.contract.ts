import { z } from "zod";
import { ValidationError } from "@/server/errors/validation-error";

const VoteClassificationContract = z.enum([
  "strong",
  "weak",
  "split",
  "rejected",
  "security_concern",
]);

const DissentingAgentContract = z.object({
  agentId: z.string(),
  agentName: z.string(),
  role: z.string(),
  vote: z.enum(["no", "abstain"]),
  keyConcern: z.string(),
});

const VoteSummaryContract = z.object({
  yes: z.number(),
  no: z.number(),
  abstain: z.number(),
  raw: z.object({
    yes: z.number(),
    no: z.number(),
    abstain: z.number(),
  }),
  classification: VoteClassificationContract,
  dissenting: z.array(DissentingAgentContract),
  redTeamDissent: z.boolean(),
});

export const ConsensusResultContract = z.object({
  title: z.string().min(1),
  finalDecision: z.string().min(1),
  alternativesConsidered: z.array(z.string()),
  reasons: z.array(z.string()),
  risks: z.array(z.string()),
  openQuestions: z.array(z.string()),
  voteSummary: VoteSummaryContract,
});

export type ConsensusResultContractType = z.infer<typeof ConsensusResultContract>;

export function parseConsensusResult(data: unknown): ConsensusResultContractType {
  const result = ConsensusResultContract.safeParse(data);
  if (!result.success) {
    throw new ValidationError(
      "INVALID_CONSENSUS",
      "Consensus result failed contract validation.",
      result.error.flatten()
    );
  }
  return result.data;
}
