import { z } from "zod";
import { ValidationError } from "@/server/errors/validation-error";

export const AgentMessageContract = z.object({
  agentId: z.string().min(1),
  round: z.number().int().min(1).max(5),
  stance: z.enum(["support", "oppose", "neutral", "refine"]),
  content: z.string().min(1),
  concerns: z.array(z.string()),
  suggestions: z.array(z.string()),
  vote: z.enum(["yes", "no", "abstain"]).optional(),
});

export type AgentMessageContractType = z.infer<typeof AgentMessageContract>;

export function parseAgentMessage(data: unknown): AgentMessageContractType {
  const result = AgentMessageContract.safeParse(data);
  if (!result.success) {
    throw new ValidationError(
      "INVALID_AGENT_MESSAGE",
      "Agent message failed contract validation.",
      result.error.flatten()
    );
  }
  return result.data;
}
