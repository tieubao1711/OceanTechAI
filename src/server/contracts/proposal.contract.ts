import { z } from "zod";
import { ValidationError } from "@/server/errors/validation-error";

export const ProposalDraftContract = z.object({
  discussionId: z.string().min(1),
  title: z.string().min(1),
  summary: z.string().min(1),
  alternativesConsidered: z.array(z.string()),
  chosenSolution: z.string().min(1),
  reasoning: z.array(z.string()),
  risks: z.array(z.string()),
  filesToCreate: z.array(z.string()).min(1),
  tasksToCreate: z.array(z.string()).min(1),
  voteClassification: z.string().optional(),
  status: z.literal("PENDING"),
});

export type ProposalDraftContractType = z.infer<typeof ProposalDraftContract>;

export function parseProposalDraft(data: unknown): ProposalDraftContractType {
  const result = ProposalDraftContract.safeParse(data);
  if (!result.success) {
    throw new ValidationError(
      "INVALID_PROPOSAL_DRAFT",
      "Proposal draft failed contract validation.",
      result.error.flatten()
    );
  }
  return result.data;
}
