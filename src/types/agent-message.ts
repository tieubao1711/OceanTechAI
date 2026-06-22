import { z } from "zod";

export const agentMessageSchema = z.object({
  agentId: z.string(),
  round: z.number().int().min(1).max(5),
  stance: z.enum(["support", "oppose", "neutral", "refine"]),
  content: z.string().min(1),
  concerns: z.array(z.string()),
  suggestions: z.array(z.string()),
  vote: z.enum(["yes", "no", "abstain"]).optional(),
});

export type AgentMessagePayload = z.infer<typeof agentMessageSchema>;

export type StanceLiteral = AgentMessagePayload["stance"];
export type VoteLiteral = NonNullable<AgentMessagePayload["vote"]>;
