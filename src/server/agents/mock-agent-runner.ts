import type { Agent, RoundType } from "@prisma/client";
import { parseAgentMessage } from "@/server/contracts/agent-message.contract";
import type { RoundContext } from "@/types/debate";
import { generateMockAgentResponse } from "./mock-agent-responses";

/** @deprecated Use AgentRunner + MockProvider. Kept for backward compatibility. */
export class MockAgentRunner {
  async run(agent: Agent, roundType: RoundType, context: RoundContext) {
    const message = generateMockAgentResponse(agent, roundType, context);
    return parseAgentMessage(message);
  }
}

export const mockAgentRunner = new MockAgentRunner();
